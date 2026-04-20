## Android Mobile Dev (managed by gor-mobile)

- Workflow injected into every session via SessionStart hook.
- Use the `Skill` tool for all workflow steps — see `gor-mobile-*` skill registry.
- Architecture rules: `$HOME/.gor-mobile/rules/` (user-replaceable via
  `gor-mobile rules use <url>`).
- Local-LLM delegation scripts: `$HOME/.gor-mobile/scripts/llm-*.sh` (LM Studio
  required; graceful fallback to Claude when unavailable).
- Run `gor-mobile doctor` to verify, `gor-mobile repair` to restore drift.
