#!/usr/bin/env bash
# SessionStart hook: inject gor-mobile-using-superpowers SKILL.md as additionalContext.
# Mirrors the superpowers hook shape — NO Android gate, always injects.

set -euo pipefail

SKILL_FILE="${CLAUDE_DIR:-$HOME/.claude}/skills/gor-mobile-using-superpowers/SKILL.md"
if [[ ! -f "$SKILL_FILE" ]]; then
    printf '{}\n'
    exit 0
fi

content=$(cat "$SKILL_FILE")
trailer="Android/Kotlin projects: architecture rules live in \$HOME/.gor-mobile/rules/
(read via manifest.json / examples/index.json). Local-LLM delegation scripts
are in \$HOME/.gor-mobile/scripts/ — see overlay sections inside each
SKILL.md for usage."

injection="<EXTREMELY_IMPORTANT>
You have gor-mobile superpowers. Below is the full 'gor-mobile-using-superpowers' skill
- your introduction to using all other skills. For all other skills, use the 'Skill' tool.

${content}

${trailer}
</EXTREMELY_IMPORTANT>"

jq -n --arg ctx "$injection" '{
    hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $ctx
    }
}'
