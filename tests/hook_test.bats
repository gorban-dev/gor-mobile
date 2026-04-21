#!/usr/bin/env bats
# Tests for templates/session-start-hook.sh behaviour.

load helpers.bash

setup() {
    setup_isolated_home
    mkdir -p "$GOR_MOBILE_HOME/templates" "$HOME/.claude/skills/gor-mobile-using-superpowers"
    cp "$GOR_MOBILE_ROOT/templates/session-start-hook.sh" "$GOR_MOBILE_HOME/templates/"
    chmod +x "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    cp "$GOR_MOBILE_ROOT/templates/user-prompt-submit-hook.sh" "$GOR_MOBILE_HOME/templates/"
    chmod +x "$GOR_MOBILE_HOME/templates/user-prompt-submit-hook.sh"
    # Seed a minimal using-superpowers SKILL.md so the hook has content to inject.
    cat > "$HOME/.claude/skills/gor-mobile-using-superpowers/SKILL.md" <<'EOF'
---
name: gor-mobile-using-superpowers
description: test seed
---
Seeded body for hook tests.
EOF
}

teardown() {
    teardown_isolated_home
}

@test "hook exits 0 with empty JSON if skill file missing" {
    rm -f "$HOME/.claude/skills/gor-mobile-using-superpowers/SKILL.md"
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    [[ "$output" == *"{}"* ]]
}

@test "hook injects context outside android projects (no android gate)" {
    local dir; dir="$(mktemp -d)"
    cd "$dir"
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    run jq -r '.hookSpecificOutput.hookEventName' <<<"$output"
    [ "$output" = "SessionStart" ]
}

@test "additionalContext references using-superpowers skill" {
    fake_android_project
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    run jq -r '.hookSpecificOutput.additionalContext' <<<"$output"
    [[ "$output" == *"gor-mobile-using-superpowers"* ]]
}

@test "additionalContext references \$HOME/.gor-mobile/scripts/" {
    fake_android_project
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    run jq -r '.hookSpecificOutput.additionalContext' <<<"$output"
    [[ "$output" == *".gor-mobile/scripts/"* ]]
}

@test "EXTREMELY_IMPORTANT block closes before the android addendum" {
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    local ctx; ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<<"$output")"
    # The closing tag must appear strictly before the addendum block —
    # otherwise the android trailer dilutes the skills-rule signal.
    local close_pos add_pos
    close_pos="$(printf '%s' "$ctx" | grep -nF '</EXTREMELY_IMPORTANT>' | head -1 | cut -d: -f1)"
    add_pos="$(printf '%s' "$ctx" | grep -nF '<gor-mobile-android-addendum>' | head -1 | cut -d: -f1)"
    [ -n "$close_pos" ]
    [ -n "$add_pos" ]
    [ "$close_pos" -lt "$add_pos" ]
}

@test "user-prompt-submit hook emits UserPromptSubmit additionalContext" {
    run bash "$GOR_MOBILE_HOME/templates/user-prompt-submit-hook.sh"
    [ "$status" -eq 0 ]
    run jq -r '.hookSpecificOutput.hookEventName' <<<"$output"
    [ "$output" = "UserPromptSubmit" ]
}

@test "user-prompt-submit reminder names concrete trigger → skill mappings" {
    run bash "$GOR_MOBILE_HOME/templates/user-prompt-submit-hook.sh"
    [ "$status" -eq 0 ]
    run jq -r '.hookSpecificOutput.additionalContext' <<<"$output"
    # Must name the actual skills by id so the model has no excuse to
    # "check skills" and do nothing — concrete mapping per trigger.
    [[ "$output" == *"gor-mobile-brainstorming"* ]]
    [[ "$output" == *"gor-mobile-writing-plans"* ]]
    [[ "$output" == *"gor-mobile-systematic-debugging"* ]]
    # Must carve out the "tracker-id matched yandex-tracker so I'm done" escape.
    [[ "$output" == *"yandex-tracker"* ]]
    [[ "$output" == *"does NOT discharge this rule"* ]]
}

@test "settings_install_user_prompt_submit_hook registers managed entry" {
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"

    cat > "$HOME/.claude/settings.json" <<'JSON'
{"hooks":{"UserPromptSubmit":[{"matcher":"","hooks":[{"type":"command","command":"echo user"}]}]}}
JSON

    settings_install_user_prompt_submit_hook

    run jq -r '.hooks.UserPromptSubmit | length' "$HOME/.claude/settings.json"
    [ "$output" = "2" ]
    run jq -r '.hooks.UserPromptSubmit[0].hooks[0].command' "$HOME/.claude/settings.json"
    [ "$output" = "echo user" ]
    run jq -r '.hooks.UserPromptSubmit[1]._managed_by' "$HOME/.claude/settings.json"
    [ "$output" = "gor-mobile" ]
}

@test "settings_install_user_prompt_submit_hook is idempotent" {
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"

    settings_install_user_prompt_submit_hook
    settings_install_user_prompt_submit_hook
    settings_install_user_prompt_submit_hook

    run jq -r '[.hooks.UserPromptSubmit[] | select(._managed_by == "gor-mobile")] | length' "$HOME/.claude/settings.json"
    [ "$output" = "1" ]
}

@test "settings_remove_user_prompt_submit_hook leaves unrelated entries" {
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"

    cat > "$HOME/.claude/settings.json" <<'JSON'
{
  "hooks": {
    "UserPromptSubmit": [
      {"matcher":"","hooks":[{"type":"command","command":"echo user"}]},
      {"_managed_by":"gor-mobile","matcher":"","hooks":[{"type":"command","command":"echo gm"}]}
    ]
  }
}
JSON

    settings_remove_user_prompt_submit_hook

    run jq -r '.hooks.UserPromptSubmit | length' "$HOME/.claude/settings.json"
    [ "$output" = "1" ]
    run jq -r '.hooks.UserPromptSubmit[0].hooks[0].command' "$HOME/.claude/settings.json"
    [ "$output" = "echo user" ]
}
