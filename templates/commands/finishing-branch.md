---
description: Finishing a Development Branch — verify tests, present options, execute choice
---

Target: **$ARGUMENTS** (optional — current branch is assumed)

## gor-mobile overlay (two deltas only)

This command runs the superpowers `finishing-a-development-branch` skill **verbatim** — read
`~/.claude/skills/gor-mobile-finishing-a-development-branch/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
Test command for Step 1: `./gradlew test` (or the project's root test aggregator).
If the project has a `connectedAndroidTest` flow required for merge, run it too
and include its result.

Optional tidy-up checklist before presenting options: no `println`, no stale
TODOs, no commented-out code, commit messages use conventional style
(`feat:`, `fix:`, `refactor:`…). If the branch is noisy, propose a squash plan
and WAIT for user approval before rewriting history.

PR body template to fill on Option 2:

    ## Summary
    <1-3 bullets: what changed, user-visible impact>

    ## Changes
    - <layer/feature>: <what>
    - ...

    ## Testing
    - Unit tests: <what was added/covered>
    - Manual: <verification evidence or screenshots>

    ## Risks / follow-ups
    - ...

### 2. Local-LLM delegation
This command routes to Opus — no local delegation.
