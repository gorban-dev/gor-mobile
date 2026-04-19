#!/usr/bin/env bats
# Tests for the LLM dispatcher (routing + presets + error paths).

load helpers.bash

setup() {
    setup_isolated_home
    mkdir -p "$XDG_CONFIG_HOME/gor-mobile"
}

teardown() {
    teardown_isolated_home
}

@test "llm routing: balanced preset maps impl→local" {
    run gor-mobile llm routing
    [ "$status" -eq 0 ]
    [[ "$output" == *"preset: balanced"* ]]
    [[ "$output" == *"impl"*"local"*"qwen"* ]]
}

@test "llm preset switches to cloud-only and BLOCKS impl" {
    run gor-mobile llm preset cloud-only
    [ "$status" -eq 0 ]
    run jq -r '.preset' "$XDG_CONFIG_HOME/gor-mobile/config.json"
    [ "$output" = "cloud-only" ]

    echo "test prompt" > /tmp/gm-test-prompt.$$
    run gor-mobile llm impl --input /tmp/gm-test-prompt.$$
    # status should be 2 (BLOCKED) because cloud-only
    [ "$status" -eq 2 ]
    [[ "$output" == *"\"status\": \"BLOCKED\""* ]]
    rm -f /tmp/gm-test-prompt.$$
}

@test "llm rejects missing --input" {
    run gor-mobile llm impl
    [ "$status" -ne 0 ]
    [[ "$output" == *"Missing --input"* ]] || [[ "$output" == *"Usage"* ]]
}

@test "llm rejects unknown role" {
    echo "prompt" > /tmp/gm-test-prompt.$$
    run gor-mobile llm nonsense-role --input /tmp/gm-test-prompt.$$
    [ "$status" -eq 2 ]
    [[ "$output" == *"unknown role"* ]]
    rm -f /tmp/gm-test-prompt.$$
}
