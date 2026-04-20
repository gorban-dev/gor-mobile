#!/usr/bin/env bats
# Tests for cmd_uninstall — verifies the command cleans up everything
# under $GOR_MOBILE_HOME (including cache/bin/gum) and respects the
# --purge flag for secrets.

load helpers.bash

setup() {
    setup_isolated_home
    # shellcheck disable=SC1091
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    # Simulate a completed install.
    mkdir -p "$GOR_MOBILE_HOME/templates" \
             "$GOR_MOBILE_HOME/scripts" \
             "$GOR_MOBILE_HOME/cache/bin" \
             "$GOR_MOBILE_HOME/rules" \
             "$GOR_MOBILE_CONFIG_DIR" \
             "$CLAUDE_SKILLS_DIR/gor-mobile-using-superpowers" \
             "$CLAUDE_AGENTS_DIR"
    echo "fake gum binary" > "$GOR_MOBILE_HOME/cache/bin/gum"
    chmod +x "$GOR_MOBILE_HOME/cache/bin/gum"
    echo "# fake rules" > "$GOR_MOBILE_HOME/rules/manifest.json"
    echo "fake skill" > "$CLAUDE_SKILLS_DIR/gor-mobile-using-superpowers/SKILL.md"
    echo "fake reviewer" > "$CLAUDE_AGENTS_DIR/gor-mobile-code-reviewer.md"
    printf '{"hooks":{}}' > "$HOME/.claude/settings.json"
    printf '{"rules_source":"x"}' > "$GOR_MOBILE_CONFIG"
    printf 'ANTHROPIC_API_KEY=sk-test\n' > "$GOR_MOBILE_SECRETS"
    chmod 600 "$GOR_MOBILE_SECRETS"
}

teardown() {
    teardown_isolated_home
}

@test "uninstall removes \$GOR_MOBILE_HOME including cached gum" {
    run gor-mobile uninstall --yes
    [ "$status" -eq 0 ]
    [ ! -d "$GOR_MOBILE_HOME" ]
    [ ! -f "$GOR_MOBILE_HOME/cache/bin/gum" ]
    [ ! -d "$GOR_MOBILE_HOME/rules" ]
    [ ! -d "$GOR_MOBILE_HOME/templates" ]
    [ ! -d "$GOR_MOBILE_HOME/scripts" ]
}

@test "uninstall removes config.json but keeps secrets by default" {
    run gor-mobile uninstall --yes
    [ "$status" -eq 0 ]
    [ ! -f "$GOR_MOBILE_CONFIG" ]
    [ -f "$GOR_MOBILE_SECRETS" ]
}

@test "uninstall removes installed skills and agents from ~/.claude/" {
    run gor-mobile uninstall --yes
    [ "$status" -eq 0 ]
    [ ! -d "$CLAUDE_SKILLS_DIR/gor-mobile-using-superpowers" ]
    [ ! -f "$CLAUDE_AGENTS_DIR/gor-mobile-code-reviewer.md" ]
}

@test "uninstall --purge also deletes secrets" {
    run gor-mobile uninstall --yes --purge
    [ "$status" -eq 0 ]
    [ ! -f "$GOR_MOBILE_SECRETS" ]
    [ ! -d "$GOR_MOBILE_HOME" ]
}

@test "uninstall is idempotent — running twice does not fail" {
    run gor-mobile uninstall --yes
    [ "$status" -eq 0 ]
    run gor-mobile uninstall --yes
    [ "$status" -eq 0 ]
}
