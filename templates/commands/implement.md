---
description: Subagent-Driven Development — execute plan task-by-task with two-stage review
---

Task from user: **$ARGUMENTS**

## gor-mobile overlay (two deltas only)

This command runs the superpowers `subagent-driven-development` skill **verbatim** — read
`~/.claude/skills/gor-mobile-subagent-driven-development/SKILL.md` and follow it exactly.

Subagent prompt templates referenced by the skill live alongside it:
- `~/.claude/skills/gor-mobile-subagent-driven-development/implementer-prompt.md`
- `~/.claude/skills/gor-mobile-subagent-driven-development/spec-reviewer-prompt.md`
- `~/.claude/skills/gor-mobile-subagent-driven-development/code-quality-reviewer-prompt.md`

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode section / layer names — read them from the pack's own indexes so this
works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections` maps section-name →
  `rules/<file>.md` paths. When dispatching an implementer/reviewer subagent,
  include `core` + `architecture` excerpts plus whichever sections are
  relevant to the task (testing-*, debug-*, theme-system, base-viewmodel,
  modification, …).
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers` maps layer-name →
  list of example `.kt` files. Include 2-3 files from the matching layer.

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
Implementer subagents MUST generate Kotlin via the local LLM:

    gor-mobile llm impl --input <prompt-file>

CLI returns JSON `{status, model, content, tokens, elapsed_ms}`. On
`status == OK` use `.content`. On `BLOCKED` / `ERROR` fall back to Opus.

Reviewer subagents run via the separate `/review` command (requesting-code-review),
which internally delegates to `gor-mobile llm review` / `review-deep`.

Test commands are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.
