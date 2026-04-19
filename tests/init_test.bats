#!/usr/bin/env bats
# Tests for the init wizard + settings/CLAUDE.md/mcp merges.

load helpers.bash

setup() {
    setup_isolated_home
}

teardown() {
    teardown_isolated_home
}

@test "init --dry-run prints planned actions without touching filesystem" {
    run gor-mobile init --dry-run --yes --skip-sanity
    [ "$status" -eq 0 ]
    [[ "$output" == *"DRY RUN"* ]]
    [ ! -f "$HOME/.claude/settings.json" ]
}

@test "settings_install_session_start_hook preserves unrelated hooks" {
    mkdir -p "$HOME/.claude"
    cat > "$HOME/.claude/settings.json" <<'JSON'
{"hooks":{"Stop":[{"matcher":"*","hooks":[{"type":"command","command":"echo stop"}]}]}}
JSON

    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"

    settings_install_session_start_hook

    # Stop hook must survive
    run jq -r '.hooks.Stop[0].hooks[0].command' "$HOME/.claude/settings.json"
    [ "$status" -eq 0 ]
    [ "$output" = "echo stop" ]

    # SessionStart hook must be registered with the managed tag
    run jq -r '.hooks.SessionStart[0]._managed_by' "$HOME/.claude/settings.json"
    [ "$status" -eq 0 ]
    [ "$output" = "gor-mobile" ]
}

@test "claude_md_write_section is idempotent" {
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/claude-md-section.sh"

    cat > "$HOME/.claude/CLAUDE.md" <<'EOF'
# Existing content
Some user notes.
EOF

    claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"
    claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"  # run twice

    local begins; begins="$(grep -cF '<!-- BEGIN gor-mobile managed section -->' "$HOME/.claude/CLAUDE.md")"
    [ "$begins" -eq 1 ]
    grep -qF "Some user notes." "$HOME/.claude/CLAUDE.md"
}

@test "claude_md_remove_section leaves user content intact" {
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/claude-md-section.sh"

    cat > "$HOME/.claude/CLAUDE.md" <<'EOF'
# Existing
user stuff
EOF
    claude_md_write_section "$GOR_MOBILE_ROOT/templates/claude-md-snippet.md"
    claude_md_remove_section

    ! grep -qF "BEGIN gor-mobile managed section" "$HOME/.claude/CLAUDE.md"
    grep -qF "user stuff" "$HOME/.claude/CLAUDE.md"
}

@test "settings_remove_session_start_hook leaves unrelated hooks" {
    source "$GOR_MOBILE_ROOT/lib/constants.sh"
    source "$GOR_MOBILE_ROOT/lib/helpers/settings-merge.sh"

    cat > "$HOME/.claude/settings.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      {"matcher":"startup","hooks":[{"type":"command","command":"echo user"}]},
      {"_managed_by":"gor-mobile","matcher":"startup","hooks":[{"type":"command","command":"echo gm"}]}
    ]
  }
}
JSON

    settings_remove_session_start_hook

    run jq -r '.hooks.SessionStart | length' "$HOME/.claude/settings.json"
    [ "$output" = "1" ]
    run jq -r '.hooks.SessionStart[0].hooks[0].command' "$HOME/.claude/settings.json"
    [ "$output" = "echo user" ]
}
