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
and plan artefacts. It should be gitignored — these are scratch files
used during development. If `.gor-mobile/` (or `.gor-mobile`) is not
yet listed in the project `.gitignore`, append it silently and leave
the modification uncommitted in the working tree. Do NOT run
`git commit` for this — the user owns all commit decisions.

### Override: no automatic commits, branches, or worktrees

The upstream skill body instructs you to "commit the design document to
git" and to create branches/worktrees for isolation. The gor-mobile
overlay **overrides this** for every invocation, regardless of project
size or perceived complexity:

- Write the spec file to `.gor-mobile/specs/...` and stop.
- Never run `git commit`, `git branch`, `git checkout`, or
  `git worktree add` from inside this skill.
- All artefacts (spec, plan, code) accumulate as uncommitted
  modifications in the current working tree. The user reviews
  `git status` / `git diff` at their own pace and commits when ready.

Then proceed with checklist step 9 (invoke writing-plans) on the
current branch, unchanged.

<!-- END gor-mobile overlay -->
