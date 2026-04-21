#!/usr/bin/env bash
# gor-mobile docs — proxy for Android docs search.
# Tries native `android docs` first, falls back to the google-dev-knowledge MCP notice.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/detect-deps.sh
source "$GOR_MOBILE_ROOT/lib/helpers/detect-deps.sh"

cmd_docs() {
    local query="$*"
    if [[ -z "$query" ]]; then
        log_err "Usage: gor-mobile docs <query>"
        exit 1
    fi

    if dep_android_cli_path >/dev/null 2>&1; then
        log_info "→ android docs \"$query\""
        "$(dep_android_cli_path)" docs "$query" 2>/dev/null && return 0
        log_warn "android docs returned nothing; falling back to MCP"
    fi

    cat <<EOF
Native android docs unavailable for this query.

Inside Claude Code, ask the google-dev-knowledge MCP server directly:
  $ claude > use google-dev-knowledge to find "$query"

Or open: https://developer.android.com/search?q=$(printf '%s' "$query" | jq -sRr @uri)
EOF
}
