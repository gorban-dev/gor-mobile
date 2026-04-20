#!/usr/bin/env bash
# Prototype — OpenClaw-style wizard: uses `gum` under the hood, but bootstraps
# it on the fly if the user doesn't have it installed. From the user's
# perspective this is a zero-dependency wizard — we vendor `gum` into
# ~/.gor-mobile/cache/bin on first run, sha256-verified from GitHub Releases,
# and reuse it afterwards.
#
# Fallback path: if download fails, no TTY, --yes/CI, or unsupported arch,
# we degrade to plain numbered prompts (same style as the current init.sh).
#
# Run:
#   bash scripts/wizard-tui-prototype.sh
#
# First run downloads ~3 MB gum binary (once). Subsequent runs are instant.

set -euo pipefail

GUM_VERSION="0.14.5"
GUM_CACHE_DIR="${HOME}/.gor-mobile/cache/bin"
GUM=""

# ──── Bootstrap `gum` (OpenClaw pattern) ───────────────────────────────────

detect_platform() {
    local os arch
    case "$(uname -s)" in
        Darwin) os="Darwin" ;;
        Linux)  os="Linux"  ;;
        *)      return 1 ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64) arch="x86_64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) return 1 ;;
    esac
    printf "%s_%s" "$os" "$arch"
}

ensure_gum() {
    # 1. already in PATH?
    if command -v gum >/dev/null 2>&1; then
        GUM="$(command -v gum)"
        return 0
    fi

    # 2. cached from previous run?
    if [[ -x "$GUM_CACHE_DIR/gum" ]]; then
        GUM="$GUM_CACHE_DIR/gum"
        return 0
    fi

    # 3. download from GitHub Releases
    local platform url tmp tarball
    platform="$(detect_platform)" || return 1

    url="https://github.com/charmbracelet/gum/releases/download/v${GUM_VERSION}/gum_${GUM_VERSION}_${platform}.tar.gz"
    tmp="$(mktemp -d)"
    tarball="$tmp/gum.tar.gz"

    printf '  › First-run setup: fetching TUI helper (~3 MB)…\n' >&2
    if ! curl -fsSL --max-time 30 "$url" -o "$tarball" 2>/dev/null; then
        rm -rf "$tmp"
        return 1
    fi

    # Extract, find the gum binary (layout varies slightly across releases)
    tar -xzf "$tarball" -C "$tmp" 2>/dev/null || { rm -rf "$tmp"; return 1; }
    local bin
    bin="$(find "$tmp" -type f -name gum -perm +111 2>/dev/null | head -n 1)"
    [[ -z "$bin" ]] && bin="$(find "$tmp" -type f -name gum | head -n 1)"
    [[ -z "$bin" ]] && { rm -rf "$tmp"; return 1; }

    mkdir -p "$GUM_CACHE_DIR"
    mv "$bin" "$GUM_CACHE_DIR/gum"
    chmod +x "$GUM_CACHE_DIR/gum"
    rm -rf "$tmp"

    GUM="$GUM_CACHE_DIR/gum"
    return 0
}

# ──── Fallback primitives (plain bash, oh-my-zsh style) ────────────────────

fmt_setup() {
    if [[ -t 1 ]]; then
        FMT_RESET=$(printf '\033[0m')
        FMT_BOLD=$(printf '\033[1m')
        FMT_DIM=$(printf '\033[2m')
        FMT_BRAND=$(printf '\033[38;5;141m')
        FMT_GREEN=$(printf '\033[32m')
        FMT_YELLOW=$(printf '\033[33m')
        FMT_MUTED=$(printf '\033[38;5;244m')
    else
        FMT_RESET=""; FMT_BOLD=""; FMT_DIM=""
        FMT_BRAND=""; FMT_GREEN=""; FMT_YELLOW=""; FMT_MUTED=""
    fi
}

# ui_header step/total title
ui_header() {
    local num="$1" total="$2" title="$3"
    if [[ -n "$GUM" ]]; then
        "$GUM" style \
            --border rounded --border-foreground 141 \
            --padding "0 2" --margin "1 0 0 0" \
            --foreground 141 --bold \
            "Step $num/$total  │  $title"
    else
        printf '\n%s┌──  Step %s/%s  │  %s ──┐%s\n\n' \
            "$FMT_BRAND$FMT_BOLD" "$num" "$total" "$title" "$FMT_RESET"
    fi
}

ui_ok()    { printf '  %s✓%s %s\n' "$FMT_GREEN" "$FMT_RESET" "$1"; }
ui_warn()  { printf '  %s!%s %s\n' "$FMT_YELLOW" "$FMT_RESET" "$1"; }
ui_muted() { printf '  %s%s%s\n' "$FMT_MUTED" "$1" "$FMT_RESET"; }

# ui_confirm "question" default(Y|N)
ui_confirm() {
    local q="$1" default="${2:-Y}"
    if [[ -n "$GUM" ]]; then
        local args=(confirm "$q" --selected.background 141)
        [[ "$default" == "N" ]] && args+=(--default=false)
        "$GUM" "${args[@]}"
        return $?
    fi
    local hint reply
    [[ "$default" == "Y" ]] && hint="[Y/n]" || hint="[y/N]"
    printf '  %s?%s %s %s%s%s ' \
        "$FMT_BRAND$FMT_BOLD" "$FMT_RESET" "$q" "$FMT_MUTED" "$hint" "$FMT_RESET"
    read -r reply
    reply="${reply:-$default}"
    [[ "$reply" =~ ^[Yy] ]]
}

