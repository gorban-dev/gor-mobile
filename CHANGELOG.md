# Changelog

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
