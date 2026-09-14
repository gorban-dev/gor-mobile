#!/usr/bin/env bash
# UserPromptSubmit hook: skill-routing reminder injected before the first user
# prompt of a session inside a gor-mobile project.
#
# Gate mirrors the SessionStart hook:
#   - Codex (user-level): GORM_SKILLS_DIR set → inject.
#   - Claude (per-project): walk up from cwd to a .gor-mobile/marker.json marker
#     (pre-0.3.5 installs kept it at .gor-mobile.json); no marker → stay silent
#     (repo did not run `gor-mobile init`).
#
# Once per session, not per prompt: the reminder used to ride on every prompt
# and accumulate in the transcript (~360 tokens each). A once-stated instruction
# is retained; the flag file keyed by session_id makes later prompts a no-op.
# The SessionStart hook clears the flags on every start, so a compact / clear /
# resume gets the reminder once more. No root (Codex outside a gor-mobile repo)
# → no flag, inject every time as before.

set -euo pipefail

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
[[ -n "$cwd" ]] || cwd="$PWD"

root=""
dir="$cwd"
while [[ -n "$dir" && "$dir" != "/" ]]; do
    if [[ -f "$dir/.gor-mobile/marker.json" || -f "$dir/.gor-mobile.json" ]]; then
        root="$dir"; break
    fi
    [[ "$dir" == "$HOME" ]] && break
    nd="$(dirname "$dir")"
    [[ "$nd" == "$dir" ]] && break
    dir="$nd"
done
if [[ -z "${GORM_SKILLS_DIR:-}" && -z "$root" ]]; then
    printf '{}\n'
    exit 0
fi

# session_id is validated as a plain token before it becomes a file name.
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)"
[[ "$session_id" =~ ^[A-Za-z0-9._-]+$ ]] || session_id=""
flag=""
if [[ -n "$session_id" && -n "$root" ]]; then
    flag="$root/.gor-mobile/state/.reminded-$session_id"
    if [[ -f "$flag" ]]; then
        printf '{}\n'
        exit 0
    fi
fi

reminder='<gor-mobile-turn-reminder>
Route the request to a gor-mobile skill before the first tool call or clarifying question — the skills carry the repo'"'"'s Android conventions and gates, which the code does not show:

- "add/make/build/implement/create/do" a feature/screen/component/task (including tracker IDs like ARU-1234) → Skill(gor-mobile-brainstorming) or Skill(gor-mobile-writing-plans).
- Bug/failure/unexpected behavior/"why does X happen" → Skill(gor-mobile-systematic-debugging).
- "Review this code" / completion claims → Skill(gor-mobile-requesting-code-review).
- Running an existing written plan → the sub-skill named in the plan header: Skill(gor-mobile-subagent-driven-development) or Skill(gor-mobile-executing-plans).

A non-gor-mobile skill match (tracker, figma) does not replace this routing. gor-mobile flows never run git commit / branch / checkout / worktree — the user decides when to commit and on which branch.
</gor-mobile-turn-reminder>'

if [[ -n "$flag" ]]; then
    { mkdir -p "$(dirname "$flag")" && : > "$flag"; } 2>/dev/null || true
fi

jq -n --arg ctx "$reminder" '{
    hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: $ctx
    }
}'
