#!/usr/bin/env bash
# SessionStart hook: inject gor-mobile workflow + core rules into Claude Code context
# when the working directory is an Android project.
#
# Wizard installs this file at $GOR_MOBILE_HOME/templates/session-start-hook.sh and
# wires it into ~/.claude/settings.json via settings_install_session_start_hook().

set -euo pipefail

HOME_DIR="${HOME}"
RULES_ROOT="${GOR_MOBILE_RULES_DIR:-$HOME_DIR/.gor-mobile/rules}"
SNIPPET="${GOR_MOBILE_HOME:-$HOME_DIR/.gor-mobile}/templates/session-start-snippet.md"
CORE_MD="$RULES_ROOT/rules/core.md"

# Emit empty JSON and exit if the cwd doesn't look like Android.
_is_android_project() {
    local f
    # build.gradle(.kts) at root or one level deep
    for f in build.gradle build.gradle.kts settings.gradle settings.gradle.kts; do
        [[ -f "$f" ]] && return 0
    done
    # Module-level (typical AGP layout)
    if compgen -G "*/build.gradle*" >/dev/null 2>&1; then
        return 0
    fi
    # AndroidManifest.xml is a reliable signal
    if find . -maxdepth 4 -name AndroidManifest.xml -print -quit 2>/dev/null | grep -q .; then
        return 0
    fi
    return 1
}

if ! _is_android_project; then
    # Not an Android project → no-op. Claude Code expects valid JSON even on skip.
    printf '{}\n'
    exit 0
fi

snippet_content=""
[[ -f "$SNIPPET" ]] && snippet_content="$(cat "$SNIPPET")"
core_content=""
[[ -f "$CORE_MD" ]] && core_content="$(cat "$CORE_MD")"

ctx=$(cat <<EOF
$snippet_content

## Loaded core rules (from $RULES_ROOT)

$core_content

## Available slash commands
/brainstorm /plan /implement /tdd /review /verify /debug /finishing-branch

Run 'gor-mobile doctor' if any of this looks wrong.
EOF
)

jq -n --arg ctx "$ctx" '{
    hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $ctx
    }
}'
