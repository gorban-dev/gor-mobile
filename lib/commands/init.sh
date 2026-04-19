#!/usr/bin/env bash
# gor-mobile init — install wizard. Idempotent; re-running fixes drift.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/detect-deps.sh
source "$GOR_MOBILE_ROOT/lib/helpers/detect-deps.sh"
# shellcheck source=../helpers/settings-merge.sh
source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"
# shellcheck source=../helpers/claude-md-section.sh
source "$GOR_MOBILE_ROOT/lib/helpers/claude-md-section.sh"
# shellcheck source=../helpers/mcp-register.sh
source "$GOR_MOBILE_ROOT/lib/helpers/mcp-register.sh"
# shellcheck source=../helpers/lm-studio.sh
source "$GOR_MOBILE_ROOT/lib/helpers/lm-studio.sh"

DRY_RUN=0
ASSUME_YES=0
SKIP_SANITY=0
RULES_URL=""

_parse_init_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)      DRY_RUN=1 ;;
            --yes|-y)       ASSUME_YES=1 ;;
            --skip-sanity)  SKIP_SANITY=1 ;;
            --rules)        RULES_URL="${2:-}"; shift ;;
            -h|--help)      _init_usage; exit 0 ;;
            *) log_warn "Unknown arg: $1" ;;
        esac
        shift
    done
}

_init_usage() {
    cat <<EOF
gor-mobile init — install wizard

Options:
  --dry-run       Print planned actions; do not modify the filesystem
  --yes, -y       Assume 'yes' to all prompts (non-interactive)
  --skip-sanity   Skip the final LM Studio round-trip test
  --rules <url>   Use a custom rules-pack git URL (default: $DEFAULT_RULES_URL)
EOF
}

_confirm() {
    [[ $ASSUME_YES -eq 1 ]] && return 0
    local prompt="$1 [y/N] " reply
    read -r -p "$prompt" reply
    [[ "$reply" =~ ^[yY]$ ]]
}

_run() {
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] %s\n" "$*"
    else
        eval "$@"
    fi
}

# ──── Steps ────────────────────────────────────────────────────────────────

