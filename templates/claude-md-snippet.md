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

- Use `[[gor-mobile-ast-index]]` (and the `ast-index` CLI) before
  `Grep`/`Read` for any structural lookup — classes, symbols, usages,
  call hierarchies. ast-index is 17-69× faster than `grep` and returns
  structured results.
- If `.claude/rules/ast-index.md` is missing in an Android repo, run
  the upstream slash command `/ast-index:initialize-android` once
  before searching.
