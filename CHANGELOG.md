# Changelog

## 0.3.2 — 2026-04-20

Preemptive fixes for 4 known upstream superpowers bugs that bite our users
harder than they bite upstream (two of them specifically because of the
`gor-mobile-` prefix). All four stay open in upstream as of the audit
(2026-04-20).

**Action required:** run `gor-mobile repair` after upgrading. No data
migration; the install-time sed has more substitutions and one overlay
grew an addendum.

- **#1002 — `Skill("brainstorming")` lookup fails.** Upstream
  `using-superpowers/SKILL.md` flow diagram uses plain
  `"Invoke brainstorming skill"` text in dot labels, causing intermittent
  `Skill("brainstorming")` calls that error with "Unknown skill". Our
  previous sed only rewrote `superpowers:` cross-references, which left
  these plain labels unchanged — meaning our users could never resolve
  `Skill("brainstorming")` (ours is `gor-mobile-brainstorming`). Added
  targeted sed for the two diagram-label forms (`brainstorming` +
  `writing-plans`). Verified by new init test.
- **#1091 — worktree global fallback leaks into `~/.config/superpowers/`.**
  `using-git-worktrees/SKILL.md` references `~/.config/superpowers/worktrees/`
  in 4 places. Install-time sed now rewrites to
  `~/.config/gor-mobile/worktrees/` — correct brand, no more accumulation
  under a foreign config dir (upstream reports 1GB+ for 3 branches).
- **#1058 — subagent anchoring on "5 tasks".** Example workflow line in
  `subagent-driven-development/SKILL.md` reads
  `[Extract all 5 tasks with full text and context]` and the model
  anchors on that number, stopping after task 5 regardless of actual
  count. Install-time sed rewrites to `[Extract all tasks ...]`.
- **#1077 — `requesting-code-review` dispatched as Agent type, errors
  out.** Upstream's Integration bullet list mixes Skills and Agent types
  without distinguishing them. Added a "Skill-vs-Agent dispatch"
  clarification to the `subagent-driven-development` overlay listing
  which name goes through which tool (and calling out that our
  `gor-mobile-code-reviewer` agent is invoked *by* the
  `gor-mobile-requesting-code-review` skill, not as a sibling entry point).
- **Tests: 45 → 46.** New `init_test.bats` case asserts all three
  install-time sed substitutions landed correctly in the installed
  SKILL.md files.

## 0.3.1 — 2026-04-20

Closes a known upstream superpowers bug where `brainstorming` silently
commits the spec on the current branch (usually `main`) because its
checklist never invokes `using-git-worktrees`. See
obra/superpowers#1080, #574 (open since March), PRs #675 / #1097
stalled on mandatory-vs-opt-in disagreement.

**Action required:** run `gor-mobile repair` after upgrading. Picks up
the updated `brainstorming` overlay and the new line in the
UserPromptSubmit reminder.

- **Brainstorming overlay** now inserts a MANDATORY worktree-decision
  step between "user reviews spec" (upstream step 8) and "invoke
  writing-plans" (upstream step 9). Prompt-based, not auto-create
  (per upstream #991): single multiple-choice message with A (create
  worktree, recommended), B (stay on current branch), C (defer). The
  choice is recorded in the spec header so downstream skills don't
  re-ask.
- **UserPromptSubmit reminder** gained one line pointing at the
  worktree-decision step. Safety net against drift on long
  conversations where the overlay signal fades.
- **Skill bodies unchanged.** Upstream `brainstorming/SKILL.md`,
  `writing-plans/SKILL.md`, `using-git-worktrees/SKILL.md` remain
  byte-identical verbatim. All changes live in the overlay layer
  appended on install, so `gor-mobile update` stays drop-in if/when
  upstream merges #675 or #1097.

## 0.3.0 — 2026-04-20

Install wizard is now a proper gum-backed TUI — with a clean fallback to the
previous plain-`read` prompts when gum isn't available.

**Action required:** run `gor-mobile repair` (or `gor-mobile init`) after
upgrading. No data migrations; this just picks up the new `ui.sh` helper
and re-copies templates.

- **Gum-backed wizard.** `lib/commands/init.sh` now delegates prompts, menus,
  confirmations, banners, and spinners to `lib/helpers/ui.sh`. Bordered
  banner, step headers (`Step N/12 │ …`), interactive arrow-key menus for
  model-role assignment, branded colors.
- **bats**: new `ui_test.bats` (12 cases) covers the plain-bash fallback
  of every `ui_*` primitive; new `uninstall_test.bats` (5 cases) verifies
  the cleanup actually removes `$GOR_MOBILE_HOME` including
  `cache/bin/gum`, that secrets are kept by default, and that `--purge`
  deletes them. Total 45 tests (was 28).
