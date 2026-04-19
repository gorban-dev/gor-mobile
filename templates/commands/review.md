---
description: Requesting Code Review — dispatch code-reviewer subagent to catch issues
---

Target: **$ARGUMENTS** (feature name, file path, or "last changes")

## Android adaptation (gor-mobile overlay)

This is the superpowers `requesting-code-review` skill, adapted for Android/gor-mobile. The skill text below is verbatim; the overlay only adds:

- **Two passes**: we run review in two stages. (a) **Spec compliance** — dispatched to the `code-reviewer` subagent (installed as `~/.claude/agents/code-reviewer.md`). (b) **Architecture compliance** — delegated to the local LLM:

  ```sh
  gor-mobile llm review      --input <prompt-file>   # standard
  gor-mobile llm review-deep --input <prompt-file>   # for subtle bugs / perf
  ```

  On `status == OK` → use `.content`. On `BLOCKED`/`ERROR` → escalate to Opus.

- **Architecture rubric to include in the review prompt** (drawn from `$HOME/.gor-mobile/rules/rules/core.md` + `architecture.md`):

  - **Structure**: package layout `feature/{name}/{presentation,domain,data,di}`; one class per file.
  - **Screen**: no logic, no `remember`, no UI state holders like `PagerState`.
  - **View**: pure UI; UI state allowed; Preview wrapped in `{App}Theme { }`; lives in its own file.
  - **ViewModel**: extends `BaseSharedViewModel<State, Action, Event>`; no Compose imports; state updates via `updateState { it.copy(...) }`; one-off signals via `sendAction(...)`.
  - **UseCase**: named `{Feature}{Action}UseCase.kt`; extends `UseCase<Params, T>`; `suspend fun execute(params): Result<T>` — **not** `operator fun invoke`.
  - **Repository**: `I{Feature}Repository` interface + `{Feature}Repository` impl; depends only on DataSources.
  - **Theme**: `{App}Theme.colors.*` / `{App}Theme.typography.*` only; no `MaterialTheme.colorScheme`; no hardcoded `Color(0xFF...)` or `TextStyle(fontSize = ...)`.
  - **DI**: matches project framework (Koin or Kodein); contains all dependencies.

  The reviewer MUST report each violation as `[Category] file:line — description` and end with `VERDICT: PASS|FAIL (N issues)`.

- **After the review**: FAIL → hand the issue list back to `/implement` in FIX mode. PASS → run `/verify`.

Everything else — the "review early, review often" principle, the four-field dispatch shape (WHAT/PLAN/BASE_SHA/HEAD_SHA/DESCRIPTION), fix-Critical-immediately rule, red flags — is **unchanged** from superpowers.

---

# Requesting Code Review

Dispatch `code-reviewer` subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch `code-reviewer` subagent:**

Use the Task tool with the `code-reviewer` agent type (installed at `~/.claude/agents/code-reviewer.md`). Provide:

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` — What you just built
- `{PLAN_OR_REQUIREMENTS}` — What it should do (link to `docs/superpowers/plans/<...>.md`)
- `{BASE_SHA}` — Starting commit
- `{HEAD_SHA}` — Ending commit
- `{DESCRIPTION}` — Brief summary

**3. Run the architecture pass via local LLM** (gor-mobile overlay):

```bash
gor-mobile llm review --input /tmp/gor-mobile-review-$$.md
```

The prompt MUST include: list of files under review, their content (or meaningful excerpts), the architecture rubric in the overlay section above, and the instruction to produce the bulleted issue list + final `VERDICT`.

**4. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add LogoutUseCase]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: LogoutUseCase + test
  PLAN_OR_REQUIREMENTS: Task 2 from docs/superpowers/plans/2026-04-20-auth-logout.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added LogoutUseCase with Result<Unit> return and 1 happy-path test

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing error-path test
    Minor: Magic string "clear" in AuthRepository
  Assessment: Ready to proceed after fixes

[Run architecture pass]
$ gor-mobile llm review --input /tmp/gor-mobile-review-$$.md
  → VERDICT: FAIL (1 issue) — [UseCase] LogoutUseCase.kt:12 uses operator fun invoke

You: [Fix both issues, re-run review]
[Continue to Task 3]
```

## Integration with Workflows

**`/implement` (Subagent-Driven Development):**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Inline Execution (executing-plans):**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification
