## Android Mobile Dev (managed by gor-mobile)

- Workflow injected into every session via SessionStart hook.
- Use the `Skill` tool for all workflow steps — see `gor-mobile-*` skill registry.
- Architecture rules: `$HOME/.gor-mobile/rules/` (user-replaceable via
  `gor-mobile rules use <url>`).
- Run `gor-mobile doctor` to verify, `gor-mobile repair` to restore drift.

## Android device ops (managed by gor-mobile)

- Android targets: use the `android` CLI (run / screen / layout / …) —
  authoritative via `[[gor-mobile-using-android-cli]]`.
- Never install Android APKs via `adb install` directly — `android run`
  replaces it.

## Code search (managed by gor-mobile)

- Structural lookups — classes, symbols, usages, call hierarchies — go
  through `[[gor-mobile-ast-index]]` (the `ast-index` CLI), NEVER `grep`:
  grep undercounts symbol references and the undercount is invisible.
  ast-index is also 17-69× faster and returns structured results. A
  PreToolUse guard denies bare-identifier greps in initialized repos.
  grep stays correct for literals only (string resources, logs, XML).
- If `.claude/rules/ast-index.md` is missing in an Android repo, run
  the upstream slash command `/ast-index:initialize-android` once
  before searching.

## Context compaction (managed by gor-mobile)

- Long sessions get compacted — by you at a safe boundary, or by Claude Code
  automatically when the window fills. Keep state rehydratable: the gor-mobile
  process skills write a checkpoint to `.gor-mobile/state/<plan>.progress.md`
  at every safe boundary (plan written, each verified task, review outcome).
- After a compaction, if a `.gor-mobile/state/*.progress.md` file exists, read
  it and the plan/spec it references BEFORE continuing; take task state from the
  checkpoint and the plan, not from the summary. The SessionStart hook re-injects
  this pointer on `compact`.
