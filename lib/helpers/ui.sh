#!/usr/bin/env bash
# UI primitives for the install wizard — gum-backed when available,
# plain-bash fallback otherwise.
#
# Auto-bootstrap: on first run we try to fetch gum from GitHub Releases
# into $GOR_MOBILE_HOME/cache/bin/. If any step of that fails (no TTY,
# offline, unsupported arch, --yes mode, NO_TUI=1), we degrade to the
# same read-based prompts the wizard used before. The public ui_* API
# stays the same either way, so callers never branch on the mode.
#
# Environment toggles (honored by ensure_gum):
#   NO_TUI=1       — force fallback even if gum is in PATH
#   ASSUME_YES=1   — non-interactive; gum is not bootstrapped

GUM_VERSION="0.14.5"
GUM_CACHE_DIR="${GOR_MOBILE_HOME:-$HOME/.gor-mobile}/cache/bin"
GUM=""

_ui_detect_platform() {
    local os arch
    case "$(uname -s)" in
        Darwin) os="Darwin" ;;
        Linux)  os="Linux"  ;;
        *)      return 1 ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64)  arch="x86_64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) return 1 ;;
    esac
    printf "%s_%s" "$os" "$arch"
}

# ensure_gum — populates $GUM if possible, returns 0/1.
# Skipped (returns 1, empty $GUM) when NO_TUI=1, no TTY on stdin, or ASSUME_YES=1.
ensure_gum() {
    [[ "${NO_TUI:-0}" == "1" ]]      && return 1
    [[ "${ASSUME_YES:-0}" == "1" ]]  && return 1
    [[ ! -t 0 || ! -t 1 ]]           && return 1

    if command -v gum >/dev/null 2>&1; then
        GUM="$(command -v gum)"
        return 0
    fi

    if [[ -x "$GUM_CACHE_DIR/gum" ]]; then
        GUM="$GUM_CACHE_DIR/gum"
        return 0
    fi

    local platform url tmp tarball bin
    platform="$(_ui_detect_platform)" || return 1
    url="https://github.com/charmbracelet/gum/releases/download/v${GUM_VERSION}/gum_${GUM_VERSION}_${platform}.tar.gz"
    tmp="$(mktemp -d)"
    tarball="$tmp/gum.tar.gz"

    printf '  › First-run setup: fetching TUI helper (~3 MB)…\n' >&2
    if ! curl -fsSL --max-time 30 "$url" -o "$tarball" 2>/dev/null; then
        rm -rf "$tmp"
        return 1
    fi
    if ! tar -xzf "$tarball" -C "$tmp" 2>/dev/null; then
        rm -rf "$tmp"
        return 1
    fi
    bin="$(find "$tmp" -type f -name gum 2>/dev/null | head -n 1)"
    if [[ -z "$bin" ]]; then
        rm -rf "$tmp"
        return 1
    fi

    mkdir -p "$GUM_CACHE_DIR"
    mv "$bin" "$GUM_CACHE_DIR/gum"
    chmod +x "$GUM_CACHE_DIR/gum"
    rm -rf "$tmp"

    GUM="$GUM_CACHE_DIR/gum"
    return 0
}

# ──── Fallback color primitives ────────────────────────────────────────────
_ui_fmt_setup() {
    if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
        FMT_RESET=$(printf '\033[0m')
        FMT_BOLD=$(printf '\033[1m')
        FMT_BRAND=$(printf '\033[38;5;141m')
        FMT_GREEN=$(printf '\033[32m')
        FMT_YELLOW=$(printf '\033[33m')
        FMT_RED=$(printf '\033[31m')
        FMT_MUTED=$(printf '\033[38;5;244m')
    else
        FMT_RESET="" FMT_BOLD="" FMT_BRAND=""
        FMT_GREEN="" FMT_YELLOW="" FMT_RED="" FMT_MUTED=""
    fi
}
_ui_fmt_setup

# ──── Public UI API ────────────────────────────────────────────────────────

# ui_banner <title>
ui_banner() {
    local title="$1"
    if [[ -n "$GUM" ]]; then
        "$GUM" style --align center --width 72 --margin "1 0" --padding "1 2" \
            --border double --border-foreground 141 --foreground 141 --bold \
            "$title"
    else
        printf '\n  %s%s%s\n\n' "$FMT_BRAND$FMT_BOLD" "$title" "$FMT_RESET"
    fi
}

