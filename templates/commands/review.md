---
description: Android — two-pass review (spec + architecture), routed to local Gemma
---

# /review — Android review

Target: **$ARGUMENTS** (feature name, file path, or "last changes")

## Two passes

### Pass 1 — spec review
- Does the implementation satisfy the plan / user intent?
- Covered by the `code-reviewer` agent (invoke it explicitly: `@code-reviewer`).

### Pass 2 — architecture review
Delegate to local LLM:

```sh
gor-mobile llm review --input <prompt-file>
```

For deeper review (suspected subtle bugs, performance concerns):

```sh
gor-mobile llm review-deep --input <prompt-file>
```

## Architecture rubric

Check every item. Report PASS / FAIL with file:line.

Structure:
- [ ] Package layout: `feature/{name}/{presentation,domain,data,di}`
- [ ] One class per file (no god-files)

Screen/View:
- [ ] Screen: no logic, no `remember`, no UI state (no `PagerState` etc.)
- [ ] View: pure UI, UI state allowed, Preview in `{App}Theme { }`
- [ ] View in its own file

ViewModel:
- [ ] Extends `BaseSharedViewModel<State, Action, Event>`
- [ ] No Compose imports
- [ ] State updates via `updateState { it.copy(...) }`
- [ ] One-off events via `sendAction(...)`

UseCase:
- [ ] `{Feature}{Action}UseCase.kt`
- [ ] Extends `UseCase<Params, T>`
- [ ] `suspend fun execute(params): Result<T>` — NOT operator fun invoke

Repository:
- [ ] `I{Feature}Repository` interface + `{Feature}Repository` impl
- [ ] Depends only on DataSources

Theme:
- [ ] `{App}Theme.colors.*` / `{App}Theme.typography.*` only
- [ ] No `MaterialTheme.colorScheme`, no hardcoded `Color(0xFF...)`
- [ ] No hardcoded `TextStyle(fontSize = ...)`

DI:
- [ ] Matches project framework (Koin or Kodein)
- [ ] Contains all dependencies

## Prompt template

Write `/tmp/gor-mobile-review-$$.md`:

- List of files under review (with paths)
- Full content of each file (or meaningful excerpts)
- The architecture rubric above
- Instruction: "Produce a bulleted list of Issues. Each issue: `[Category] file:line — description` (categories: Structure/Screen/View/ViewModel/ViewState/UseCase/Repository/DI/Theme/Rendering/Interaction/Navigation/Data/Accessibility/Crash). End with a summary: `VERDICT: PASS|FAIL (N issues)`."

## After the review

- If FAIL — hand the issue list to `/implement` in FIX mode.
- If PASS — run `/verify` for final confirmation.
