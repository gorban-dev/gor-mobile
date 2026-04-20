---
description: Brainstorming — turn idea into fully-formed design + spec before /plan (HARD-GATE)
---

Task from user: **$ARGUMENTS**

## gor-mobile overlay (two deltas only)

This command runs the superpowers `brainstorming` skill **verbatim** — read
`~/.claude/skills/gor-mobile-brainstorming/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode section / layer names — read them from the pack's own indexes so this
works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections` maps section-name →
  `rules/<file>.md` paths. Load `core` always; load the sections relevant to
  the task (architecture, testing-*, debug-*, theme-system, base-viewmodel,
  modification, …) based on what you see there.
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers` maps layer-name →
  list of example `.kt` files. Pick 1-3 files from the layers your proposal
  touches.

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
This command routes to Opus — no local delegation. Analysis/judgment is the point.

Paths stay on superpowers convention:
`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.

Test commands are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.
