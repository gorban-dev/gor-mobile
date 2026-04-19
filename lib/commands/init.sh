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
    log_warn "Google Android CLI agent not found."
    log_info "Install manually from: https://developer.android.com/tools/agents"
    log_info "After install, run 'android update' then re-run 'gor-mobile init'."
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

    local lms_bin
    if ! lms_bin="$(dep_lms_path 2>/dev/null)"; then
        log_warn "lms CLI not available — skip model setup. Install LM Studio and rerun 'gor-mobile init'."
        return
    fi

    # Snapshot installed LLMs
    local installed=()
    local raw; raw="$(lm_list_installed_llms)"
    if [[ -n "$raw" ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && installed+=("$line")
        done <<< "$raw"
    fi

    # Role → default mapping (kept in sync with constants.sh)
    local -a role_keys=(impl review deep)
    local -A role_defaults=(
        [impl]="$MODEL_DEFAULT_IMPL"
        [review]="$MODEL_DEFAULT_REVIEW"
        [deep]="$MODEL_DEFAULT_DEEP"
    )
    local -A role_choice=(
        [impl]="$MODEL_DEFAULT_IMPL"
        [review]="$MODEL_DEFAULT_REVIEW"
        [deep]="$MODEL_DEFAULT_DEEP"
    )

    if (( ${#installed[@]} > 0 )); then
        log_ok "Found ${#installed[@]} installed LLM(s):"
        local m
        for m in "${installed[@]}"; do
            printf "    • %s\n" "$m" >&2
        done
    else
        log_info "No LLMs installed yet — will pull defaults."
    fi

    # Interactive per-role selection if installed models exist and user confirms
    if (( ${#installed[@]} > 0 )) && [[ $ASSUME_YES -eq 0 ]] && \
       _confirm "Customize per-role model assignment from installed LLMs?"; then
        local r
        for r in "${role_keys[@]}"; do
            role_choice[$r]="$(_pick_model_for_role "$r" "${role_defaults[$r]}" "${installed[@]}")"
        done
    fi

    # Persist non-default choices to config.json
    _save_model_overrides \
        "${role_choice[impl]}"   "${role_defaults[impl]}" \
        "${role_choice[review]}" "${role_defaults[review]}" \
        "${role_choice[deep]}"   "${role_defaults[deep]}"

    # Identify models we need but don't have installed
    local -a wanted=() missing=() seen=()
    wanted+=("${role_choice[impl]}" "${role_choice[review]}" "${role_choice[deep]}")
    local w
    for w in "${wanted[@]}"; do
        [[ -z "$w" ]] && continue
        local already=0 s
        for s in "${seen[@]}"; do [[ "$s" == "$w" ]] && already=1; done
        (( already )) && continue
        seen+=("$w")
        local found=0 i
        for i in "${installed[@]}"; do [[ "$i" == "$w" ]] && found=1; done
        (( found )) || missing+=("$w")
    done

    if (( ${#missing[@]} == 0 )); then
        log_ok "All selected models are already installed."
        return
    fi

    log_info "Missing models: ${missing[*]}"
    if ! _confirm "Pull missing models via 'lms get'? [~15-30 GB each]"; then
        log_warn "Skipping model download. You can pull later via: lms get <model-id>"
        return
    fi
    local mm
    for mm in "${missing[@]}"; do
        _run "\"$lms_bin\" get \"$mm\" --yes || true"
    done
}

# _pick_model_for_role <role> <default> <installed-model...>
# Prints the chosen model id to stdout. Logs go to stderr.
_pick_model_for_role() {
    local role="$1" default="$2"
    shift 2
    local -a models=("$@")

    printf "\n  Role: %s (default: %s)\n" "$role" "$default" >&2
    local idx=1 m default_idx=0
    for m in "${models[@]}"; do
        local marker=""
        if [[ "$m" == "$default" ]]; then
            marker=" [default]"
            default_idx=$idx
        fi
        printf "    %2d) %s%s\n" "$idx" "$m" "$marker" >&2
        idx=$((idx + 1))
    done
    local custom_idx=$idx
    printf "    %2d) enter custom model id\n" "$custom_idx" >&2

    local prompt_default="${default_idx:-$custom_idx}"
    local reply
    read -r -p "  Choose [1-$custom_idx, default=$prompt_default]: " reply
    reply="${reply:-$prompt_default}"

    if [[ "$reply" =~ ^[0-9]+$ ]] && (( reply >= 1 && reply <= ${#models[@]} )); then
        echo "${models[$((reply - 1))]}"
        return
    fi
    if [[ "$reply" == "$custom_idx" ]]; then
        local custom
        read -r -p "  Custom model id: " custom
        if [[ -n "$custom" ]]; then
            echo "$custom"
            return
        fi
    fi
    echo "$default"
}

# _save_model_overrides <impl> <impl_default> <review> <review_default> <deep> <deep_default>
# Writes non-default role→model overrides to config.json, expanding each group role.
_save_model_overrides() {
    local impl="$1" impl_d="$2" review="$3" review_d="$4" deep="$5" deep_d="$6"

    local overrides="{}"
    if [[ "$impl" != "$impl_d" ]]; then
        overrides=$(jq -n --arg v "$impl" '{impl: $v, "tdd-red": $v, "routine-debug": $v}')
    fi
    if [[ "$review" != "$review_d" ]]; then
        overrides=$(jq -n --argjson base "$overrides" --arg v "$review" '$base + {review: $v, analyze: $v}')
    fi
    if [[ "$deep" != "$deep_d" ]]; then
        overrides=$(jq -n --argjson base "$overrides" --arg v "$deep" '$base + {"review-deep": $v, vision: $v}')
    fi

    local count; count=$(echo "$overrides" | jq 'length')
    if [[ "$count" == "0" ]]; then
        return
    fi

    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] write model overrides to %s: %s\n" "$GOR_MOBILE_CONFIG" "$overrides"
        return
    fi

    mkdir -p "$GOR_MOBILE_CONFIG_DIR"
    local tmp; tmp="$(mktemp)"
    if [[ -f "$GOR_MOBILE_CONFIG" ]]; then
        jq --argjson m "$overrides" '.models = ((.models // {}) + $m)' "$GOR_MOBILE_CONFIG" > "$tmp"
    else
        jq -n --argjson m "$overrides" '{models: $m}' > "$tmp"
    fi
    mv "$tmp" "$GOR_MOBILE_CONFIG"
    log_ok "Saved model overrides: $(echo "$overrides" | jq -c .)"
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
