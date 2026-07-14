#!/usr/bin/env bash
# UserPromptSubmit hook: directive skill-discipline reminder injected before a
# user prompt, but only inside a gor-mobile project.
#
# Gate mirrors the SessionStart hook:
#   - Codex (user-level): GORM_SKILLS_DIR set → always inject.
#   - Claude (per-project): walk up from cwd to a .gor-mobile.json marker; no
#     marker → stay silent (repo did not run `gor-mobile init`).
#
# Kept intentionally directive (not just "check skills") because the mild
# variant was empirically ignored: the model would match a generic skill or
# jump straight to Explore/Grep/Read and skip gor-mobile process skills.

set -euo pipefail

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
[[ -n "$cwd" ]] || cwd="$PWD"

if [[ -z "${GORM_SKILLS_DIR:-}" ]]; then
    root=""
    dir="$cwd"
    while [[ -n "$dir" && "$dir" != "/" ]]; do
        if [[ -f "$dir/.gor-mobile.json" ]]; then root="$dir"; break; fi
        [[ "$dir" == "$HOME" ]] && break
        nd="$(dirname "$dir")"
        [[ "$nd" == "$dir" ]] && break
        dir="$nd"
    done
    if [[ -z "$root" ]]; then
        printf '{}\n'
        exit 0
    fi
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
