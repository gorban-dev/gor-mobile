# Android Mobile Dev — gor-mobile workflow (superpowers-derived)

**MANDATORY** for any Android work in this project. The slash-commands below are
thin wrappers around the superpowers skills at `/Users/home/Project/Agents/superpowers`,
which are installed verbatim under `~/.claude/skills/gor-mobile-<skill>/`.

Two gor-mobile overlays ADD to, not override, each skill:

1. Architecture rules + examples from `$HOME/.gor-mobile/rules/`.
2. Local-LLM offload via LM Studio (`gor-mobile llm <role>`) for code-gen-heavy roles.

Paths stay on superpowers convention:
`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.

## Pipeline

```
/brainstorm       → brainstorming: spec to docs/superpowers/specs/ (HARD-GATE)
/plan             → writing-plans: bite-sized TDD plan to docs/superpowers/plans/
/worktree         → using-git-worktrees: isolate feature work in a separate worktree
/implement        → subagent-driven-development: fresh subagent per task + two-stage review
/execute          → executing-plans: inline batch alternative to /implement
/parallel         → dispatching-parallel-agents: fan out independent research/tasks
/tdd              → test-driven-development: RED → GREEN → REFACTOR
/review           → requesting-code-review: dispatch code-reviewer + architecture pass
/verify           → verification-before-completion: evidence before claims
/debug            → systematic-debugging: root cause, no symptom fixes
/finishing-branch → finishing-a-development-branch: verify → 4-option gate → cleanup
```

## Delegation rule (gor-mobile overlay)

For code-generation-heavy work (`/implement`, `/tdd`, routine `/debug`,
`/review` architecture pass), the skill body directs you to call:

```sh
gor-mobile llm <role> --input <prompt-file>
```

Routes to local LM Studio (Qwen3-Coder / Gemma) per preset. CLI returns JSON
`{status, content, model, tokens, elapsed}`. Fall back to Opus only when
`status == BLOCKED` or `status == ERROR`.

`/brainstorm`, `/plan`, `/worktree`, `/execute`, `/parallel`, `/verify`,
`/finishing-branch` stay on Opus — the analysis/judgment work is the point.

Every `gor-mobile llm` call prints a one-line marker to stderr
(`[gor-mobile llm] role=… target=… model=… status=… tokens=…`) and appends to
`~/.config/gor-mobile/llm-audit.log`. If you want to verify which role went
where, tail the log:

```sh
tail -n 20 ~/.config/gor-mobile/llm-audit.log | jq .
```

This is a diagnostic aid, not a mandate.

## Rules location

The rules-pack at `$HOME/.gor-mobile/rules/` is self-describing — always read
paths from its indexes, never hardcode names (the user may have swapped in a
custom pack via `gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` → `.sections` — map of section-name
  to `rules/<file>.md` path. `core` is always loaded by this hook; other
  sections (architecture, testing-*, debug-*, theme-system, base-viewmodel,
  modification, …) are loaded by slash-commands on demand.
- `$HOME/.gor-mobile/rules/examples/index.json` → `.layers` — map of
  layer-name (presentation / usecase / repository / data / di in the default
  pack; custom packs may differ) to a list of example `.kt` files.

Never guess file paths from training data — read from
`$HOME/.gor-mobile/rules/manifest.json` + `examples/index.json`, and fall back
to `ls` of `rules/` and `examples/` only if those indexes are missing.
