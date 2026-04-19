# Android Mobile Dev — gor-mobile workflow (superpowers-derived)

**MANDATORY** for any Android work in this project. The commands below are direct ports of the superpowers skills at `/Users/home/Project/Agents/superpowers` (brainstorming, writing-plans, subagent-driven-development, test-driven-development, requesting-code-review, verification-before-completion, systematic-debugging, finishing-a-development-branch), adapted only for:

1. Local-LLM offload via LM Studio (`gor-mobile llm <role>`).
2. Architecture rules at `$HOME/.gor-mobile/rules/`.

Paths stay on superpowers convention: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.

## Pipeline

```
/brainstorm       → brainstorming: spec to docs/superpowers/specs/ (HARD-GATE)
/plan             → writing-plans: bite-sized TDD plan to docs/superpowers/plans/
/implement        → subagent-driven-development: fresh subagent per task + two-stage review
/tdd              → test-driven-development: RED → GREEN → REFACTOR
/review           → requesting-code-review: dispatch code-reviewer + architecture pass
/verify           → verification-before-completion: evidence before claims
/debug            → systematic-debugging: root cause, no symptom fixes
/finishing-branch → finishing-a-development-branch: verify → 4-option gate → cleanup
```

## Delegation rule (gor-mobile overlay)

For code-generation-heavy work (`/implement`, `/tdd`, routine `/debug`, `/review` architecture pass), you MUST call:

```sh
gor-mobile llm <role> --input <prompt-file>
```

Routes to local LM Studio (Qwen3-Coder / Gemma) per preset. CLI returns JSON `{status, content, model, tokens, elapsed}`. Fall back to Opus only when `status == BLOCKED` or `status == ERROR`.

`/brainstorm`, `/plan`, `/verify`, `/finishing-branch` stay on Opus — the analysis/judgment work is the point.

## Rules location

- Core rules (always in context via this hook): `$HOME/.gor-mobile/rules/rules/core.md`
- Sectional references: `$HOME/.gor-mobile/rules/rules/{architecture,naming,testing,debug,modification}.md`
- Examples: `$HOME/.gor-mobile/rules/examples/<layer>/*.kt`

Never guess file paths from training data — read from `$HOME/.gor-mobile/rules/`.
