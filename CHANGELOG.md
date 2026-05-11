# Changelog

## 0.1.0 — Unreleased

Pre-release scaffolding. Under active development on `develop` branch.

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