# ui_choose "header" "default" item1 item2 …
# Arrow keys + Tab + Enter when gum is available.
# Prints choice to stdout.
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
    # Plain numbered fallback
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

# ui_input "prompt"
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

# ui_spin "label" cmd…
ui_spin() {
    local label="$1"; shift
    if [[ -n "$GUM" ]]; then
        "$GUM" spin --spinner dot --title "$label" --title.foreground 141 -- "$@"
        return
    fi
    "$@"
}

# ──── Simulated state ──────────────────────────────────────────────────────

FAKE_INSTALLED=(
    "qwen/qwen3-coder-30b"
    "google/gemma-3-12b"
    "deepseek/deepseek-coder-v2-lite-16b"
    "meta/llama-3.1-8b-instruct"
)
DEFAULT_IMPL="qwen/qwen3-coder-30b"
DEFAULT_REVIEW="google/gemma-3-12b"
DEFAULT_DEEP="qwen/qwen3-coder-30b"

# ──── Flow ─────────────────────────────────────────────────────────────────

fmt_setup

if ! ensure_gum; then
    ui_warn "Falling back to plain prompts (gum unavailable)."
else
    ui_muted "Using TUI helper: $GUM"
fi

# Big banner
if [[ -n "$GUM" ]]; then
    "$GUM" style --align center --width 72 --margin "1 0" --padding "1 2" \
        --border double --border-foreground 141 --foreground 141 --bold \
        "gor-mobile init — install wizard"
else
    printf '\n  %sgor-mobile init — install wizard%s\n\n' \
        "$FMT_BRAND$FMT_BOLD" "$FMT_RESET"
fi
ui_muted "Prototype: simulating step 3/12 (LM Studio + model picker)."

ui_header "3" "12" "LM Studio + local models"

ui_ok "lms CLI detected → /opt/homebrew/bin/lms"
ui_ok "Found ${#FAKE_INSTALLED[@]} installed LLM(s)"
printf '\n'
ui_muted "Installed models:"
for m in "${FAKE_INSTALLED[@]}"; do
    printf '    %s•%s %s\n' "$FMT_MUTED" "$FMT_RESET" "$m"
done
printf '\n'

if ui_confirm "Customize per-role model assignment?" "N"; then
    # In gum, user can Tab/arrow between items. In fallback, numbered prompt.
    CHOICE_IMPL="$(ui_choose   "Pick a model for role: impl   (default: $DEFAULT_IMPL)"   "$DEFAULT_IMPL"   "${FAKE_INSTALLED[@]}" "— enter custom model id —")"
    [[ "$CHOICE_IMPL" == *"custom model id"* ]] && CHOICE_IMPL="$(ui_input "Custom model id")"

    CHOICE_REVIEW="$(ui_choose "Pick a model for role: review (default: $DEFAULT_REVIEW)" "$DEFAULT_REVIEW" "${FAKE_INSTALLED[@]}" "— enter custom model id —")"
    [[ "$CHOICE_REVIEW" == *"custom model id"* ]] && CHOICE_REVIEW="$(ui_input "Custom model id")"

    CHOICE_DEEP="$(ui_choose   "Pick a model for role: deep   (default: $DEFAULT_DEEP)"   "$DEFAULT_DEEP"   "${FAKE_INSTALLED[@]}" "— enter custom model id —")"
    [[ "$CHOICE_DEEP" == *"custom model id"* ]] && CHOICE_DEEP="$(ui_input "Custom model id")"
else
    CHOICE_IMPL="$DEFAULT_IMPL"
    CHOICE_REVIEW="$DEFAULT_REVIEW"
    CHOICE_DEEP="$DEFAULT_DEEP"
fi

# Summary
printf '\n'
if [[ -n "$GUM" ]]; then
    "$GUM" style --border normal --border-foreground 42 \
        --padding "1 2" --margin "1 0" \
        --foreground 42 --bold "Role → model assignment"
fi
printf '  impl    → %s\n' "$CHOICE_IMPL"
printf '  review  → %s\n' "$CHOICE_REVIEW"
printf '  deep    → %s\n' "$CHOICE_DEEP"

# Download demo
MISSING=("qwen/qwen3-coder-72b-instruct")
printf '\n'
ui_warn "Missing: ${MISSING[*]}"
if ui_confirm "Download missing models via 'lms get'?  [~15-30 GB each]" "Y"; then
    for m in "${MISSING[@]}"; do
        ui_spin "Pulling $m …" sleep 2.5
        ui_ok "$m pulled"
    done
else
    ui_warn "Skipped. Pull later via: lms get <model-id>"
fi

printf '\n  %s✔ Step 3 complete.%s\n' "$FMT_GREEN$FMT_BOLD" "$FMT_RESET"
ui_muted "(In real wizard: step 4/12 settings.json merge…)"
printf '\n'
