<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### TDD applicability gate (run this FIRST)

This gate is gor-mobile project policy and runs **before** the body's
"When to Use" / "Iron Law" and before the RED-GREEN-REFACTOR cycle. Its outcome
decides whether that cycle engages at all. Precedence is legitimate: per
`[[gor-mobile-using-superpowers]]`, the project layer overrides default skill
behavior, and this overlay is that layer.

Answer two **objective** questions about the change:

**Q1 — Does it carry behavioral logic?**
Logic expressible as input→output or a state transition: branching, computation,
parsing, mapping/transformation, validation, error handling, business rules,
use-cases, reducers.
NOT behavioral: DI / module wiring (Hilt/Koin/Dagger), navigation graph,
resources / XML / layout / strings / drawables, gradle / build config,
dependency bumps, DTO / data-class with no logic, plain delegation /
pass-through, generated code, logging-only changes, bare constants.

Also NOT behavioral — **UI-interaction wiring observable only on-device**:
swapping or tuning a pre-built Compose `Modifier` (`debounceClickable` ⇄
`clickable`, ripple, click / long-press plumbing, padding, arrangement,
size), theming, and `@Composable` layout assembly that holds no logic of
its own. A difference you can see only by tapping the running app —
throttled-vs-immediate clicks, visual layout — is not a JVM input→output,
so a unit test is the wrong tool: this is **Q1 = NO → TDD not warranted**,
and you verify it on-device per `[[gor-mobile-verification-before-completion]]`
(and `[[gor-mobile-using-android-cli]]`). Boundary: this covers
choosing / tuning a framework modifier, NOT authoring new logic inside the
handler — if the lambda computes, branches, validates, or drives a state
reducer, that logic IS behavioral (Q1 = YES); extract it from the UI and
test it.

**Q2 — Is a test harness reachable for the target module?**
The module has a test sourceset (`src/test/…` JVM unit, or `src/androidTest/…`
instrumented) AND a test-runner dependency. Check structurally
(`ast-index map` or file presence) — not deep analysis.

| Q1 | Q2 | Verdict | Action |
|----|----|---------|--------|
| YES | YES | **TDD applies** | Proceed to the sections below (Architecture rules + Stage-to-model assignment), unchanged. |
| YES | NO | **TDD deferred** | Do NOT fabricate a harness — that is unrelated infra work. Implement via the normal path and surface the gap: tell the user "module `<x>` has no test harness; this logic is untested — set up testing, or I can in a separate task." |
| NO | — | **TDD not warranted** | Skip the cycle. Record one line in the summary, e.g. "TDD skipped: DI wiring, no behavioral logic." |

**The gate tests the CATEGORY of change, never its size.** A one-line change to
real logic (e.g. `<` → `<=` in a boundary check) still gets a test — that is
where tests pay off most. "Too small to test" is not a verdict here; if a change
feels too small, it is almost always because it is non-behavioral (Q1 = NO),
which the gate already handles. Never use line-count or effort as a reason to
skip — that is exactly the rationalization the body above correctly forbids.

When the gate returns **deferred** or **not warranted**:
- You still owe verification before claiming done — invoke
  `[[gor-mobile-verification-before-completion]]`. "No TDD" never means "no checks".
- State the verdict in one line so the user has a record and can object.
- The user can override either way ("write a test anyway" / "skip it here"); the
  gate is the default, not a law.
- The gate outranks a plan's prescribed step: if a `writing-plans` plan hardcodes
  "Write the failing test" but the gate returns *not warranted*, skip that step.

### Architecture rules
Before writing tests or implementation, load the relevant rules sections
from `$HOME/.gor-mobile/rules/` (always `core` + `architecture`; plus
`testing-*` sections that match the layer under test). Paths come from
`manifest.json` — never hardcode.

### Stage-to-model assignment

- **RED (write the failing test)** — main orchestrator (Opus). The
  assertion set is the contract; drafting it is judgement work.
- **GREEN (make the failing test pass)** — delegate to Sonnet:

        Task(
          subagent_type = "general-purpose",
          model         = "sonnet",
          prompt        = <green-task-prompt>
        )

  The prompt's allowed-paths list MUST exclude the test file itself, so
  Sonnet cannot weaken the assertion to make the test trivially pass.
  Reference files: the failing test + 1–2 layer examples from the rules
  pack.

- **REFACTOR** — main orchestrator (Opus). Refactoring requires holistic
  judgement across files the GREEN subagent wasn't scoped to see.

After every GREEN dispatch, the orchestrator runs the Gradle test itself:
`./gradlew :<module>:test --tests "*<Name>Test*"`.

### Override: no automatic commits

Never run `git commit` between RED / GREEN / REFACTOR cycles. Tests
and code accumulate as uncommitted modifications in the working tree.
The user decides when to commit.

### Android CLI — phase command mapping

For Android/Kotlin targets, the `android` CLI is the primary tool for
this phase. Invoke `[[gor-mobile-using-android-cli]]` to get the
phase→command map. That bridge skill is authoritative for Android
device ops, replacing direct `adb` / `./gradlew` invocations.

<!-- END gor-mobile overlay -->
