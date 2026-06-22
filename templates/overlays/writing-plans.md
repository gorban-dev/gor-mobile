<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADDS to it when the target
is an Android/Kotlin codebase.

### TDD applicability gate — per task, before baking in a test step (run this FIRST)

The body's task template hardcodes "**Step 1: Write the failing test**" and
lists `TDD` under Remember. That test step is **not unconditional** — it is
governed by the **TDD applicability gate** in
`[[gor-mobile-test-driven-development]]`, the single source of truth for "does
this change need a test." Bake the gate's *verdict* into each task instead of a
blanket test step:

- For each task, while authoring the plan, run the gate (Q1 behavioral logic? /
  Q2 harness reachable?) against that task's **minimal** change.
- Verdict **applies** → write the failing-test step with real assertions, as
  the body prescribes.
- Verdict **not warranted** (UI-flag / wiring / DI / resources — no behavioral
  logic) → do NOT write a test step. Record one line — `TDD skipped: <reason>` —
  plus an explicit verification step
  (`[[gor-mobile-verification-before-completion]]`, on-device per
  `[[gor-mobile-using-android-cli]]` where relevant).
- Verdict **deferred** (logic, but no harness) → no fabricated harness step;
  note the gap for the user per the gate.

> **Red Flag — STOP.** Emitting "Step 1: Write the failing test" into every task
> by reflex, without running the gate. A plan that mandates a test for a
> button-visibility / wiring task is the leak this gate closes — the executor
> will then write that pointless test under the plan's authority. Never invent a
> new seam (a flag, an extracted helper) in a task purely to make something
> unit-testable; plan the minimal fix and gate it as-is.

### Override: no baked-in git steps

The body's task template ends each task with a "Commit" step and lists
`frequent commits` under Remember. The gor-mobile overlay **overrides this**: do
NOT bake `git commit` / `git branch` / `git worktree` steps into tasks. Per the
no-automatic-git policy, code accumulates as uncommitted working-tree
modifications and the user decides when to commit. Replace each "Commit" step
with the task's verification step (Gradle test / compile / on-device check).

<!-- END gor-mobile overlay -->
