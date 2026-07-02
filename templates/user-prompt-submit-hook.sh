#!/usr/bin/env bash
# UserPromptSubmit hook: directive reminder injected before a user prompt.
# Three-way, gated by detect-mobile-context.sh (next to this script):
#   - mobile context / explicit request → full skill-discipline reminder;
#   - ambiguous NEW project (greenfield, build intent, no platform named) →
#     a platform-check directive telling the model to ASK the user which
#     platform, then route mobile→gor-mobile vs else→general workflow;
#   - otherwise → stay silent (non-mobile sessions are not polluted).
#
# Kept intentionally directive (not just "check skills") because the mild
# variant was empirically ignored: the model would match a generic skill
# (e.g. yandex-tracker) or jump straight to Explore/Grep/Read and skip
# gor-mobile process skills entirely.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTOR="$SCRIPT_DIR/detect-mobile-context.sh"

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)"
prompt="$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null || true)"

# Gate: consult the detector for a three-way verdict. Prompt is passed via
# GORM_PROMPT so the detector can honor keyword / new-project signals.
#   0 = mobile          → inject the full skill-discipline reminder
#   2 = ambiguous new   → inject the platform-check directive (ask the user)
#   * = non-mobile       → stay silent
# Missing detector → verdict 0 (backward compatible: inject as before).
verdict=0
if [[ -f "$DETECTOR" ]]; then
    GORM_PROMPT="$prompt" bash "$DETECTOR" "$cwd" "$session_id" || verdict=$?
fi

if [[ "$verdict" != 0 && "$verdict" != 2 ]]; then
    printf '{}\n'
    exit 0
fi

if [[ "$verdict" == 2 ]]; then
    reminder='<gor-mobile-platform-check>
This looks like a NEW project and the target platform is not stated yet. Do NOT pick a workflow or invoke any brainstorming/planning skill until you know the platform.

FIRST, ask the user one concise question: what platform / target is this project?

Route on the answer:
- Android / iOS / mobile → this is a gor-mobile project. Use the gor-mobile-* process skills (Skill(gor-mobile-brainstorming), etc.), and create a `.gor-mobile.json` file at the project root so the workflow persists on later turns.
- Anything else (web, backend, CLI, desktop, library, …) → this is NOT a gor-mobile project. Do NOT use gor-mobile-* skills; use the general-purpose workflow available to you (e.g. the superpowers skill set) or whatever best fits.

Ask before assuming. The directory is empty/greenfield and the request named no platform, so the user is the only reliable signal.
</gor-mobile-platform-check>'
else
    reminder='<gor-mobile-turn-reminder>
CRITICAL skill-discipline rule (overrides default behavior).

Before ANY tool call (including Grep/Glob/Read/Explore/Task/other plugin skills) and before ANY clarifying question, classify the user request and invoke the matching gor-mobile process skill FIRST:

- Any "add/make/build/implement/create/do" a feature/screen/component/task
  (including tracker IDs like ARU-1234, JIRA-567) → Skill(gor-mobile-brainstorming) OR Skill(gor-mobile-writing-plans).
- Bug/failure/unexpected behavior/"why does X happen" → Skill(gor-mobile-systematic-debugging).
- "Review this code" / completion claims → Skill(gor-mobile-requesting-code-review) or Skill(gor-mobile-verification-before-completion).
- Running an existing written plan → Skill(gor-mobile-executing-plans).

No automatic git: gor-mobile skills NEVER run `git commit`, `git branch`, `git checkout`, or `git worktree add` on behalf of the user. All work accumulates as uncommitted modifications in the working tree; the user decides when to commit and on which branch.

Matching a non-gor-mobile skill (e.g. yandex-tracker, figma) does NOT discharge this rule — process skills ALWAYS run before research or implementation tools. When in doubt, invoke Skill(gor-mobile-brainstorming).
</gor-mobile-turn-reminder>'
fi

jq -n --arg ctx "$reminder" '{
    hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: $ctx
    }
}'
