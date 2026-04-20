#!/usr/bin/env bash
# gor-mobile doctor — environment diagnostic.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/detect-deps.sh
source "$GOR_MOBILE_ROOT/lib/helpers/detect-deps.sh"
# shellcheck source=../helpers/lm-studio.sh
source "$GOR_MOBILE_ROOT/lib/helpers/lm-studio.sh"

_check_file() {
    local path="$1" label="$2"
    if [[ -e "$path" ]]; then
        log_ok "$label → $path"
        return 0
    fi
    log_warn "$label missing ($path)"
    return 1
}

_check_hook() {
    if [[ ! -f "$CLAUDE_SETTINGS" ]]; then
        log_warn "No $CLAUDE_SETTINGS"
        return 1
    fi
    if jq -e '.hooks.SessionStart[]? | select(._managed_by == "gor-mobile")' \
            "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
        log_ok "SessionStart hook registered"
        return 0
    fi
    log_warn "SessionStart hook NOT registered — run 'gor-mobile repair'"
    return 1
}

_check_claude_md_section() {
    if [[ ! -f "$CLAUDE_CLAUDE_MD" ]]; then
        log_warn "$CLAUDE_CLAUDE_MD does not exist"
        return 1
    fi
    if grep -qF "$GOR_MOBILE_SECTION_BEGIN" "$CLAUDE_CLAUDE_MD"; then
        log_ok "CLAUDE.md managed section present"
        return 0
    fi
    log_warn "CLAUDE.md managed section missing — run 'gor-mobile repair'"
    return 1
}

_check_rules() {
    if [[ ! -d "$GOR_MOBILE_RULES_DIR" ]]; then
        log_warn "Rules pack not installed ($GOR_MOBILE_RULES_DIR)"
        return 1
    fi
    local manifest="$GOR_MOBILE_RULES_DIR/manifest.json"
    if [[ ! -f "$manifest" ]]; then
        log_warn "manifest.json missing in rules pack"
        return 1
    fi
    local version; version="$(jq -r '.version // "?"' "$manifest")"
    local stack; stack="$(jq -r '.stack // "?"' "$manifest")"
    log_ok "Rules pack v$version (stack=$stack) at $GOR_MOBILE_RULES_DIR"
}

_check_lm_studio() {
    if ! dep_lms_path >/dev/null 2>&1; then
        log_warn "lms CLI not installed (optional)"
        return 1
    fi
    log_ok "lms → $(dep_lms_path)"
    if curl -sf --max-time 2 "$LLM_URL" >/dev/null 2>&1 || lm_server_up; then
        local loaded; loaded="$(lm_loaded_identifier 2>/dev/null || true)"
        log_ok "LM Studio server reachable ($LLM_URL) — loaded=${loaded:-none}"
    else
        log_warn "LM Studio server at $LLM_URL not reachable (local-LLM scripts will fall back to BLOCKED)"
    fi
}

_check_scripts() {
    local dir="$GOR_MOBILE_HOME/scripts"
    if [[ ! -d "$dir" ]]; then
        log_warn "$dir missing — run 'gor-mobile repair'"
        return 1
    fi
    local s missing=0
    for s in llm-config llm-agent llm-implement llm-review llm-analyze llm-check llm-unload; do
        local f="$dir/${s}.sh"
        if [[ ! -f "$f" ]]; then
            log_warn "missing $f"
            missing=1
        elif [[ ! -x "$f" ]]; then
            log_warn "not executable: $f"
            missing=1
        fi
    done
    if [[ $missing -eq 0 ]]; then
        log_ok "LLM scripts → $dir (7 files, executable)"
    fi
}

cmd_doctor() {
    log_step "Environment"
    dep_report "brew"     "$(command -v brew    || true)" optional
    dep_report "git"      "$(command -v git     || true)" required
    dep_report "curl"     "$(command -v curl    || true)" required
    dep_report "jq"       "$(command -v jq      || true)" required
    dep_report "python3"  "$(command -v python3 || true)" required
    dep_report "android"  "$(dep_android_cli_path || true)" optional

    log_step "Claude Code integration"
    _check_file "$CLAUDE_SETTINGS" "settings.json"
    _check_hook || true
    _check_file "$CLAUDE_AGENTS_DIR"   "agents/"
    _check_file "$CLAUDE_MCP"          "mcp.json"
    _check_claude_md_section || true

    log_step "LLM scripts"
    _check_scripts || true

    log_step "Rules pack"
    _check_rules || true

    log_step "LM Studio"
    _check_lm_studio || true

    log_step "Config"
    _check_file "$GOR_MOBILE_CONFIG"  "config.json" || true
    _check_file "$GOR_MOBILE_SECRETS" "secrets.env" || true

    printf "\n"
    log_info "If anything is missing, run: gor-mobile repair"
}
