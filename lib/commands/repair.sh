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

# Remove legacy gor-mobile slash-commands (0.2.5 and earlier) whose template
# headers match the known signature. Anything diverged from the template is
# left in place with a warning — user may have customized it.
_repair_cleanup_legacy_commands() {
    [[ -d "$CLAUDE_COMMANDS_DIR" ]] || return 0
    local cmd f
    for cmd in brainstorm plan worktree implement execute parallel tdd review verify debug finishing-branch; do
        f="$CLAUDE_COMMANDS_DIR/$cmd.md"
        [[ -f "$f" ]] || continue
        if head -10 "$f" | grep -q 'Task from user: \*\*\$ARGUMENTS\*\*'; then
            rm -f "$f"
            log_ok "Removed legacy command $f"
        else
            log_warn "$f diverged from gor-mobile template — remove manually if unused"
        fi
    done
}

_repair_cleanup_legacy_advisor() {
    local f="$CLAUDE_AGENTS_DIR/gor-mobile-advisor.md"
    [[ -f "$f" ]] || return 0
    rm -f "$f"
    log_ok "Removed legacy agent $f"
}

_repair_cleanup_legacy_code_reviewer() {
    # 0.2.5 and earlier installed code-reviewer.md (unprefixed). The current
    # wizard installs gor-mobile-code-reviewer.md; drop the old filename only
    # if it still has the frontmatter 'name: code-reviewer' we shipped.
    local f="$CLAUDE_AGENTS_DIR/code-reviewer.md"
    [[ -f "$f" ]] || return 0
    if head -20 "$f" | grep -q '^name: code-reviewer'; then
        rm -f "$f"
        log_ok "Removed legacy agent $f"
    fi
}

cmd_repair() {
    log_step "Repairing ~/.claude/ managed files"

    mkdir -p "$GOR_MOBILE_HOME/templates" "$GOR_MOBILE_HOME/scripts"
    cp "$GOR_MOBILE_ROOT/templates/session-start-hook.sh" "$GOR_MOBILE_HOME/templates/"
    chmod +x "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    rm -f "$GOR_MOBILE_HOME/templates/session-start-snippet.md"

    settings_install_session_start_hook
    log_ok "SessionStart hook refreshed"

    mkdir -p "$CLAUDE_AGENTS_DIR" "$CLAUDE_SKILLS_DIR"

    _repair_cleanup_legacy_commands
    _repair_cleanup_legacy_advisor
    _repair_cleanup_legacy_code_reviewer

    # Drop any stale gor-mobile-* skill dirs before re-installing. Only touches
    # our namespace so user-authored skills are untouched.
    rm -rf "$CLAUDE_SKILLS_DIR"/gor-mobile-*

    local d skill_name dst overlay
    for d in "$GOR_MOBILE_ROOT"/templates/skills/*/; do
        [[ -d "$d" ]] || continue
        skill_name="$(basename "$d")"
        dst="$CLAUDE_SKILLS_DIR/gor-mobile-$skill_name"
        overlay="$GOR_MOBILE_ROOT/templates/overlays/$skill_name.md"
        cp -R "${d%/}" "$dst"
        if [[ -f "$dst/SKILL.md" ]]; then
            sed -i '' 's/superpowers:/gor-mobile-/g' "$dst/SKILL.md"
            sed -i '' 's/^name: /name: gor-mobile-/' "$dst/SKILL.md"
            if [[ -f "$overlay" ]]; then
                printf '\n' >> "$dst/SKILL.md"
                cat "$overlay" >> "$dst/SKILL.md"
            fi
        fi
    done
    log_ok "Skills refreshed (14 gor-mobile-* dirs)"

    install -m 0644 \
        "$GOR_MOBILE_ROOT/templates/agents/code-reviewer.md" \
        "$CLAUDE_AGENTS_DIR/gor-mobile-code-reviewer.md"
    log_ok "Code-reviewer agent refreshed"

    local s
    for s in llm-config llm-agent llm-implement llm-review llm-analyze llm-check llm-unload; do
        install -m 0755 \
            "$GOR_MOBILE_ROOT/templates/scripts/${s}.sh" \
            "$GOR_MOBILE_HOME/scripts/${s}.sh"
    done
    log_ok "LLM scripts refreshed (7 in $GOR_MOBILE_HOME/scripts/)"

    mcp_register_google_dev_knowledge || true
    claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"
    log_ok "CLAUDE.md managed section refreshed"

    log_ok "Done. Run 'gor-mobile doctor' to verify."
}
