---
description: Android — systematic debugging for crashes, regressions, "doesn't work"
---

# /debug — systematic debugging

Task from user: **$ARGUMENTS** (stacktrace, symptoms, reproduction)

## Preconditions

- Read `$HOME/.gor-mobile/rules/rules/debug.md`
- Gather: device info, build variant, reproduction steps, full stacktrace

## Phase 1 — characterize the bug

1. Restate the symptom precisely. Ask the user for any missing reproduction steps.
2. Identify the failure type:
   - Crash (stacktrace available) → Phase 2A
   - Wrong behaviour (no crash) → Phase 2B
   - Flaky / intermittent → Phase 2C

## Phase 2A — crash

- Parse the stacktrace. Note: top frame in YOUR code, not framework.
- Read the file at the crashing line. Form 2-3 hypotheses for the state that triggers the NPE / cast / bounds error.
- Confirm by inspecting the call sites that can produce that state.

## Phase 2B — wrong behaviour

- Isolate the smallest test case / flow that reproduces.
- Compare actual vs expected at each layer: View → ViewModel → UseCase → Repository → DataSource.
- Add strategic logging (state transitions, UseCase inputs/outputs). Delegate log-sprinkle refactors to `gor-mobile llm routine-debug`.

## Phase 2C — flaky

- Identify non-deterministic inputs: timing, main-dispatcher assumptions, init order.
- Reproduce in a unit test first (small seed), then fix in code.

## Phase 3 — fix + regression test

- Fix the minimal cause (do not refactor unrelated code).
- Add a regression test capturing the exact condition (TDD-red style — delegate to `gor-mobile llm tdd-red`).
- Run `/verify` to confirm fix + no regressions.

## Anti-patterns (from rules/debug.md)

- Never wrap the whole ViewModel in `try/catch` to "make it stop crashing"
- Do NOT null-check every nullable — fix the source of the null
- Do NOT delete the failing test — it is telling you something
