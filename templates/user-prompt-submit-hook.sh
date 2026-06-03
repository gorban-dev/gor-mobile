#!/usr/bin/env bash
# UserPromptSubmit hook: directive reminder injected before a user prompt, but
# ONLY in a mobile (Android/iOS) context or on explicit request — otherwise stay
# silent. Gating is delegated to detect-mobile-context.sh (next to this script).
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

# Gate: detector present and says "not mobile" → stay silent. Prompt is passed
# via GORM_PROMPT so the detector can honor explicit-request keywords.
if [[ -f "$DETECTOR" ]] && ! GORM_PROMPT="$prompt" bash "$DETECTOR" "$cwd" "$session_id"; then
    printf '{}\n'
    exit 0
fi

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

jq -n --arg ctx "$reminder" '{
    hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: $ctx
    }
}'
