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
