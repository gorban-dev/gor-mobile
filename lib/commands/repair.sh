#!/usr/bin/env bash
# gor-mobile repair — restore managed files under ~/.claude/ (idempotent subset of init).

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/settings-merge.sh
source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"
# shellcheck source=../helpers/claude-md-section.sh
source "$GOR_MOBILE_ROOT/lib/helpers/claude-md-section.sh"
# shellcheck source=../helpers/mcp-register.sh
source "$GOR_MOBILE_ROOT/lib/helpers/mcp-register.sh"

cmd_repair() {
    log_step "Repairing ~/.claude/ managed files"

    mkdir -p "$GOR_MOBILE_HOME/templates"
    cp "$GOR_MOBILE_ROOT/templates/session-start-hook.sh"      "$GOR_MOBILE_HOME/templates/"
    cp "$GOR_MOBILE_ROOT/templates/session-start-snippet.md"   "$GOR_MOBILE_HOME/templates/"
    chmod +x "$GOR_MOBILE_HOME/templates/session-start-hook.sh"

    settings_install_session_start_hook
    log_ok "SessionStart hook refreshed"

    mkdir -p "$CLAUDE_COMMANDS_DIR" "$CLAUDE_AGENTS_DIR"
    for f in "$GOR_MOBILE_ROOT"/templates/commands/*.md; do
        [[ -f "$f" ]] || continue
        cp "$f" "$CLAUDE_COMMANDS_DIR/$(basename "$f")"
    done
    for f in "$GOR_MOBILE_ROOT"/templates/agents/*.md; do
        [[ -f "$f" ]] || continue
        cp "$f" "$CLAUDE_AGENTS_DIR/$(basename "$f")"
    done
    log_ok "Commands and agents refreshed"

    mcp_register_google_dev_knowledge || true
    claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"
    log_ok "CLAUDE.md managed section refreshed"

    log_ok "Done. Run 'gor-mobile doctor' to verify."
}
