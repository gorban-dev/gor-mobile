# Changelog

## 0.3.0 — 2026-04-20

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
