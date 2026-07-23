<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Load `core` + `debug-*` sections from `$HOME/.gor-mobile/rules/` via
`manifest.json` at the start of Phase 1 (symptom narrowing).

### Phase-to-model assignment

- **Phase 1 — symptom narrowing.** Main orchestrator (session model).
  Clarifying what "broken" actually means is judgement work.
- **Phase 2 — evidence gathering.** Log scan, stack-trace reading,
  skimming unfamiliar modules for a suspect function — high-volume
  read-only work. Delegate to Sonnet with read-only tools only:

        Task(
          subagent_type = "general-purpose",
          model         = "sonnet",
          prompt        = <evidence-gathering-prompt>
        )

  Instruct the subagent to use only Grep / Read / Glob and to return a
  structured report (findings + cited file:line references). No Edit,
  no Write.
- **Phase 3 — hypothesis formation.** Main orchestrator (session model).
  Causal reasoning over the evidence is not worth a round-trip.
- **Phase 4 — reproduce + fix.** The body's Phase 4 Step 1 ("Create Failing
  Test Case — MUST have before fixing") is **overridden**: do NOT write a test
  by default. Reproduce the bug however is cheapest (a manual repro, a log, a
  throwaway script), fix the root cause, and confirm the fix via
  `[[gor-mobile-verification-before-completion]]` (on-device per
  `[[gor-mobile-using-android-cli]]` where the effect is only observable
  there). Write a regression test **only if the user explicitly asks** for one.

  > **Red Flag — STOP.** Creating a `*Test*` file, or going "I'll go
  > test-first," because "the debugging skill said MUST create a failing test."
  > The user did not ask for a test → do not write one. And never reshape the
  > bug into a fresh seam (extract a helper, add a model flag) just to have
  > something to unit-test: fix it as it stands.

### Docs-first before hypothesis — know how it SHOULD behave (Phase 1→2, before Phase 3)

Before forming a hypothesis or proposing a fix for anything that touches a
framework / library / vendor component (a Compose API, a media3 player, a
lifecycle callback, a Room DAO, a WorkManager constraint, …), establish what
*correct* behavior is from authoritative sources — **not** from training
memory. Locate the problematic part first, then read how it is **supposed** to
work via the **Docs-first ground-truth contract** in
`[[gor-mobile-using-android-cli]]` (official docs through `android docs` →
resolved-artifact signatures via `javap` → source/decompiled read for
*behavior*). For Android specifically, `android docs` and component inspection
let you study any component and confirm whether the current code uses it
correctly — use it as the reference against which you judge the buggy code.

This sharpens the body's Phase 2 ("read the reference implementation
COMPLETELY"): for a framework component, the reference IS the official docs /
artifact source. Only after you know the documented-correct behavior do you form
the Phase 3 hypothesis — "the docs say X must be Y; the code does Z" — instead of
"I think X is wrong." Pass the doc/source findings to the Sonnet
evidence-gathering subagent as part of its report.

> **Red Flag — STOP.** Proposing a fix for a framework/library symptom while
> your model of "how it should work" comes from memory. Cutoff → component
> behavior drifts across versions. Read the docs/artifact for the pinned version
> first, then hypothesize.

### Android CLI — phase command mapping

For Android/Kotlin targets, the `android` CLI is the primary tool for
this phase. Invoke `[[gor-mobile-using-android-cli]]` to get the
phase→command map. That bridge skill is authoritative for Android
device ops, replacing direct `adb` / `./gradlew` invocations.

### Trace the bug — ast-index first

In Phase 2 (evidence gathering), prefer `[[gor-mobile-ast-index]]`
queries over `Grep` when distilling stack traces or chasing call chains:

- `ast-index usages "<Symbol>" --limit 1000` — every place the suspected
  symbol is touched (the default `--limit 50` clips the headline count).
- `ast-index callers "<function>"` — who calls a suspect function.
- `ast-index implementations "<Interface>"` — to enumerate concrete
  paths when the trace lands on an interface.
- `ast-index call-tree "<entry>" --depth 3` — call chains for narrowing
  hypotheses.

Pass these instructions to the Sonnet evidence-gathering subagent so it
uses `ast-index` (read-only) instead of `Grep` whenever applicable.

<!-- END gor-mobile overlay -->