# ui_header <num> <total> <title>
ui_header() {
    local num="$1" total="$2" title="$3"
    if [[ -n "$GUM" ]]; then
        "$GUM" style \
            --border rounded --border-foreground 141 \
            --padding "0 2" --margin "1 0 0 0" \
            --foreground 141 --bold \
            "Step $num/$total  │  $title"
    else
        printf '\n%s▸ %s/%s %s%s\n' "$FMT_BRAND$FMT_BOLD" "$num" "$total" "$title" "$FMT_RESET"
    fi
}

ui_ok()    { printf '  %s✓%s %s\n' "$FMT_GREEN"  "$FMT_RESET" "$*" >&2; }
ui_warn()  { printf '  %s!%s %s\n' "$FMT_YELLOW" "$FMT_RESET" "$*" >&2; }
ui_err()   { printf '  %s✗%s %s\n' "$FMT_RED"    "$FMT_RESET" "$*" >&2; }
ui_info()  { printf '  %si%s %s\n' "$FMT_BRAND"  "$FMT_RESET" "$*" >&2; }
ui_muted() { printf '  %s%s%s\n'   "$FMT_MUTED"  "$*"         "$FMT_RESET" >&2; }

# ui_confirm <question> [default=Y|N]  — returns 0 on yes, 1 on no
ui_confirm() {
    local q="$1" default="${2:-Y}"
    if [[ "${ASSUME_YES:-0}" == "1" ]]; then
        return 0
    fi
    if [[ -n "$GUM" ]]; then
        local args=(confirm "$q" --selected.background 141)
        [[ "$default" == "N" ]] && args+=(--default=false)
        "$GUM" "${args[@]}"
        return $?
    fi
    local hint reply
    [[ "$default" == "Y" ]] && hint="[Y/n]" || hint="[y/N]"
    printf '  %s?%s %s %s%s%s ' \
        "$FMT_BRAND$FMT_BOLD" "$FMT_RESET" "$q" "$FMT_MUTED" "$hint" "$FMT_RESET" >&2
    read -r reply
    reply="${reply:-$default}"
    [[ "$reply" =~ ^[Yy] ]]
}

# ui_choose <header> <default> <item1> [item2 …]  — prints pick to stdout
ui_choose() {
    local header="$1" default="$2"; shift 2
    local items=("$@")
    if [[ -n "$GUM" ]]; then
        printf '%s\n' "${items[@]}" | "$GUM" choose \
            --header "$header" \
            --cursor "❯ " \
            --cursor.foreground 141 \
            --selected.foreground 42 \
            --selected-prefix "● " \
            --unselected-prefix "○ " \
            --height 10
        return
    fi
    {
        printf '\n  %s%s%s\n' "$FMT_BOLD" "$header" "$FMT_RESET"
        local i=1 m default_idx=1
        for m in "${items[@]}"; do
            [[ "$m" == "$default" ]] && default_idx=$i
            printf '    %2d) %s\n' "$i" "$m"
            i=$((i+1))
        done
        printf '  Choose [1-%d, default=%d]: ' "${#items[@]}" "$default_idx"
    } >&2
    local reply
    read -r reply
    reply="${reply:-$default_idx}"
    if [[ "$reply" =~ ^[0-9]+$ ]] && (( reply >= 1 && reply <= ${#items[@]} )); then
        printf '%s' "${items[$((reply-1))]}"
    else
        printf '%s' "$default"
    fi
}

# ui_input <prompt>  — prints answer to stdout
ui_input() {
    local p="$1"
    if [[ -n "$GUM" ]]; then
        "$GUM" input --prompt "  $p › " --prompt.foreground 141
        return
    fi
    printf '  %s %s›%s ' "$p" "$FMT_BRAND$FMT_BOLD" "$FMT_RESET" >&2
    local reply; read -r reply
    printf '%s' "$reply"
}

# ui_spin <label> <cmd…>
ui_spin() {
    local label="$1"; shift
    if [[ -n "$GUM" ]]; then
        "$GUM" spin --spinner dot --title "$label" --title.foreground 141 -- "$@"
        return
    fi
    ui_muted "$label"
    "$@"
}
