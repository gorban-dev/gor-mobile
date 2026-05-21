# Changelog

## 0.2.0 — Unreleased

- change: Google Android CLI install is now **hard-mandatory** in
  `gor-mobile init` step 2. Declining the install, an install failure,
  or running on an unsupported platform (anything outside
  `darwin/arm64`, `darwin/x64`, `linux/x64`, `win32/x64`) now fails the
  wizard with a clear error. Auto-install now covers Mac Intel and
  Windows in addition to Mac ARM and Linux x64. `doctor` reports a
  missing `android` binary as `(required)` (was `optional`). Existing
  users: run `gor-mobile init` (or `gor-mobile repair`) after upgrade.
- add: new bridge skill `gor-mobile-using-android-cli` ships at
  `~/.claude/skills/gor-mobile-using-android-cli/SKILL.md`. It maps
  workflow phases (brainstorm/plan/execute/debug/verify) to specific
  `android` CLI commands (`docs search`, `describe`, `run`,
  `screen capture --annotate`, `layout --diff`, journeys, etc.) and is
  authoritative for Android device ops — replacing direct `adb` /
  `./gradlew` invocations for Android targets.
  The 5 phase overlays (`brainstorming`, `executing-plans`,
  `systematic-debugging`, `test-driven-development`,
  `verification-before-completion`) point at it. The SessionStart
  addendum and `~/.claude/CLAUDE.md` managed snippet also reference it.
  Existing users: run `gor-mobile repair` to install the bridge skill
  and refresh the overlays.
- add: new `gor-mobile android-skills` command — interactive
  multi-select that lists Google's upstream catalog
  (`android skills list`) and installs/removes entries via
  `android skills add --agent=claude-code --skill=<name>` /
  `android skills remove …`. Initial selection reflects currently
  installed skills (detected via `~/.claude/skills/<name>/SKILL.md`).
  The wizard now prints a hint at this command after `android init`
  completes.
- add: `doctor` now checks for the
  `gor-mobile-using-android-cli` bridge skill at
  `~/.claude/skills/gor-mobile-using-android-cli/SKILL.md`; reports
  `[warn] gor-mobile-using-android-cli skill missing — run 'gor-mobile repair'`
  if absent.
- add: the global `~/.claude/CLAUDE.md` managed snippet now carries an
  "Android device ops (managed by gor-mobile)" rule pinning Android
  device ops to the `android` CLI / bridge skill. The block is wrapped
  by the existing managed-section markers and is removed cleanly by
  `gor-mobile uninstall`.

## 0.1.0 — 2026-05-14

First tagged release.

- change: code-reviewer dispatch now compares the working tree against
  the base branch (`git diff <BASE_REF>`) instead of the upstream
  `BASE_SHA..HEAD_SHA` commit range. Since gor-mobile cycles never
  auto-commit, the SHA range was usually empty; the working-tree diff
  shows every change the user has accumulated (committed on the branch
  + uncommitted). The overlay also skips dispatch entirely when the
  diff is empty, so reviewer subagents aren't burned on no-op tasks.
  The reviewer agents themselves are unchanged. Existing users: run
  `gor-mobile repair`.
- remove: all automatic git operations (`commit`, `branch`, `checkout`,
  `worktree add`) from skill overlays and the UserPromptSubmit reminder.
  Spec, plan, tests, and implementation code now accumulate as
  uncommitted modifications in the working tree across the full
  `brainstorming → writing-plans → executing-plans → TDD →
  finishing-a-development-branch` cycle. The user reviews `git diff`
  and commits at their own discretion, on whichever branch they want.
  The `gor-mobile-using-git-worktrees` and
  `gor-mobile-finishing-a-development-branch` skills remain installed
  and can be invoked explicitly when the user wants them. Existing
  users: run `gor-mobile repair` to refresh the overlays and the
  UserPromptSubmit hook.
- add: wizard step 2 and `gor-mobile repair` now run `android init` when
  the `android` binary is on `PATH`. This drops the official Google
  `android-cli` skill into `~/.claude/skills/android-cli/SKILL.md`, so
  Claude gets the full command reference in-session instead of only the
  binary being detected. `gor-mobile doctor` now surfaces a warning when
  the skill is missing but the CLI is installed. Existing users: run
  `gor-mobile repair`.
- add: when the `android` binary is absent, wizard step 2 now offers to
  run Google's official installer
  (`curl -fsSL https://dl.google.com/android/cli/latest/darwin_arm64/install.sh | bash`)
  instead of just opening the install page in a browser. The installer
  drops a ~5 MB launcher into `/usr/local/bin/android` (may prompt for
  sudo) and the launcher lazily fetches the full CLI on first run. Under
  `--yes` install proceeds without prompt; under `--dry-run` the command
  is printed but not executed. Auto-install is supported on ARM macOS and
  x86_64 Linux; other platforms get a manual-install note pointing to
  https://developer.android.com/tools/agents. The "Android CLI missing"
  note now includes a `Learn more:` link so users know what they're
  installing before they accept.
- add: `gor-mobile update` now also runs `android update` when the CLI
  is on `PATH`, so a single `gor-mobile update` keeps the rules pack, the
  Android CLI launcher, and gor-mobile's managed files (skills, agents,
  hooks, CLAUDE.md section) in sync.
- add: `gor-mobile uninstall` now prompts at the end whether to also
  remove the Android CLI. If confirmed, it removes the launcher
  (`/usr/local/bin/android`, sudo-escalates if needed), the cached full
  CLI (`~/.android/bin/android-cli`), the CLI cache
  (`~/.android/cli/`), and the `android-cli` skill
  (`~/.claude/skills/android-cli/`). Shared Android SDK state in
  `~/.android/` (avd, adbkey, cache, …) is intentionally left untouched.
  Under `--yes` the Android CLI is **not** removed (no implicit sudo).
- remove: google-dev-knowledge MCP registration step from the wizard. Docs
  lookup now relies on the `android` CLI + `gor-mobile docs`. Existing
  users: run `gor-mobile repair` — it will prune the managed entry from
  `~/.claude/mcp.json`.