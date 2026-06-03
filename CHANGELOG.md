# Changelog

## 0.2.1 — 2026-06-03

- change: hooks now inject into the system prompt **only** in a mobile
  (Android/iOS) context, when an opt-in `.gor-mobile.json` marker is present at
  the repo root, or on explicit request (a prompt mentioning `gor-mobile`, or a
  mobile platform word plus a create/build verb). Non-mobile sessions stay clean
  — the `SessionStart` block and the `UserPromptSubmit` turn-reminder are
  suppressed (the hook emits `{}`). Activation is **sticky** for the rest of a
  session once triggered (per-`session_id` flag under `$TMPDIR`). Gating lives
  in a new shared detector `templates/detect-mobile-context.sh` that both hooks
  call; if it is absent (an old install not yet repaired) the hooks fall through
  and inject as before. Skill/agent visibility is unchanged. Existing users: run
  `gor-mobile repair` to copy the detector and the gated hook scripts into
  `~/.gor-mobile/templates/`.

- add: `gor-mobile enable` — writes an opt-in `.gor-mobile.json` marker at the
  current repo root so gor-mobile activates there deterministically (commit it
  to share with the team). `doctor` now also verifies the detector is installed,
  and `doctor --verbose` forces the detector on so it still dumps the hook
  payload.

- change: the `gor-mobile-test-driven-development` skill now applies a **TDD
  applicability gate** before the RED-GREEN-REFACTOR cycle. TDD engages only
  when the change carries behavioral logic **and** the target module has a test
  harness; otherwise it defers (no harness → surface test-debt instead of
  fabricating one) or skips (non-behavioral wiring / config / resources →
  one-line reason), then still routes to `verification-before-completion`. The
  gate keys on the *category* of change, never its size. Lives in the overlay
  (`templates/overlays/test-driven-development.md`); the upstream SKILL.md body
  is untouched. Existing users: run `gor-mobile repair` to pick it up.

## 0.2.0 — 2026-06-01

- fix: hook deduplication no longer leaves duplicate `SessionStart` /
  `UserPromptSubmit` entries. Identity of a managed hook entry was keyed
  solely on the `_managed_by` tag, so any entry written without it (the
  old bash CLI, a manual edit, a format migration, or a broken merge)
  was never collapsed — `init`/`repair` stacked a fresh tagged entry on
  top of the untagged ones, and every extra entry re-injected the full
  hook payload into context on each event. `upsertHook` (and `removeHook`)
  now recognize an entry as managed when it is tagged **or** its command
  points at our `templates/<hook>.sh` (path-independent match), so the
  duplicates self-heal to a single entry on the next `repair`. `doctor`
  stops giving false "NOT registered" advice for untagged hooks and now
  also warns when it finds `N` duplicate managed entries; `repair` logs
  `collapsed N → 1` when it folds duplicates. Existing users: run
  `gor-mobile repair` once to normalize an already-polluted
  `~/.claude/settings.json`. Covered by a new regression test
  (`npm test` → `test/hooks-idempotency.sh`).

- add: optional **Status line** step in `gor-mobile init` (step 9 of 10).
  Offers two Claude Code status lines with inline previews — `Classic`
  (3-line colored bars) and `Cat` (ASCII cat that reacts to context usage) —
  or `Skip`. The chosen variant is written as a managed `statusLine` in
  `~/.claude/settings.json`; both scripts ship in `~/.gor-mobile/templates/`.
  Non-interactive / `--yes` runs skip it, and an existing non-gor-mobile
  `statusLine` is never overwritten without confirmation. `jq` is required to
  render (a missing `jq` warns but does not block). `doctor` reports the
  status line, `repair` re-points a managed one, `uninstall` removes it.
  Existing users: run `gor-mobile repair` after upgrade to copy the new
  template scripts, then re-run `gor-mobile init` to pick a status line.

- add: `ast-index` integration. `gor-mobile init` gains a new step 3 of 10
  (soft check: `which ast-index`) — a missing CLI prints a `warn` and
  the install hint, init continues. A bundled skill
  `gor-mobile-ast-index` ships at
  `~/.claude/skills/gor-mobile-ast-index/SKILL.md` (verbatim upstream
  body v3.29.1 + Android-scoped tail overlay; `references/` carries
  only `android-commands.md` and `module-commands.md`). The three
  process overlays `brainstorming`, `executing-plans`, and
  `systematic-debugging` now instruct Claude to reach for `ast-index`
  before `Grep`/`Read`. Project-level setup (`.claude/rules/ast-index.md`,
  initial `ast-index rebuild`) stays the upstream plugin's job —
  `gor-mobile` does NOT write into any project's `.claude/`. Install the
  CLI separately: `brew tap defendend/ast-index && brew install ast-index`
  (see https://github.com/defendend/Claude-ast-index-search). Existing
  users: run `gor-mobile repair` after upgrade to pick up the new skill
  and refreshed overlays.
- add: `doctor` now reports `ast-index` CLI presence (in Environment,
  status `optional`) and `gor-mobile-ast-index` skill presence (in
  Claude Code integration); both fall back to `warn` with the standard
  `run 'gor-mobile repair'` / brew-tap hint when missing.
- add: the global `~/.claude/CLAUDE.md` managed snippet gains a new
  "Code search (managed by gor-mobile)" rule pointing at
  `[[gor-mobile-ast-index]]` and the `ast-index` CLI. The block is
  inside the existing managed-section markers and is removed cleanly
  by `gor-mobile uninstall`.

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

- change: Android CLI integration redesigned around a **capability contract** (command
  names + `>= 1.0.0` floor) instead of version pinning — Google ships android CLI
  as always-latest, so a pin is neither possible nor aligned with their model.
- change: Install now uses the official Homebrew tap (`brew tap android/tap`) on macOS.
- change: Bridge skill `using-android-cli` rewritten as a thin orchestrator: no
  duplicated flags, no hardcoded skill catalog, no deep-links into the stock skill.
- change: `doctor` now validates the contract (floor + command existence + skill↔contract lint).

**Requires `gor-mobile repair`** to pick up the rewritten bridge skill.

## 0.1.1 — 2026-05-18

- fix: UserPromptSubmit hook template no longer breaks on an embedded
  apostrophe in `user's`. Bash was closing the single-quoted reminder
  string mid-content, which surfaced as `behalf.: command not found`
  warnings on every prompt submission (non-blocking, but noisy). The
  phrasing is now `on behalf of the user`, which carries the same
  meaning without the quoting hazard. Existing users: run
  `gor-mobile repair` to pick up the fix.
- fix: `scripts/release.sh` now bumps `package.json`, `src/constants.ts`,
  and `README.md` and rebuilds `dist/` before tagging. The previous
  script referenced a non-existent `lib/constants.sh` path left over from
  the original bash prototype, and silently failed (`sed: lib/...: No
  such file or directory`) without bumping anything.

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