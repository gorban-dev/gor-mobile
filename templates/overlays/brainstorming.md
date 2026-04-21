<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADDS to it when the target
is an Android/Kotlin codebase.

### Architecture rules pointer
Before producing the spec, load `core` + `architecture` sections from
`$HOME/.gor-mobile/rules/` via `manifest.json`. Reference the canonical
layer examples (`examples/index.json` → `.layers`) when the spec needs to
mention concrete structural constraints (ViewModel base class, Repository
boundaries, DI scope, etc.).

Brainstorming stays on main Claude — the analysis/judgment work is the
whole point of this skill. No local-LLM offload here.

Spec output path: `.gor-mobile/specs/YYYY-MM-DD-<topic>-design.md`
(rewritten from the upstream `docs/superpowers/...` at install time —
gor-mobile is a branded superset, not a pass-through).

The `.gor-mobile/` directory is the project-local workspace for spec
and plan artefacts. It MUST be gitignored — these are scratch files
used during development, not audit artefacts that belong in merged
history. Before writing the first spec in a repo:

1. Check the project root for a `.gitignore`. If `.gor-mobile/` (or
   `.gor-mobile`) is already listed, proceed.
2. If absent, append `.gor-mobile/` to `.gitignore` (create the file
   if it doesn't exist) and commit that single-line change with
   message `chore: gitignore .gor-mobile/ (scratch workspace)`.
3. Then write the spec to `.gor-mobile/specs/...`.

Rationale: prevents the scratch-pad workflow (`finishing-a-development-branch`
option 1b) from polluting `main` history with spec/plan docs when the
user merges the feature back as an uncommitted working-tree diff.

### Worktree decision (delta — inserts between checklist steps 8 and 9)

The upstream skill jumps from "User reviews written spec" (step 8) directly
to "invoke writing-plans" (step 9), skipping worktree creation — a known
upstream bug (obra/superpowers#1080, #574, PR #675). Symptom: the spec
commit lands on whatever branch the user is on (typically `main`), and
worktree only materializes inside `executing-plans` / `subagent-driven-development`.

This overlay inserts an explicit worktree-decision step **before** the
spec is written and committed:

**Step 8.5 — Worktree decision (MANDATORY, prompt-based).**

Before `Write`-ing the spec file or running `git commit`, classify the
work and surface the decision to the human partner:

1. If already inside a worktree (check `git rev-parse --git-common-dir`
   differs from `.git`), skip — nothing to do.
2. If the work is a doc-only tweak, a config one-liner, or an explicit
   "hot-patch on current branch" request — skip, note it in the spec's
   header as `Worktree: skipped (reason)`.
3. Otherwise, ask the user exactly once, single message, multiple-choice:

    > Before I commit the spec, set up an isolated worktree?
    > A. Yes — invoke `gor-mobile-using-git-worktrees` now, branch
    >    `feature/<topic>`. Spec + plan + implementation all land on
    >    that branch and end up in one PR.
    > B. No — stay on current branch (`<branch>`). Spec and plan will
    >    be committed here.
    > C. Defer — commit the spec here for now, decide at plan-approval.

    Default recommendation is **A** for any feature/screen/component/refactor.

4. If the user picks A — invoke `Skill(gor-mobile-using-git-worktrees)`
   and continue the flow inside the new worktree (spec, plan,
   implementation). If B or C — continue on current branch, but record
   the choice in the spec header so later skills don't re-ask.
5. Do **not** auto-create a worktree without the user's explicit A —
   upstream #991 established that worktree creation must be opt-in,
   not silent.

Then proceed with checklist step 9 (invoke writing-plans) from the
chosen location.

### Why the overlay (not a patch to the skill body)

1. Upstream policy rejects "compliance" PRs that restructure skill
   bodies without eval evidence (superpowers CLAUDE.md §67). PRs #675
   and #1097 have been open for weeks on exactly this change.
2. Our verbatim-skill guarantee stays intact — the skill body above
   is byte-identical to upstream. Overlay only ADDS.
3. Fixing it at overlay level closes the gap for our users today,
   without blocking on upstream merge.

<!-- END gor-mobile overlay -->
