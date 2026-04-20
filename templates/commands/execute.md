---
description: Executing Plans — inline batch execution of a plan when subagent-driven flow is not a fit
---

Task from user: **$ARGUMENTS**

## gor-mobile overlay (two deltas only)

This command runs the superpowers `executing-plans` skill **verbatim** — read
`~/.claude/skills/gor-mobile-executing-plans/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode section / layer names — read them from the pack's own indexes so this
works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections`. Before executing any
  task that writes Kotlin, load `core` and `architecture`; load additional
  sections (testing-*, debug-*, theme-system, base-viewmodel, modification, …)
  as each task requires.
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers`. Pick 1-3 example
  files from the layer the task touches.

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
This command routes to Opus — no local delegation. Inline batch execution is
the manual alternative to `/implement`; use `/implement` when you want the
local-LLM offload via implementer subagents.

Test commands are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.
