#!/usr/bin/env bash
# SessionStart hook: inject the gor-mobile-using-superpowers SKILL.md (plus the
# managed workflow pointers that used to live in CLAUDE.md) as additionalContext.
#
# Two modes, disambiguated by GORM_SKILLS_DIR:
#   - Codex (user-level, always-on): GORM_SKILLS_DIR is set by the hook command;
#     inject unconditionally from that folder.
#   - Claude (per-project): GORM_SKILLS_DIR is unset; find the repo root by
#     walking up from cwd to a .gor-mobile.json marker. No marker → stay silent
#     (this repo did not run `gor-mobile init`).
#
# The injection is two blocks so the <EXTREMELY_IMPORTANT> envelope closes on the
# skill-discipline rules — the signal the model anchors on.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
[[ -n "$cwd" ]] || cwd="$PWD"
src="$(printf '%s' "$input" | jq -r '.source // empty' 2>/dev/null || true)"

# Repo root via the .gor-mobile.json marker walk. Claude mode gates injection
# on it; both modes use it to locate the .gor-mobile/state checkpoint.
root=""
dir="$cwd"
while [[ -n "$dir" && "$dir" != "/" ]]; do
    if [[ -f "$dir/.gor-mobile.json" ]]; then root="$dir"; break; fi
    [[ "$dir" == "$HOME" ]] && break
    nd="$(dirname "$dir")"
    [[ "$nd" == "$dir" ]] && break
    dir="$nd"
done

platform=""
[[ -n "$root" ]] && platform="$(jq -r '.platform // empty' "$root/.gor-mobile.json" 2>/dev/null || true)"
if [[ -n "${GORM_SKILLS_DIR:-}" ]]; then
    # Codex user-level: always inject.
    skills_dir="$GORM_SKILLS_DIR"
else
    # Claude per-project: no marker → stay silent.
    if [[ -z "$root" ]]; then
        printf '{}\n'
        exit 0
    fi
    skills_dir="$root/.claude/skills"
fi

SKILL_FILE="$skills_dir/gor-mobile-using-superpowers/SKILL.md"
if [[ ! -f "$SKILL_FILE" ]]; then
    printf '{}\n'
    exit 0
fi

content=$(cat "$SKILL_FILE")

# Former CLAUDE.md managed section — workflow pointers, copied next to this
# script by the CLI. Injected here so no file is written into the repo.
pointers=""
SNIPPET_FILE="$SCRIPT_DIR/claude-md-snippet.md"
[[ -f "$SNIPPET_FILE" ]] && pointers="$(cat "$SNIPPET_FILE")"

if [[ "$platform" == "ios" ]]; then
    addendum="iOS/Swift project. Architecture rules live in \$HOME/.gor-mobile/rules/
(read via manifest.json / examples/index.json). See overlay sections inside
each SKILL.md for how to use them."
else
    addendum="Android/Kotlin projects: architecture rules live in \$HOME/.gor-mobile/rules/
(read via manifest.json / examples/index.json). See overlay sections
inside each SKILL.md for how to use them.

On Android-target sessions, invoke [[gor-mobile-using-android-cli]] before
research/exec/verify phases — it owns the phase→CLI-command mapping and
is authoritative for Android device ops."
fi

# Project-local checkpoint (written by the plan/execution skills on safe
# boundaries). If present, point the session at it — strongly after a compact/
# resume, softly otherwise — so state is rehydrated from disk, not the summary.
checkpoint_block=""
if [[ -n "${root:-}" ]]; then
    state_dir="$root/.gor-mobile/state"
    cp_file="$(ls -t "$state_dir"/*.progress.md 2>/dev/null | head -1 || true)"
    if [[ -n "$cp_file" ]]; then
        # A clear right after a checkpoint was written (< 60 min) is the
        # writing-plans handoff — plan approved with "Yes, clear context" or a
        # manual /clear after the fallback dialog — so rehydrate strictly.
        # An old checkpoint on an unrelated /clear stays a soft pointer.
        fresh=""
        [[ -n "$(find "$cp_file" -mmin -60 2>/dev/null)" ]] && fresh=1
        if [[ "$src" == "compact" || "$src" == "resume" ]]; then
            checkpoint_block="<gor-mobile-resume>
You are resuming a gor-mobile session after a compaction. A checkpoint exists at:
  ${cp_file}
BEFORE anything else: read it and the plan/spec it references. Take task state
from the checkpoint and the plan, NOT from the summary above. Continue from its
'Next action'.
</gor-mobile-resume>"
        elif [[ "$src" == "clear" && -n "$fresh" ]]; then
            checkpoint_block="<gor-mobile-resume>
Context was cleared at the plan→execution boundary (the clear option was
chosen at the writing-plans handoff). A fresh checkpoint exists at:
  ${cp_file}
BEFORE anything else: read it and the plan/spec it references, then start
executing from its 'Next action' using the sub-skill named in the plan header
(gor-mobile-subagent-driven-development unless the plan says otherwise). If the
user's first message asks for something unrelated instead, do that and leave the
checkpoint alone.
</gor-mobile-resume>"
        else
            checkpoint_block="<gor-mobile-resume>
A gor-mobile checkpoint exists at ${cp_file}. If you are resuming prior work,
read it and its referenced plan/spec before continuing.
</gor-mobile-resume>"
        fi
    fi
fi

injection="<EXTREMELY_IMPORTANT>
You have gor-mobile superpowers.

**Below is the full content of your 'gor-mobile-using-superpowers' skill - your introduction to using skills. For all other skills, invoke them by name:**

${content}
</EXTREMELY_IMPORTANT>

<gor-mobile-workflow-pointers>
${pointers}
</gor-mobile-workflow-pointers>

<gor-mobile-android-addendum>
${addendum}
</gor-mobile-android-addendum>"

[[ -n "$checkpoint_block" ]] && injection="$injection

$checkpoint_block"

jq -n --arg ctx "$injection" '{
    hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $ctx
    }
}'
