---
description: Systematic Debugging — root-cause investigation before any fix
---

Task from user: **$ARGUMENTS** (stacktrace, symptoms, reproduction)

## gor-mobile overlay (two deltas only)

This command runs the superpowers `systematic-debugging` skill **verbatim** — read
`~/.claude/skills/gor-mobile-systematic-debugging/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode section names — read them from the pack's own indexes so this works
with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections`. Before Phase 1, load
  `core` and every section whose name starts with `debug-` (e.g.
  `debug-root-cause`, `debug-defense`). These contain project-specific
  anti-patterns (e.g. "never wrap the whole ViewModel in try/catch",
  "don't null-check every nullable — fix the source").
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers`. When you need to
  see canonical shapes for the layer you are investigating, pick example files
  from the matching layer.

Android data-flow layers to instrument in Phase 1 step 4 ("Gather Evidence in
Multi-Component Systems") reflect the layers present in `examples/index.json`
(typically: `View → ViewModel → UseCase → Repository → DataSource`).
Log state transitions at ViewModel, inputs/outputs at UseCase,
request/response at DataSource.

Phase 4 step 1 "Create Failing Test Case" uses
`./gradlew :<module>:test --tests "*<Name>Test*"` and lives under the matching
`src/test/kotlin/...` path.

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
Routine legwork only (log-sprinkling, trace refactors, TDD-RED regression test):

    gor-mobile llm routine-debug --input <prompt-file>   # log points, trace edits
    gor-mobile llm tdd-red       --input <prompt-file>   # regression test

Root-cause hypothesis forming stays on Opus — do not delegate the thinking.
