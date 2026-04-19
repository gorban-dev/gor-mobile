#!/usr/bin/env bash
# gor-mobile rules — manage the rules pack (git-based).

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"

_rules_usage() {
    cat <<EOF
gor-mobile rules — manage the rules pack

  rules list              Show installed pack + source + version
  rules use <url|path>    Switch to a pack (git URL or local dir)
  rules update            git pull the current pack
  rules diff              Show diff vs upstream
  rules validate          Check manifest.json and compatibility
EOF
}

_rules_read_manifest() {
    local key="$1"
    local m="$GOR_MOBILE_RULES_DIR/manifest.json"
    [[ -f "$m" ]] || { echo ""; return 1; }
    jq -r ".$key // empty" "$m"
}

_rules_list() {
    if [[ ! -d "$GOR_MOBILE_RULES_DIR" ]]; then
        log_warn "No rules pack installed. Run: gor-mobile rules use <url>"
        return 1
    fi
    local name version stack source
    name="$(_rules_read_manifest name)"
    version="$(_rules_read_manifest version)"
    stack="$(_rules_read_manifest stack)"
    if [[ -f "$GOR_MOBILE_CONFIG" ]]; then
        source="$(jq -r '.rules_source // empty' "$GOR_MOBILE_CONFIG")"
    else
        source=""
    fi
    printf "Installed pack:\n"
    printf "  name:    %s\n" "${name:-?}"
    printf "  version: %s\n" "${version:-?}"
    printf "  stack:   %s\n" "${stack:-?}"
    printf "  source:  %s\n" "${source:-(unknown)}"
    printf "  path:    %s\n" "$GOR_MOBILE_RULES_DIR"
    if [[ -d "$GOR_MOBILE_RULES_DIR/.git" ]]; then
        local branch rev
        branch="$(git -C "$GOR_MOBILE_RULES_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)"
        rev="$(git -C "$GOR_MOBILE_RULES_DIR" rev-parse --short HEAD 2>/dev/null)"
        printf "  git:     %s @ %s\n" "$branch" "$rev"
    fi
}

_rules_use() {
    local target="$1"
    if [[ -z "$target" ]]; then
        log_err "Usage: gor-mobile rules use <url|path>"
        return 1
    fi

    mkdir -p "$(dirname "$GOR_MOBILE_RULES_DIR")"
    if [[ -d "$GOR_MOBILE_RULES_DIR" ]]; then
        log_info "Backing up existing pack to ${GOR_MOBILE_RULES_DIR}.bak"
        rm -rf "${GOR_MOBILE_RULES_DIR}.bak"
        mv "$GOR_MOBILE_RULES_DIR" "${GOR_MOBILE_RULES_DIR}.bak"
    fi

    if [[ -d "$target" ]]; then
        log_info "Copying local pack from $target"
        cp -R "$target" "$GOR_MOBILE_RULES_DIR"
    else
        log_info "Cloning $target"
        if ! git clone --depth 1 "$target" "$GOR_MOBILE_RULES_DIR"; then
            log_err "Clone failed — restoring backup"
            rm -rf "$GOR_MOBILE_RULES_DIR"
            mv "${GOR_MOBILE_RULES_DIR}.bak" "$GOR_MOBILE_RULES_DIR"
            return 1
        fi
    fi

    mkdir -p "$GOR_MOBILE_CONFIG_DIR"
    local tmp; tmp="$(mktemp)"
    if [[ -f "$GOR_MOBILE_CONFIG" ]]; then
        jq --arg s "$target" '.rules_source = $s' "$GOR_MOBILE_CONFIG" > "$tmp"
    else
        jq -n --arg s "$target" '{rules_source: $s, rules_ref: "main", preset: "balanced"}' > "$tmp"
    fi
    mv "$tmp" "$GOR_MOBILE_CONFIG"

    log_ok "Rules pack installed at $GOR_MOBILE_RULES_DIR"
    rm -rf "${GOR_MOBILE_RULES_DIR}.bak"
    _rules_validate || true
}

_rules_update() {
    if [[ ! -d "$GOR_MOBILE_RULES_DIR/.git" ]]; then
        log_err "Current pack is not a git checkout — cannot pull"
        return 1
    fi
    git -C "$GOR_MOBILE_RULES_DIR" pull --ff-only
    log_ok "Rules pack updated"
}

_rules_diff() {
    if [[ ! -d "$GOR_MOBILE_RULES_DIR/.git" ]]; then
        log_err "Current pack is not a git checkout"
        return 1
    fi
    git -C "$GOR_MOBILE_RULES_DIR" fetch origin >/dev/null 2>&1 || true
    git -C "$GOR_MOBILE_RULES_DIR" diff HEAD origin/HEAD --stat || true
}

_rules_validate() {
    local m="$GOR_MOBILE_RULES_DIR/manifest.json"
    if [[ ! -f "$m" ]]; then
        log_err "manifest.json missing at $m"
        return 1
    fi
    if ! jq empty "$m" 2>/dev/null; then
        log_err "manifest.json is not valid JSON"
        return 1
    fi
    local version compat stack
    version="$(jq -r '.version // empty' "$m")"
    compat="$(jq -r '.compatible_with // empty' "$m")"
    stack="$(jq -r '.stack // empty' "$m")"
    [[ -z "$version" ]] && { log_err "manifest.version missing"; return 1; }
    [[ -z "$stack"   ]] && { log_err "manifest.stack missing";   return 1; }

    # Required files referenced from manifest.sections
    local missing=()
    while IFS= read -r rel; do
        [[ -z "$rel" ]] && continue
        [[ -f "$GOR_MOBILE_RULES_DIR/$rel" ]] || missing+=("$rel")
    done < <(jq -r '.sections | to_entries[] | .value' "$m")

    if (( ${#missing[@]} )); then
        log_err "Missing rule files referenced in manifest:"
        for f in "${missing[@]}"; do printf "  - %s\n" "$f"; done
        return 1
    fi
    log_ok "manifest.json valid (v$version, stack=$stack, compat=$compat)"
}

cmd_rules() {
    local sub="${1:-}"
    shift || true
    case "$sub" in
        list|ls)    _rules_list ;;
        use)        _rules_use "${1:-}" ;;
        update|up)  _rules_update ;;
        diff)       _rules_diff ;;
        validate)   _rules_validate ;;
        ""|help|-h|--help) _rules_usage ;;
        *) log_err "Unknown subcommand: $sub"; _rules_usage; exit 1 ;;
    esac
}
