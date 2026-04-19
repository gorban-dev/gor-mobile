# Android Mobile Dev — gor-mobile workflow

**MANDATORY** for any Android work in this project. Non-trivial tasks go through the pipeline; skipping gates requires `--skip-gate <name>` and user confirmation.

## Pipeline

```
/brainstorm   → explore intent, propose 2-3 approaches (HARD-GATE)
/plan         → write a design doc under .claude/plans/
/implement    → per-task, delegating code gen via `gor-mobile llm impl`
/tdd          → for UseCase/Mapper business logic (RED→GREEN→REFACTOR)
/review       → two-pass (spec + architecture) via code-reviewer agent + `gor-mobile llm review`
/test-ui      → if Compose UI is touched (claude-in-mobile + `gor-mobile llm vision`)
/verify       → evidence-based final check (Opus)
/finishing-branch → merge/PR
```

## Delegation rule (critical)

For code-generation-heavy work (`/implement`, `/tdd`, routine `/debug`), you MUST call:

```sh
gor-mobile llm <role> --input <prompt-file>
```

This routes to the local LM Studio model (Qwen3-Coder / Gemma) per the routing preset. The CLI returns JSON `{status, content, model, tokens, elapsed}`. Only fallback to Opus directly when `status == BLOCKED` or `status == ERROR`.

## Rules location

- Core rules: `$HOME/.gor-mobile/rules/rules/core.md` (always in context via this hook)
- Sectional references: `$HOME/.gor-mobile/rules/rules/{architecture,naming,testing,debug,modification}.md`
- Examples: `$HOME/.gor-mobile/rules/examples/<layer>/*.kt`

Never guess file paths from training data — always read from `$HOME/.gor-mobile/rules/`.
