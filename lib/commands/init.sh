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
# shellcheck source=../helpers/ui.sh
source "$GOR_MOBILE_ROOT/lib/helpers/ui.sh"

DRY_RUN=0
ASSUME_YES=0
SKIP_SANITY=0
RULES_URL=""
NO_TUI="${NO_TUI:-0}"
export ASSUME_YES NO_TUI

_parse_init_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)      DRY_RUN=1 ;;
            --yes|-y)       ASSUME_YES=1; export ASSUME_YES ;;
            --skip-sanity)  SKIP_SANITY=1 ;;
            --no-tui)       NO_TUI=1; export NO_TUI ;;
            --rules)        RULES_URL="${2:-}"; shift ;;
            -h|--help)      _init_usage; exit 0 ;;
            *) ui_warn "Unknown arg: $1" ;;
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
  --skip-sanity   Skip the final summary step
  --no-tui        Force plain-text prompts (skip gum TUI even if available)
  --rules <url>   Use a custom rules-pack git URL (default: $DEFAULT_RULES_URL)
EOF
}

_confirm() {
    ui_confirm "$1" "N"
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
    ui_header "1" "10" "Checking base dependencies"
    local missing=()
    for bin in git curl jq; do
        if dep_has "$bin"; then
            ui_ok "$bin → $(command -v "$bin")"
        else
            missing+=("$bin")
            ui_err "$bin not found"
        fi
    done
    if ! dep_has brew; then
        ui_warn "Homebrew not found. On macOS, install from https://brew.sh"
    else
        ui_ok "brew → $(command -v brew)"
    fi
    if (( ${#missing[@]} )); then
        ui_err "Install missing deps first: ${missing[*]}"
        exit 1
    fi
}

step_2_android_cli() {
    ui_header "2" "10" "Android CLI"
    if dep_android_cli_path >/dev/null 2>&1; then
        ui_ok "android CLI → $(dep_android_cli_path)"
        return
    fi

    cat >&2 <<EOF

  Google Android CLI agent is not installed.

  What it is:
    An official Google CLI that gives AI agents structured access to the
    Android toolchain — build, install, run, inspect, manage SDK — without
    the agent needing to shell out to adb/gradle directly.

  Why gor-mobile needs it:
    Slash-commands like /implement call through to this CLI for anything
    that touches the project or a connected device. Missing it means those
    commands will fail or degrade to a gradle fallback.

  Install page:
    https://developer.android.com/tools/agents

EOF

    if [[ $ASSUME_YES -eq 1 ]]; then
        ui_warn "Skipping Android CLI install (--yes). Install manually and re-run 'gor-mobile init'."
        return
    fi

    if ! _confirm "Open the install page in your browser now?"; then
        ui_warn "Install manually from https://developer.android.com/tools/agents, then re-run 'gor-mobile init'."
        return
    fi

    if command -v open >/dev/null 2>&1; then
        _run "open 'https://developer.android.com/tools/agents'"
    elif command -v xdg-open >/dev/null 2>&1; then
        _run "xdg-open 'https://developer.android.com/tools/agents'"
    else
        ui_info "Couldn't auto-open a browser — visit the URL above manually."
    fi

    printf "\n  Press Enter once the installer finishes (Ctrl-C to abort)..." >&2
    read -r _
    if dep_android_cli_path >/dev/null 2>&1; then
        ui_ok "android CLI → $(dep_android_cli_path)"
    else
        ui_warn "Still not detected. You may need a new shell (PATH not picked up yet). Re-run 'gor-mobile init' later."
    fi
}

step_3_secrets() {
    ui_header "3" "10" "API keys"
    _run "mkdir -p \"$GOR_MOBILE_CONFIG_DIR\""
    if [[ -f "$GOR_MOBILE_SECRETS" ]]; then
        ui_ok "secrets file exists at $GOR_MOBILE_SECRETS"
        return
    fi
    cat <<'EOF' > "/tmp/gor-mobile-secrets.tpl"
# gor-mobile secrets — chmod 600. Only user-readable.
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=...
EOF
    _run "cp /tmp/gor-mobile-secrets.tpl \"$GOR_MOBILE_SECRETS\""
    _run "chmod 600 \"$GOR_MOBILE_SECRETS\""
    ui_ok "Secrets template at $GOR_MOBILE_SECRETS (edit manually)"
}

step_4_rules_pack() {
    ui_header "4" "10" "Rules pack"
    local url="${RULES_URL:-$DEFAULT_RULES_URL}"
    if [[ -d "$GOR_MOBILE_RULES_DIR/.git" ]]; then
        ui_ok "Rules pack already present at $GOR_MOBILE_RULES_DIR"
        _run "git -C \"$GOR_MOBILE_RULES_DIR\" pull --ff-only || true"
    else
        _run "rm -rf \"$GOR_MOBILE_RULES_DIR\""
        _run "git clone --depth 1 --branch \"$DEFAULT_RULES_REF\" \"$url\" \"$GOR_MOBILE_RULES_DIR\" || { ui_warn 'Git clone failed — falling back to bundled minimal rules'; cp -r \"$GOR_MOBILE_ROOT/rules-default\" \"$GOR_MOBILE_RULES_DIR\"; }"
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

step_5_settings_hook() {
    ui_header "5" "10" "SessionStart + UserPromptSubmit hooks"
    _run "mkdir -p \"$GOR_MOBILE_HOME/templates\""
    _run "cp \"$GOR_MOBILE_ROOT/templates/session-start-hook.sh\" \"$GOR_MOBILE_HOME/templates/\""
    _run "chmod +x \"$GOR_MOBILE_HOME/templates/session-start-hook.sh\""
    _run "cp \"$GOR_MOBILE_ROOT/templates/user-prompt-submit-hook.sh\" \"$GOR_MOBILE_HOME/templates/\""
    _run "chmod +x \"$GOR_MOBILE_HOME/templates/user-prompt-submit-hook.sh\""
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] merge SessionStart + UserPromptSubmit hooks into %s\n" "$CLAUDE_SETTINGS"
    else
        settings_install_session_start_hook
        settings_install_user_prompt_submit_hook
        ui_ok "SessionStart + UserPromptSubmit hooks merged into $CLAUDE_SETTINGS"
    fi
}

step_6_skills() {
    ui_header "6" "10" "Skills → ~/.claude/skills/gor-mobile-*/"
    _run "mkdir -p \"$CLAUDE_SKILLS_DIR\""
    local d
    for d in "$GOR_MOBILE_ROOT"/templates/skills/*/; do
        [[ -d "$d" ]] || continue
        local skill_name; skill_name="$(basename "$d")"
        local dst="$CLAUDE_SKILLS_DIR/gor-mobile-$skill_name"
        local overlay="$GOR_MOBILE_ROOT/templates/overlays/$skill_name.md"
        if [[ $DRY_RUN -eq 1 ]]; then
            printf "  [dry-run] install skill %s (sed + overlay=%s)\n" \
                "$skill_name" "$([[ -f $overlay ]] && echo yes || echo no)"
            continue
        fi
        rm -rf "$dst"
        cp -R "${d%/}" "$dst"
        if [[ -f "$dst/SKILL.md" ]]; then
            local tmp; tmp="$(mktemp)"
            sed -e 's/superpowers:/gor-mobile-/g' \
                -e 's/^name: /name: gor-mobile-/' \
                -e 's/"Invoke brainstorming skill"/"Invoke gor-mobile-brainstorming skill"/g' \
                -e 's/"Invoke writing-plans skill"/"Invoke gor-mobile-writing-plans skill"/g' \
                -e 's#~/.config/superpowers/worktrees#~/.config/gor-mobile/worktrees#g' \
                -e 's/all 5 tasks/all tasks/g' \
                -e 's#docs/superpowers/specs/#.gor-mobile/specs/#g' \
                -e 's#docs/superpowers/plans/#.gor-mobile/plans/#g' \
                "$dst/SKILL.md" > "$tmp"
            mv "$tmp" "$dst/SKILL.md"
            if [[ -f "$overlay" ]]; then
                printf '\n' >> "$dst/SKILL.md"
                cat "$overlay" >> "$dst/SKILL.md"
            fi
        fi
    done
    ui_ok "Installed skills (verbatim superpowers + sed + overlay-append)"
}

step_7_agents() {
    ui_header "7" "10" "Agents → ~/.claude/agents/"
    _run "mkdir -p \"$CLAUDE_AGENTS_DIR\""
    local src dst base
    for src in "$GOR_MOBILE_ROOT"/templates/agents/*.md; do
        [[ -f "$src" ]] || continue
        base="$(basename "$src")"
        dst="$CLAUDE_AGENTS_DIR/$base"
        if [[ $DRY_RUN -eq 1 ]]; then
            printf "  [dry-run] install %s -> %s\n" "$src" "$dst"
        else
            install -m 0644 "$src" "$dst"
        fi
    done
    ui_ok "Copied agents from templates/agents/"
}

step_8_mcp() {
    ui_header "8" "10" "MCP registration"
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] register google-dev-knowledge in %s\n" "$CLAUDE_MCP"
    else
        mcp_register_google_dev_knowledge
    fi
}

step_9_claude_md() {
    ui_header "9" "10" "CLAUDE.md managed section"
    if [[ $DRY_RUN -eq 1 ]]; then
        printf "  [dry-run] merge managed section into %s\n" "$CLAUDE_CLAUDE_MD"
    else
        claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"
        ui_ok "Managed section written to $CLAUDE_CLAUDE_MD"
    fi
}

step_10_summary() {
    ui_header "10" "10" "Summary"
    if [[ $SKIP_SANITY -eq 1 ]]; then
        ui_info "Skipped (--skip-sanity)"
        return
    fi
    local skills_count=0 agents_count=0
    if [[ -d "$CLAUDE_SKILLS_DIR" ]]; then
        skills_count="$(find "$CLAUDE_SKILLS_DIR" -maxdepth 1 -type d -name 'gor-mobile-*' 2>/dev/null | wc -l | tr -d ' ')"
    fi
    if [[ -d "$CLAUDE_AGENTS_DIR" ]]; then
        agents_count="$(find "$CLAUDE_AGENTS_DIR" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
    fi
    ui_ok "Skills installed: $skills_count"
    ui_ok "Agents installed: $agents_count"
    if [[ -f "$GOR_MOBILE_RULES_DIR/manifest.json" ]]; then
        local version
        version="$(jq -r '.version // "?"' "$GOR_MOBILE_RULES_DIR/manifest.json" 2>/dev/null || echo "?")"
        ui_ok "Rules pack v$version at $GOR_MOBILE_RULES_DIR"
    else
        ui_warn "Rules pack manifest missing at $GOR_MOBILE_RULES_DIR"
    fi
}

cmd_init() {
    _parse_init_args "$@"
    ensure_gum || true
    ui_banner "gor-mobile init — v$GOR_MOBILE_VERSION"
    [[ $DRY_RUN -eq 1 ]] && ui_info "DRY RUN — no changes will be made"

    step_1_deps
    step_2_android_cli
    step_3_secrets
    step_4_rules_pack
    step_5_settings_hook
    step_6_skills
    step_7_agents
    step_8_mcp
    step_9_claude_md
    step_10_summary

    ui_header "✓" "10" "Done"
    ui_ok "Run 'gor-mobile doctor' anytime to verify the setup."
}
