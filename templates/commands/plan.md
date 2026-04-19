---
description: Android — write a design doc under .claude/plans/ before /implement
---

# /plan — Android implementation plan

Task from user: **$ARGUMENTS**

## Preconditions

- `/brainstorm` must have produced an approved approach. If not, stop and send the user to `/brainstorm`.
- Core rules loaded: `$HOME/.gor-mobile/rules/rules/core.md`
- Reference: `$HOME/.gor-mobile/rules/rules/architecture.md`

## Output

Write a design doc to `.claude/plans/<feature-slug>.md` with these sections:

1. **Goal** — one sentence, user-visible behaviour
2. **Non-goals** — what is explicitly out of scope
3. **Layers affected** — presentation / domain / data / di (checklist)
4. **File plan** — exact filenames per architecture rules:
   - `{Feature}Screen.kt`, `{Feature}View.kt`, `{Feature}ViewModel.kt`
   - `{Feature}ViewState.kt`, `{Feature}ViewEvent.kt`, `{Feature}ViewAction.kt`
   - `{Feature}{Action}UseCase.kt` (one per action)
   - `I{Feature}Repository.kt`, `{Feature}Repository.kt`
   - `{Feature}LocalDataSource.kt` / `{Feature}RemoteDataSource.kt`
   - `{Feature}DiModule.kt`
5. **Data model** — DTOs, mappers, persistence shape
6. **Task breakdown** — ordered, each task independently commit-able
7. **Testing strategy** — UseCase unit tests, Mapper tests, what Compose previews
8. **Risks / open questions**

## Routing

Plan is cloud-routed (Opus) — you write the design yourself, do not call `gor-mobile llm impl`.

## Exit

- Write the plan file
- Summarize it for the user
- Propose: `Run /implement to start executing the plan.`