- **Auto-bootstrap gum.** On first interactive run, the wizard fetches
  `gum v0.14.5` from GitHub Releases into `~/.gor-mobile/cache/bin/`
  (~3 MB, one-time, macOS + Linux / x86_64 + arm64). No `brew install`
  prerequisite. If the download fails, unsupported arch, or running
  non-TTY/`--yes`/`NO_TUI=1`, the wizard falls back to the previous
  plain-bash prompts — the public `ui_*` API stays identical either way.
- **New `--no-tui` flag** (and `NO_TUI=1` env) for users who prefer the
  plain prompts or run in CI without a TTY.
- **Legacy `log_*` helpers** still live in `lib/constants.sh`; the wizard
  itself uses `ui_*` exclusively. Other commands continue to use `log_*`
  until they gain a UI pass of their own.
- **`gor-mobile uninstall` now actually uninstalls.** Previously only
  `$GOR_MOBILE_HOME/scripts` was removed and the user was told in an
  `log_info` to `rm -rf ~/.gor-mobile` manually — which left behind
  templates, the cached `gum` binary, and the rules-pack git clone.
  The command now wipes `$GOR_MOBILE_HOME` and `config.json` by default,
  keeping only `secrets.env` (API keys — too dangerous to delete by
  default). New `--purge` flag removes secrets too.

## 0.2.7 — 2026-04-20

Skills-workflow fidelity fixes — close the gap between "hook fires" and "agent
actually invokes the skill" on long conversations.

**Action required:** run `gor-mobile repair` after upgrading. Both the
`SessionStart` template and the new `UserPromptSubmit` template need to land
in `~/.gor-mobile/templates/`, and `~/.claude/settings.json` needs the second
hook registered.

- **SessionStart injection restructured.** The Android rules/scripts trailer
  is no longer inside the `<EXTREMELY_IMPORTANT>` envelope. Main block now
  closes on the skills-discipline rules; Android context moves into a
  sibling `<gor-mobile-android-addendum>` block. Restores 1:1 structural
  parity with the upstream superpowers hook — the signal the model anchors
  on is no longer diluted.
- **New `UserPromptSubmit` hook.** Short (~50 words) reminder injected on
  every user prompt: "skills rule applies, check for a match before
  responding, process skills before implementation skills." Counters
  drift on Opus 4.x where the single-shot SessionStart injection fades
  after a few turns. Registered via a mirror of the existing
  `settings_install_session_start_hook` merge helper with the same
  `_managed_by: gor-mobile` tag.
- **`gor-mobile doctor --verbose`.** New flag dumps the first 30 lines of
  what each hook actually emits (emulates the same `bash <hook>` the
  harness runs), plus a per-SKILL.md frontmatter check — catches the
  silent failure mode where the install-time `sed` left a skill with an
  unprefixed `name:` and the skill never matches by id.
- **Portable skill-frontmatter rewrite.** `lib/commands/{init,repair}.sh`
  no longer use `sed -i ''` (BSD-only). Switched to the POSIX paradigm
  `sed … > tmp && mv tmp file`, which works on both macOS BSD sed and
  GNU sed (e.g. when users install `gnu-sed` via Homebrew). Repair also
  runs a post-copy check — any SKILL.md still missing the
  `name: gor-mobile-` prefix is loudly flagged with `log_warn`.
- **Uninstall** cleans the new `UserPromptSubmit` managed entry
  alongside the `SessionStart` one.
- **bats**: `hook_test.bats` grew 6 new cases covering the new hook
  (shape, reminder text) and the injection restructure (closing tag
  before the addendum block). Dropped the non-portable
  "installed skill bodies are verbatim superpowers" case that
  hard-coded an absolute path to a sibling upstream checkout. Total
  28 tests (was 23).

## 0.2.6 — 2026-04-20

Realignment with superpowers; local-LLM delegation ported from craft-skills.

- **Removed all 11 gor-mobile slash-commands.** Workflow now runs entirely
  through the `Skill` tool; main Claude is instructed to invoke the skills
  directly. Legacy `~/.claude/commands/*.md` files that match the old
  templates are cleaned up on `gor-mobile repair` / `uninstall`; anything
  diverged is left in place with a warning.
- **Removed `gor-mobile-advisor` agent.** Its routing logic duplicated what
  the skills already do, and its presence let main Claude bypass the
  superpowers flow.
- **`code-reviewer.md` restored to superpowers verbatim**, re-installed as
  `gor-mobile-code-reviewer.md` with the name prefix applied. The
  Android-spec-only variant introduced in 0.2.5 is gone.
- **Added `writing-skills`** as the 14th skill (superpowers verbatim).
- **Skills body is now verbatim superpowers.** Install-time transforms:
  `sed 's/superpowers:/gor-mobile-/g'` on cross-references and
  `sed 's/^name: /name: gor-mobile-/'` on the frontmatter id, then append
  the optional overlay block from `templates/overlays/<skill>.md`.
- **Overlays (5 files).** `subagent-driven-development`,
  `test-driven-development`, `systematic-debugging`,
  `requesting-code-review`, `brainstorming` — each ADDS an Android rules
  pointer and, where it makes sense, a local-LLM delegation block. Other
  9 skills install verbatim with no overlay.
