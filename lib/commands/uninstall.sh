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

# Remove a legacy gor-mobile slash-command file iff its header still matches
# the template we shipped. If the user customized it, leave the file in place.
_uninstall_cleanup_legacy_commands() {
    [[ -d "$CLAUDE_COMMANDS_DIR" ]] || return 0
    local cmd f
    for cmd in brainstorm plan worktree implement execute parallel tdd review verify debug finishing-branch; do
        f="$CLAUDE_COMMANDS_DIR/$cmd.md"
        [[ -f "$f" ]] || continue
        if head -10 "$f" | grep -q 'Task from user: \*\*\$ARGUMENTS\*\*'; then
            rm -f "$f"
        else
            log_warn "$f diverged from gor-mobile template — remove manually if unused"
        fi
    done
}

cmd_uninstall() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes|-y) _assume_yes=1 ;;
        esac
        shift
    done

    if [[ $_assume_yes -ne 1 ]]; then
        printf "This will remove gor-mobile hooks, skills, agents, scripts, and the managed CLAUDE.md section.\n"
        printf "Rules pack at %s and secrets at %s will be kept.\n" "$GOR_MOBILE_RULES_DIR" "$GOR_MOBILE_SECRETS"
        read -r -p "Continue? [y/N] " reply
        [[ "$reply" =~ ^[yY]$ ]] || { log_info "Aborted"; exit 0; }
    fi

    log_step "Removing SessionStart hook"
    settings_remove_session_start_hook
    log_ok "SessionStart hook removed"

    log_step "Removing UserPromptSubmit hook"
    settings_remove_user_prompt_submit_hook
    log_ok "UserPromptSubmit hook removed"

    log_step "Removing legacy commands/ (signature-matched)"
    _uninstall_cleanup_legacy_commands

    log_step "Removing skills/"
    rm -rf "$CLAUDE_SKILLS_DIR"/gor-mobile-*

    log_step "Removing agents/"
    rm -f "$CLAUDE_AGENTS_DIR/gor-mobile-advisor.md" \
          "$CLAUDE_AGENTS_DIR/gor-mobile-code-reviewer.md"
    # 0.2.5 and earlier shipped unprefixed code-reviewer.md; drop it too.
    local legacy_cr="$CLAUDE_AGENTS_DIR/code-reviewer.md"
    if [[ -f "$legacy_cr" ]] && head -20 "$legacy_cr" | grep -q '^name: code-reviewer'; then
        rm -f "$legacy_cr"
    fi

    log_step "Removing LLM scripts/"
    rm -rf "$GOR_MOBILE_HOME/scripts"

    log_step "Removing MCP entries"
    mcp_unregister_managed

    log_step "Cleaning CLAUDE.md managed section"
    claude_md_remove_section

    log_ok "gor-mobile artifacts removed from ~/.claude/"
    log_info "To fully remove, also delete: $GOR_MOBILE_HOME and $GOR_MOBILE_CONFIG_DIR"
}
