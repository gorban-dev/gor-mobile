## Android Mobile Dev (managed by gor-mobile)

When working on Android projects:

- Use slash-commands `/brainstorm`, `/plan`, `/implement`, `/tdd`, `/review`, `/test-ui`, `/verify`, `/debug`, `/finishing-branch`
- Architecture rules live in `$HOME/.gor-mobile/rules/` (auto-injected into context by the SessionStart hook)
- Delegate routine code generation via `gor-mobile llm <role> --input <file>` — local LM Studio first, Opus fallback
- Run `gor-mobile doctor` if anything misbehaves, `gor-mobile repair` to restore managed files
- Update with `brew upgrade gor-mobile && gor-mobile update`
