#!/usr/bin/env bash
# SessionStart hook: inject gor-mobile-using-superpowers SKILL.md as additionalContext,
# but ONLY in a mobile (Android/iOS) context — otherwise stay silent so non-mobile
# sessions are not polluted. Gating is delegated to detect-mobile-context.sh,
# which sits next to this script in ~/.gor-mobile/templates/.
#
# The injection layout is two distinct blocks so the <EXTREMELY_IMPORTANT>
# envelope ends on the discipline rules (not an unrelated trailer) — this
# keeps the signal about "always invoke skills" at the closing tag, which
# is what the model tends to anchor on.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTOR="$SCRIPT_DIR/detect-mobile-context.sh"

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)"

# Gate: if the detector exists and says "not mobile", stay silent. If the
# detector is missing (e.g. an old install not yet repaired), fall through and
# inject as before (backward compatible).
if [[ -f "$DETECTOR" ]] && ! bash "$DETECTOR" "$cwd" "$session_id"; then
    printf '{}\n'
    exit 0
fi

SKILL_FILE="${CLAUDE_DIR:-$HOME/.claude}/skills/gor-mobile-using-superpowers/SKILL.md"
if [[ ! -f "$SKILL_FILE" ]]; then
    printf '{}\n'
    exit 0
fi

content=$(cat "$SKILL_FILE")
addendum="Android/Kotlin projects: architecture rules live in \$HOME/.gor-mobile/rules/
(read via manifest.json / examples/index.json). See overlay sections
inside each SKILL.md for how to use them.

On Android-target sessions, invoke [[gor-mobile-using-android-cli]] before
research/exec/verify phases — it owns the phase→CLI-command mapping and
is authoritative for Android device ops."

injection="<EXTREMELY_IMPORTANT>
You have gor-mobile superpowers.

**Below is the full content of your 'gor-mobile-using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**

${content}
</EXTREMELY_IMPORTANT>

<gor-mobile-android-addendum>
${addendum}
</gor-mobile-android-addendum>"

jq -n --arg ctx "$injection" '{
    hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $ctx
    }
}'
