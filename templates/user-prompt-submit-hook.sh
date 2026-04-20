#!/usr/bin/env bash
# UserPromptSubmit hook: directive reminder injected before every user prompt.
# Counteracts drift — the SessionStart injection dissolves after a few
# turns on Opus 4.x, so the skills-discipline signal needs a refresher
# on each turn.
#
# Kept intentionally directive (not just "check skills") because the mild
# variant was empirically ignored: the model would match a generic skill
# (e.g. yandex-tracker) or jump straight to Explore/Grep/Read and skip
# gor-mobile process skills entirely.

set -euo pipefail

reminder='<gor-mobile-turn-reminder>
CRITICAL skill-discipline rule (overrides default behavior).

Before ANY tool call (including Grep/Glob/Read/Explore/Task/other plugin skills) and before ANY clarifying question, classify the user request and invoke the matching gor-mobile process skill FIRST:

- Any "add/make/build/implement/create/do" a feature/screen/component/task
  (including tracker IDs like ARU-1234, JIRA-567) → Skill(gor-mobile-brainstorming) OR Skill(gor-mobile-writing-plans).
- Bug/failure/unexpected behavior/"why does X happen" → Skill(gor-mobile-systematic-debugging).
- "Review this code" / completion claims → Skill(gor-mobile-requesting-code-review) or Skill(gor-mobile-verification-before-completion).
- Running an existing written plan → Skill(gor-mobile-executing-plans).

Worktree discipline (known upstream bug obra/superpowers#1080): if brainstorming just finished and the spec is about to be written/committed, do NOT commit on the current branch silently. Ask the user whether to invoke Skill(gor-mobile-using-git-worktrees) first — see brainstorming overlay, step 8.5.

Matching a non-gor-mobile skill (e.g. yandex-tracker, figma) does NOT discharge this rule — process skills ALWAYS run before research or implementation tools. When in doubt, invoke Skill(gor-mobile-brainstorming).
</gor-mobile-turn-reminder>'

jq -n --arg ctx "$reminder" '{
    hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: $ctx
    }
}'
