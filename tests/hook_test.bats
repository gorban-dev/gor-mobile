#!/usr/bin/env bats
# Tests for templates/session-start-hook.sh behaviour.

load helpers.bash

setup() {
    setup_isolated_home
    mkdir -p "$GOR_MOBILE_HOME/templates" "$GOR_MOBILE_HOME/rules/rules"
    cp "$GOR_MOBILE_ROOT/templates/session-start-hook.sh"    "$GOR_MOBILE_HOME/templates/"
    cp "$GOR_MOBILE_ROOT/templates/session-start-snippet.md"  "$GOR_MOBILE_HOME/templates/"
    echo "# Core rules" > "$GOR_MOBILE_HOME/rules/rules/core.md"
}

teardown() {
    teardown_isolated_home
}

@test "hook exits 0 with empty JSON outside android projects" {
    local dir; dir="$(mktemp -d)"
    cd "$dir"
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    [[ "$output" == *"{}"* ]]
}

@test "hook injects context in android projects" {
    fake_android_project
    run bash "$GOR_MOBILE_HOME/templates/session-start-hook.sh"
    [ "$status" -eq 0 ]
    # Expect JSON with hookSpecificOutput + additionalContext
    run jq -r '.hookSpecificOutput.hookEventName' <<<"$output"
    [ "$output" = "SessionStart" ]
}
