#!/usr/bin/env bash
# Register an MCP server entry in ~/.claude/mcp.json if not already present.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=./ui.sh
source "$GOR_MOBILE_ROOT/lib/helpers/ui.sh"

mcp_has_entry() {
    local name="$1"
    [[ -f "$CLAUDE_MCP" ]] || return 1
    jq -e --arg n "$name" '.mcpServers[$n] // empty' "$CLAUDE_MCP" >/dev/null 2>&1
}

# Register the google-dev-knowledge MCP entry. Safe to call repeatedly.
mcp_register_google_dev_knowledge() {
    mkdir -p "$(dirname "$CLAUDE_MCP")"
    [[ -f "$CLAUDE_MCP" ]] || printf '{"mcpServers":{}}\n' > "$CLAUDE_MCP"

    if mcp_has_entry "google-dev-knowledge"; then
        ui_info "MCP google-dev-knowledge already registered"
        return 0
    fi

    local tmp; tmp="$(mktemp)"
    jq '
        .mcpServers = (.mcpServers // {})
        | .mcpServers["google-dev-knowledge"] = {
            "_managed_by": "gor-mobile",
            "command": "npx",
            "args": ["-y", "@anthropic/mcp-google-dev-knowledge@latest"]
        }
    ' "$CLAUDE_MCP" > "$tmp"
    mv "$tmp" "$CLAUDE_MCP"
    ui_ok "MCP google-dev-knowledge registered"
}

mcp_unregister_managed() {
    [[ -f "$CLAUDE_MCP" ]] || return 0
    local tmp; tmp="$(mktemp)"
    jq '
        if .mcpServers then
            .mcpServers |= with_entries(select((.value._managed_by // "") != "gor-mobile"))
        else . end
    ' "$CLAUDE_MCP" > "$tmp"
    mv "$tmp" "$CLAUDE_MCP"
}