step_1_deps() {
    log_step "1/11 Checking base dependencies"
    local missing=()
    for bin in git curl jq; do
        if dep_has "$bin"; then
            log_ok "$bin → $(command -v "$bin")"
        else
            missing+=("$bin")
            log_err "$bin not found"
        fi
    done
    if ! dep_has brew; then
        log_warn "Homebrew not found. On macOS, install from https://brew.sh"
    else
        log_ok "brew → $(command -v brew)"
    fi
    if (( ${#missing[@]} )); then
        log_err "Install missing deps first: ${missing[*]}"
        exit 1
    fi
}

step_2_android_cli() {
    log_step "2/11 Android CLI"
    if dep_android_cli_path >/dev/null 2>&1; then
        log_ok "android CLI → $(dep_android_cli_path)"
        return
    fi
    if dep_has brew && _confirm "Install Google Android CLI via 'brew install --cask android-platform-tools'?"; then
        _run "brew install --cask android-platform-tools"
    else
        log_warn "Skipping Android CLI install (optional)"
    fi
}

step_3_lm_studio() {
    log_step "3/11 LM Studio + local models"
    if dep_lms_path >/dev/null 2>&1; then
        log_ok "lms → $(dep_lms_path)"
    elif dep_has brew && _confirm "Install LM Studio via 'brew install --cask lm-studio'?"; then
        _run "brew install --cask lm-studio"
    else
        log_warn "Skipping LM Studio install (optional, but required for local inference)"
        return
    fi

    if ! _confirm "Pull default local models ($MODEL_QWEN_CODER, $MODEL_GEMMA_A4B)? [~50 GB total]"; then
        log_warn "Skipping model download. You can pull later via: lms get <model-id>"
        return
    fi
    local lms_bin
    if ! lms_bin="$(dep_lms_path 2>/dev/null)"; then
        log_warn "lms CLI not available — skip model download. Install LM Studio and rerun 'gor-mobile init'."
        return
    fi
    _run "\"$lms_bin\" get \"$MODEL_QWEN_CODER\" --yes || true"
    _run "\"$lms_bin\" get \"$MODEL_GEMMA_A4B\"    --yes || true"
}

step_4_secrets() {
    log_step "4/11 API keys"
    _run "mkdir -p \"$GOR_MOBILE_CONFIG_DIR\""
    if [[ -f "$GOR_MOBILE_SECRETS" ]]; then
        log_ok "secrets file exists at $GOR_MOBILE_SECRETS"
        return
    fi
    cat <<'EOF' > "/tmp/gor-mobile-secrets.tpl"
# gor-mobile secrets — chmod 600. Only user-readable.
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=...
EOF
    _run "cp /tmp/gor-mobile-secrets.tpl \"$GOR_MOBILE_SECRETS\""
    _run "chmod 600 \"$GOR_MOBILE_SECRETS\""
    log_ok "Secrets template at $GOR_MOBILE_SECRETS (edit manually)"
}

step_5_rules_pack() {
    log_step "5/11 Rules pack"
    local url="${RULES_URL:-$DEFAULT_RULES_URL}"
    if [[ -d "$GOR_MOBILE_RULES_DIR/.git" ]]; then
        log_ok "Rules pack already present at $GOR_MOBILE_RULES_DIR"
        _run "git -C \"$GOR_MOBILE_RULES_DIR\" pull --ff-only || true"
    else
        _run "rm -rf \"$GOR_MOBILE_RULES_DIR\""
        _run "git clone --depth 1 --branch \"$DEFAULT_RULES_REF\" \"$url\" \"$GOR_MOBILE_RULES_DIR\" || { log_warn 'Git clone failed — falling back to bundled minimal rules'; cp -r \"$GOR_MOBILE_ROOT/rules-default\" \"$GOR_MOBILE_RULES_DIR\"; }"
    fi
    _save_config "$url"
}

_save_config() {
    local url="$1"
    _run "mkdir -p \"$GOR_MOBILE_CONFIG_DIR\""
    local json; json=$(jq -n \
        --arg url "$url" \
        --arg ref "$DEFAULT_RULES_REF" \
        '{rules_source: $url, rules_ref: $ref, preset: "balanced"}')
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] write config %s: %s\n" "$GOR_MOBILE_CONFIG" "$json"
    else
        printf '%s\n' "$json" > "$GOR_MOBILE_CONFIG"
    fi
}

step_6_settings_hook() {
    log_step "6/11 SessionStart hook → ~/.claude/settings.json"
    _run "mkdir -p \"$GOR_MOBILE_HOME/templates\""
    _run "cp \"$GOR_MOBILE_ROOT/templates/session-start-hook.sh\" \"$GOR_MOBILE_HOME/templates/\""
    _run "cp \"$GOR_MOBILE_ROOT/templates/session-start-snippet.md\" \"$GOR_MOBILE_HOME/templates/\""
    _run "chmod +x \"$GOR_MOBILE_HOME/templates/session-start-hook.sh\""
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] merge SessionStart hook into %s\n" "$CLAUDE_SETTINGS"
    else
        settings_install_session_start_hook
        log_ok "SessionStart hook merged into $CLAUDE_SETTINGS"
    fi
}

step_7_commands() {
    log_step "7/11 Commands → ~/.claude/commands/"
    _run "mkdir -p \"$CLAUDE_COMMANDS_DIR\""
    local f
    for f in "$GOR_MOBILE_ROOT"/templates/commands/*.md; do
        [[ -f "$f" ]] || continue
        local dst="$CLAUDE_COMMANDS_DIR/$(basename "$f")"
        _run "cp \"$f\" \"$dst\""
    done
    log_ok "Copied command templates"
}

step_8_agents() {
    log_step "8/11 Agents → ~/.claude/agents/"
    _run "mkdir -p \"$CLAUDE_AGENTS_DIR\""
    local f
    for f in "$GOR_MOBILE_ROOT"/templates/agents/*.md; do
        [[ -f "$f" ]] || continue
        local dst="$CLAUDE_AGENTS_DIR/$(basename "$f")"
        _run "cp \"$f\" \"$dst\""
    done
    log_ok "Copied agents"
}

step_9_mcp() {
    log_step "9/11 MCP registration"
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] register google-dev-knowledge in %s\n" "$CLAUDE_MCP"
    else
        mcp_register_google_dev_knowledge
    fi
}

step_10_claude_md() {
    log_step "10/11 CLAUDE.md managed section"
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] merge managed section into %s\n" "$CLAUDE_CLAUDE_MD"
    else
        claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"
        log_ok "Managed section written to $CLAUDE_CLAUDE_MD"
    fi
}

step_11_sanity() {
    log_step "11/11 Sanity check"
    if [[ $SKIP_SANITY -eq 1 ]]; then
        log_info "Skipped (--skip-sanity)"
        return
    fi
    if ! dep_lms_path >/dev/null 2>&1; then
        log_warn "lms not installed — skipping LM Studio sanity"
        return
    fi
    if ! lm_server_up; then
        log_info "LM Studio server is down — start it manually or re-run 'gor-mobile init'"
        return
    fi
    local models; models="$(curl -sS "$LLM_URL/v1/models" 2>/dev/null | jq -r '.data[].id' 2>/dev/null | head -5)"
    if [[ -n "$models" ]]; then
        log_ok "LM Studio reachable — models: $(echo "$models" | tr '\n' ' ')"
    else
        log_warn "LM Studio server reachable, but no models loaded"
    fi
}

cmd_init() {
    _parse_init_args "$@"
    log_step "gor-mobile init (v$GOR_MOBILE_VERSION)"
    [[ $DRY_RUN -eq 1 ]] && log_info "DRY RUN — no changes will be made"

    step_1_deps
    step_2_android_cli
    step_3_lm_studio
    step_4_secrets
    step_5_rules_pack
    step_6_settings_hook
    step_7_commands
    step_8_agents
    step_9_mcp
    step_10_claude_md
    step_11_sanity

    log_step "Done"
    log_ok "Run 'gor-mobile doctor' anytime to verify the setup."
}
