#!/usr/bin/env bash
# Idempotent management of a gor-mobile-owned section inside ~/.claude/CLAUDE.md.
# The section sits between BEGIN/END markers. Content between the markers is fully
# owned by gor-mobile — the rest of the file is never touched.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"

claude_md_write_section() {
    local snippet_path="$1"
    [[ -f "$snippet_path" ]] || { log_err "snippet not found: $snippet_path"; return 1; }

    mkdir -p "$(dirname "$CLAUDE_CLAUDE_MD")"
    [[ -f "$CLAUDE_CLAUDE_MD" ]] || printf "" > "$CLAUDE_CLAUDE_MD"

    local tmp; tmp="$(mktemp)"
    # Strip any prior managed section, then append a fresh one.
    awk -v begin="$GOR_MOBILE_SECTION_BEGIN" -v end="$GOR_MOBILE_SECTION_END" '
        BEGIN { inside = 0 }
        $0 == begin { inside = 1; next }
        $0 == end   { inside = 0; next }
        !inside { print }
    ' "$CLAUDE_CLAUDE_MD" > "$tmp"

    # Trim trailing blank lines added by awk.
    # Append our block with a single leading blank line.
    {
        cat "$tmp"
        printf "\n%s\n" "$GOR_MOBILE_SECTION_BEGIN"
        cat "$snippet_path"
        printf "\n%s\n" "$GOR_MOBILE_SECTION_END"
    } > "${tmp}.2"
    mv "${tmp}.2" "$CLAUDE_CLAUDE_MD"
    rm -f "$tmp"
}

claude_md_remove_section() {
    [[ -f "$CLAUDE_CLAUDE_MD" ]] || return 0
    local tmp; tmp="$(mktemp)"
    awk -v begin="$GOR_MOBILE_SECTION_BEGIN" -v end="$GOR_MOBILE_SECTION_END" '
        BEGIN { inside = 0 }
        $0 == begin { inside = 1; next }
        $0 == end   { inside = 0; next }
        !inside { print }
    ' "$CLAUDE_CLAUDE_MD" > "$tmp"
    mv "$tmp" "$CLAUDE_CLAUDE_MD"
}