- **Session-start hook rewritten.** No more Android project gate; every
  session gets the `gor-mobile-using-superpowers/SKILL.md` body injected
  as `additionalContext`, plus a short trailer pointing at the rules pack
  and scripts directory. Mirrors the superpowers hook shape.
- **craft-skills LLM scripts ported verbatim** into `templates/scripts/`
  and installed to `$HOME/.gor-mobile/scripts/` (7 scripts: `llm-config`,
  `llm-agent`, `llm-implement`, `llm-review`, `llm-analyze`, `llm-check`,
  `llm-unload`). These carry a rich `{status, severity, files_changed,
  exports_added, concerns, notes, deviations, routing_hint,
  routing_hint_reasons}` JSON contract, a pre-check LOC-routing to
  `consider-sonnet`, and a scope-restricted `write_file` tool for Gemma.
- **`gor-mobile llm` CLI kept as legacy** for backwards compatibility with
  user scripts. Primary path is the new scripts.
- **Doctor** learned to check `$HOME/.gor-mobile/scripts/` (7 executables),
  `python3`, and LM Studio reachability (warning, not error).
- **bats**: `hook_test.bats` retargeted at the new no-gate behavior,
  `init_test.bats` asserts 14 skills / 0 commands / 1 agent / 7 scripts,
  new `scripts_test.bats` covers the LLM scripts' graceful-degradation
  contract.
- **CLAUDE.md managed section** shrunk to 6 lines pointing at the
  SessionStart hook, the rules pack, and the scripts directory.

## 0.2.5 — 2026-04-20

Major overlay rewrite — full superpowers fidelity.

- Every slash-command is now a thin wrapper (≤30 lines of overlay) that
  directs you to read the verbatim superpowers skill under
  `~/.claude/skills/gor-mobile-<skill>/SKILL.md`. The two overlays ADD to
  (never override) the skill body: architecture rules + examples from
  `~/.gor-mobile/rules/`, and local-LLM delegation for code-gen-heavy roles.
- Added 3 new slash-commands: `/worktree` (using-git-worktrees),
  `/execute` (executing-plans — inline batch alt to `/implement`),
  `/parallel` (dispatching-parallel-agents). Total 11 commands (was 8).
- Skills directory: install wizard now copies 13 verbatim superpowers skills
  into `~/.claude/skills/gor-mobile-*/` (prefix added only to `name:`
  frontmatter to avoid collision with a possible user-installed superpowers).
  Includes subagent-prompt templates (`implementer-prompt.md`,
  `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md`) and
  `code-reviewer.md` for requesting-code-review.
- Removed gor-mobile-specific overrides that broke superpowers flow: the old
  "DO NOT commit" / "use AskUserQuestion" / "no auto-commit" instructions
  are gone. Auto-commit is safe because the superpowers flow runs in a
  worktree created by `/worktree`.
- `gor-mobile-advisor` decision tree expanded from 7 to 10 routes.
- `gor-mobile init` grew from 11 to 12 steps (new `step_8_skills`).
- `gor-mobile uninstall` cleans new commands + `~/.claude/skills/gor-mobile-*/`.
- `gor-mobile repair` copies skills alongside commands and agents.
- `llm.sh` stderr marker + `~/.config/gor-mobile/llm-audit.log` retained as a
  diagnostic aid (not mandated anywhere in the overlays).

## 0.1.0 — 2026-04-19

Initial release.

- CLI dispatcher (`bin/gor-mobile`) with subcommands: `init`, `doctor`, `repair`,
  `update`, `self-update`, `uninstall`, `rules`, `llm`, `docs`, `android`
- 11-step install wizard, idempotent, with `--dry-run` / `--yes` / `--skip-sanity`
- Managed merges into `~/.claude/settings.json` (SessionStart hook),
  `~/.claude/CLAUDE.md` (begin/end markers), `~/.claude/mcp.json`
- SessionStart hook auto-detects Android projects and injects core rules
- LM Studio dispatcher with three presets (`aggressive-local`, `balanced`, `cloud-only`)
  and routing for roles: `impl`, `tdd-red`, `routine-debug`, `review`, `review-deep`,
  `vision`, `analyze`, plus cloud-only roles `brainstorm`, `plan`, `verify`,
  `finishing`
- Rules pack subcommands: `list`, `use`, `update`, `diff`, `validate`
- 9 command templates: `brainstorm`, `plan`, `implement`, `tdd`, `review`, `test-ui`,
  `verify`, `debug`, `finishing-branch`
- 2 agent templates: `gor-mobile-advisor` (proactive router), `code-reviewer`
- 15 bats tests covering init/merge/llm/rules/hook behaviour
- Homebrew tap scaffold (`homebrew-gor-mobile`) + formula generator + release workflow
- Default rules pack (`gor-mobile-rules-default`) with manifest v1.0.0 and 14 example
  Kotlin files across 5 layers
