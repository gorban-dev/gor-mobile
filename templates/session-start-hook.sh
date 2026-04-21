#!/usr/bin/env bash
# SessionStart hook: inject gor-mobile-using-superpowers SKILL.md as additionalContext.
# Mirrors the superpowers hook shape — NO Android gate, always injects.
#
# The injection layout is two distinct blocks so the <EXTREMELY_IMPORTANT>
# envelope ends on the discipline rules (not an unrelated trailer) — this
# keeps the signal about "always invoke skills" at the closing tag, which
# is what the model tends to anchor on.

set -euo pipefail

SKILL_FILE="${CLAUDE_DIR:-$HOME/.claude}/skills/gor-mobile-using-superpowers/SKILL.md"
if [[ ! -f "$SKILL_FILE" ]]; then
    printf '{}\n'
    exit 0
fi

content=$(cat "$SKILL_FILE")
addendum="Android/Kotlin projects: architecture rules live in \$HOME/.gor-mobile/rules/
(read via manifest.json / examples/index.json). Local-LLM delegation scripts
are in \$HOME/.gor-mobile/scripts/ — see overlay sections inside each
SKILL.md for usage."

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
