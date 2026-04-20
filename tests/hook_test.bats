#!/usr/bin/env bats
# Tests for templates/session-start-hook.sh behaviour.

load helpers.bash

setup() {
    setup_isolated_home
    mkdir -p "$GOR_MOBILE_HOME/templates" "$HOME/.claude/skills/gor-mobile-using-superpowers"
    cp "$GOR_MOBILE_ROOT/templates/session-start-hook.sh" "$GOR_MOBILE_HOME/templates/"
    chmod +x "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
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
