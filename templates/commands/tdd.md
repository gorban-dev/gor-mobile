---
description: Test-Driven Development — RED → GREEN → REFACTOR for any behavior change
---

Task from user: **$ARGUMENTS**

## gor-mobile overlay (two deltas only)

This command runs the superpowers `test-driven-development` skill **verbatim** — read
`~/.claude/skills/gor-mobile-test-driven-development/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode section / layer names — read them from the pack's own indexes so this
works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections`. Load `core` always,
  then every section whose name starts with `testing-` (e.g. `testing-design`,
  `testing-anti-patterns`, `testing-mocking`) — these govern what a good test
  looks like in this project.
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers`. Pick 1-2 example
  files from the layer matching the unit under test (usecase, viewmodel, …).

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
For Kotlin code generation in the RED and GREEN phases:

    gor-mobile llm tdd-red --input <prompt-file>   # failing test
    gor-mobile llm impl    --input <prompt-file>   # minimal implementation

On `status == OK` use `.content`. On `BLOCKED` / `ERROR` fall back to Opus.

Test commands are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.

For UI/integration tests use the project's `connectedAndroidTest` task or the
Compose test runner already wired up.

TDD is MANDATORY for UseCase and Mapper business logic (pure Kotlin).
For ViewModel state machines it is strongly recommended. Pure Compose UI does
not have a forced RED phase.
