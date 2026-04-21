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
_purge=0

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
            --purge)  _purge=1 ;;
        esac
        shift
    done

    if [[ $_assume_yes -ne 1 ]]; then
        printf "This will remove gor-mobile hooks, skills, agents, scripts, templates, cached gum, rules pack, and the managed CLAUDE.md section.\n"
        if [[ $_purge -eq 1 ]]; then
            printf "--purge: secrets at %s will ALSO be deleted.\n" "$GOR_MOBILE_SECRETS"
        else
            printf "Secrets at %s will be kept (re-run with --purge to delete them too).\n" "$GOR_MOBILE_SECRETS"
        fi
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

    log_step "Removing MCP entries"
    mcp_unregister_managed

    log_step "Cleaning CLAUDE.md managed section"
    claude_md_remove_section

    # settings.json and ~/.claude/ are already clean — now wipe the private sandbox.
    # Safe to rm -rf the whole $GOR_MOBILE_HOME: templates/, scripts/, cache/bin/gum,
    # and the rules-pack git clone all live here. Anything the user wants to keep
    # belongs in $GOR_MOBILE_CONFIG_DIR instead.
    log_step "Removing $GOR_MOBILE_HOME (templates, scripts, cache, rules)"
    rm -rf "$GOR_MOBILE_HOME"

    log_step "Removing $GOR_MOBILE_CONFIG"
    rm -f "$GOR_MOBILE_CONFIG"

    if [[ $_purge -eq 1 ]]; then
        log_step "Purging $GOR_MOBILE_SECRETS"
        rm -f "$GOR_MOBILE_SECRETS"
        rmdir "$GOR_MOBILE_CONFIG_DIR" 2>/dev/null || true
        log_ok "gor-mobile fully purged — no artifacts remain"
    else
        log_ok "gor-mobile artifacts removed"
        if [[ -f "$GOR_MOBILE_SECRETS" ]]; then
            log_info "Secrets kept at $GOR_MOBILE_SECRETS — delete manually or re-run with --purge"
        fi
    fi
}
