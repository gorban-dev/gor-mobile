#!/usr/bin/env bash
# gor-mobile uninstall — remove everything the wizard installed, leave user config intact.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/settings-merge.sh
source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"
# shellcheck source=../helpers/claude-md-section.sh
source "$GOR_MOBILE_ROOT/lib/helpers/claude-md-section.sh"
# shellcheck source=../helpers/mcp-register.sh
source "$GOR_MOBILE_ROOT/lib/helpers/mcp-register.sh"

_assume_yes=0

cmd_uninstall() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes|-y) _assume_yes=1 ;;
        esac
        shift
    done

    if [[ $_assume_yes -ne 1 ]]; then
        printf "This will remove gor-mobile hooks, commands, agents, and the managed CLAUDE.md section.\n"
        printf "Rules pack at %s and secrets at %s will be kept.\n" "$GOR_MOBILE_RULES_DIR" "$GOR_MOBILE_SECRETS"
        read -r -p "Continue? [y/N] " reply
        [[ "$reply" =~ ^[yY]$ ]] || { log_info "Aborted"; exit 0; }
    fi

    log_step "Removing SessionStart hook"
    settings_remove_session_start_hook
    log_ok "Hook removed"

    log_step "Removing commands/"
    rm -f "$CLAUDE_COMMANDS_DIR/brainstorm.md" \
          "$CLAUDE_COMMANDS_DIR/plan.md" \
          "$CLAUDE_COMMANDS_DIR/implement.md" \
          "$CLAUDE_COMMANDS_DIR/tdd.md" \
          "$CLAUDE_COMMANDS_DIR/review.md" \
          "$CLAUDE_COMMANDS_DIR/verify.md" \
          "$CLAUDE_COMMANDS_DIR/debug.md" \
          "$CLAUDE_COMMANDS_DIR/finishing-branch.md"

    log_step "Removing agents/"
    rm -f "$CLAUDE_AGENTS_DIR/gor-mobile-advisor.md" \
          "$CLAUDE_AGENTS_DIR/code-reviewer.md"

    log_step "Removing MCP entries"
    mcp_unregister_managed

    log_step "Cleaning CLAUDE.md managed section"
    claude_md_remove_section

    log_ok "gor-mobile artifacts removed from ~/.claude/"
    log_info "To fully remove, also delete: $GOR_MOBILE_HOME and $GOR_MOBILE_CONFIG_DIR"
}
