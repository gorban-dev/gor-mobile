#!/usr/bin/env bash
# Idempotent merge into ~/.claude/settings.json.
# - Never overwrites unrelated user hooks.
# - Tags the gor-mobile entry with "_managed_by": "gor-mobile" so repair/uninstall can find it.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"

_settings_ensure_file() {
    mkdir -p "$(dirname "$CLAUDE_SETTINGS")"
    if [[ ! -f "$CLAUDE_SETTINGS" ]]; then
        printf "{}\n" > "$CLAUDE_SETTINGS"
    fi
}

# Adds a SessionStart hook entry that runs templates/session-start-hook.sh.
# Removes any prior gor-mobile entry first (replace, don't duplicate).
settings_install_session_start_hook() {
    _settings_ensure_file
    local hook_cmd="bash $GOR_MOBILE_HOME/templates/session-start-hook.sh"
    local tmp; tmp="$(mktemp)"

    jq --arg cmd "$hook_cmd" --arg tag "gor-mobile" '
        # Remove previous gor-mobile SessionStart entries (matched by _managed_by tag).
        ( .hooks.SessionStart // [] ) as $existing
        | .hooks.SessionStart =
            (( $existing | map(select((._managed_by // "") != $tag)) )
             + [{
                 "_managed_by": $tag,
                 "matcher": "startup|clear|compact|resume",
                 "hooks": [{ "type": "command", "command": $cmd }]
             }])
    ' "$CLAUDE_SETTINGS" > "$tmp"
    mv "$tmp" "$CLAUDE_SETTINGS"
}

# Removes gor-mobile SessionStart entries (for uninstall).
settings_remove_session_start_hook() {
    [[ -f "$CLAUDE_SETTINGS" ]] || return 0
    local tmp; tmp="$(mktemp)"
    jq --arg tag "gor-mobile" '
        if .hooks.SessionStart then
            .hooks.SessionStart |= map(select((._managed_by // "") != $tag))
            | if (.hooks.SessionStart | length) == 0 then del(.hooks.SessionStart) else . end
        else . end
    ' "$CLAUDE_SETTINGS" > "$tmp"
    mv "$tmp" "$CLAUDE_SETTINGS"
}

# Adds a UserPromptSubmit hook entry that runs templates/user-prompt-submit-hook.sh.
# Fires on every user prompt — counters skills-discipline drift between turns.
settings_install_user_prompt_submit_hook() {
    _settings_ensure_file
    local hook_cmd="bash $GOR_MOBILE_HOME/templates/user-prompt-submit-hook.sh"
    local tmp; tmp="$(mktemp)"

    jq --arg cmd "$hook_cmd" --arg tag "gor-mobile" '
        ( .hooks.UserPromptSubmit // [] ) as $existing
        | .hooks.UserPromptSubmit =
            (( $existing | map(select((._managed_by // "") != $tag)) )
             + [{
                 "_managed_by": $tag,
                 "matcher": "",
                 "hooks": [{ "type": "command", "command": $cmd }]
             }])
    ' "$CLAUDE_SETTINGS" > "$tmp"
    mv "$tmp" "$CLAUDE_SETTINGS"
}

# Removes gor-mobile UserPromptSubmit entries (for uninstall).
settings_remove_user_prompt_submit_hook() {
    [[ -f "$CLAUDE_SETTINGS" ]] || return 0
    local tmp; tmp="$(mktemp)"
    jq --arg tag "gor-mobile" '
        if .hooks.UserPromptSubmit then
            .hooks.UserPromptSubmit |= map(select((._managed_by // "") != $tag))
            | if (.hooks.UserPromptSubmit | length) == 0 then del(.hooks.UserPromptSubmit) else . end
        else . end
    ' "$CLAUDE_SETTINGS" > "$tmp"
    mv "$tmp" "$CLAUDE_SETTINGS"
}
