## Android Mobile Dev (managed by gor-mobile)

- Workflow injected into every session via SessionStart hook.
- Follow the `gor-mobile-*` skills in `$CODEX_HOME/skills/` (default
  `~/.codex/skills/`). If your harness exposes no skill-invocation tool,
  read the matching `SKILL.md` directly before the step — reading it
  satisfies the requirement in full.
- Subordinate sessions: if you were dispatched by another agent as a
  reviewer or task executor (e.g. via codex-companion `review` /
  `adversarial-review`), skip the workflow skills and do the dispatched
  job directly — a review request means "review this diff now", not
  "run the full workflow first". NEVER invoke codex-companion from
  inside a Codex session: the second-opinion pass is owned by the
  dispatching agent, and a nested invocation recurses.
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
