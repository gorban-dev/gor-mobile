---
description: Writing Plans — bite-sized TDD implementation plan under docs/superpowers/plans/
---

Task from user: **$ARGUMENTS**

## gor-mobile overlay (two deltas only)

This command runs the superpowers `writing-plans` skill **verbatim** — read
`~/.claude/skills/gor-mobile-writing-plans/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode section / layer names — read them from the pack's own indexes so this
works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections` maps section-name →
  `rules/<file>.md` paths. Always load `core` and `architecture` (if present);
  load other sections as they become relevant per task.
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers` maps layer-name →
  list of example `.kt` files. When a task touches a layer, reference the
  matching example files in that task's "Files" section so the implementer
  knows the canonical shape.

Treat the rules-pack as authoritative for naming and layer split — do not
reproduce patterns from memory. If `manifest.json` / `examples/index.json`
are missing, fall back to `ls $HOME/.gor-mobile/rules/rules/*.md` and
`ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
This command routes to Opus — no local delegation.

Test commands in RED/GREEN steps are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.

Paths stay on superpowers convention:
`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
