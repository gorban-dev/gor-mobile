#!/usr/bin/env bats
# Tests for 'gor-mobile rules' (use / validate) with a local path as pack source.

load helpers.bash

setup() {
    setup_isolated_home
    PACK_DIR="$BATS_TEST_TMPDIR/pack"
    mkdir -p "$PACK_DIR/rules"
    cat > "$PACK_DIR/manifest.json" <<'JSON'
{
  "name": "test-pack",
  "version": "0.0.1",
  "compatible_with": ">=0.1.0",
  "stack": "android",
  "sections": { "core": "rules/core.md" }
}
JSON
    echo "# Core test" > "$PACK_DIR/rules/core.md"
    export PACK_DIR
}

teardown() {
    teardown_isolated_home
}

@test "rules use <local-path> copies pack and saves config" {
    run gor-mobile rules use "$PACK_DIR"
    [ "$status" -eq 0 ]
    [ -f "$HOME/.gor-mobile/rules/manifest.json" ]
    run jq -r '.rules_source' "$XDG_CONFIG_HOME/gor-mobile/config.json"
    [ "$output" = "$PACK_DIR" ]
}

@test "rules list shows name and version" {
    gor-mobile rules use "$PACK_DIR" >/dev/null
    run gor-mobile rules list
    [ "$status" -eq 0 ]
    [[ "$output" == *"test-pack"* ]]
    [[ "$output" == *"0.0.1"* ]]
}

@test "rules validate fails when a referenced file is missing" {
    gor-mobile rules use "$PACK_DIR" >/dev/null
    rm "$HOME/.gor-mobile/rules/rules/core.md"
    run gor-mobile rules validate
    [ "$status" -ne 0 ]
    [[ "$output" == *"Missing rule files"* ]]
}

@test "rules validate rejects invalid manifest JSON" {
    gor-mobile rules use "$PACK_DIR" >/dev/null
    echo "not json" > "$HOME/.gor-mobile/rules/manifest.json"
    run gor-mobile rules validate
    [ "$status" -ne 0 ]
    [[ "$output" == *"not valid JSON"* ]]
}
