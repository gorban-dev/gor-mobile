#!/usr/bin/env bats
# Tests for the craft-skills-ported LLM scripts (templates/scripts/).

load helpers.bash

setup() {
    setup_isolated_home
}

teardown() {
    teardown_isolated_home
}

@test "llm-check.sh exits 0 even when LM Studio is unreachable" {
    LLM_URL="http://127.0.0.1:1" run bash "$GOR_MOBILE_ROOT/templates/scripts/llm-check.sh"
    [ "$status" -eq 0 ]
    # Expect either LLM_AVAILABLE or LLM_UNAVAILABLE token on stdout.
    [[ "$output" == *"LLM_"* ]]
}

@test "llm-implement.sh with no args emits JSON with status BLOCKED" {
    run bash "$GOR_MOBILE_ROOT/templates/scripts/llm-implement.sh"
    [ "$status" -eq 0 ]
    # Must parse as JSON with a status field.
    run jq -r '.status' <<<"$output"
    [ "$status" -eq 0 ]
    [ "$output" = "BLOCKED" ]
}

@test "llm-config.sh is sourceable without LM Studio" {
    run bash -c "source '$GOR_MOBILE_ROOT/templates/scripts/llm-config.sh' && printf '%s' \"\$LLM_URL\""
    [ "$status" -eq 0 ]
    [[ "$output" == http://* ]]
}

@test "all 7 LLM script templates are executable" {
    local s
    for s in llm-config llm-agent llm-implement llm-review llm-analyze llm-check llm-unload; do
        [ -x "$GOR_MOBILE_ROOT/templates/scripts/${s}.sh" ]
    done
}
