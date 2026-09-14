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
- **Phase 4 — reproduce + fix.** Main orchestrator. Verify the fix via the
  task's Gradle/on-device check (per `[[gor-mobile-using-android-cli]]` where
  relevant; Codex: `[[gor-mobile-verification-before-completion]]`). Never
  reshape the bug into a fresh seam (extract a helper, add a model flag) just
  to have something to unit-test: fix it as it stands.

### Docs-first before hypothesis — know how it SHOULD behave (Phase 1→2, before Phase 3)

Before forming a hypothesis or proposing a fix for anything that touches a
framework / library / vendor component (a Compose API, a media3 player, a
lifecycle callback, a Room DAO, a WorkManager constraint, …), establish what
*correct* behavior is from authoritative sources — **not** from training
memory. Locate the problematic part first, then read how it is **supposed** to
work via the **Docs-first ground-truth contract** in
`[[gor-mobile-using-android-cli]]` (official docs — `android docs` for the
Android SDK / Jetpack, the `google-developer-knowledge` MCP server
(`search_documents` → `get_documents`) for Firebase / Google Cloud / Maps /
Play Services when it is connected → resolved-artifact signatures via `javap`
→ source/decompiled read for *behavior*). For Android specifically, `android
docs` and component inspection let you study any component and confirm whether
the current code uses it correctly — use it as the reference against which you
judge the buggy code.

This sharpens the body's Phase 2 ("read the reference implementation
COMPLETELY"): for a framework component, the reference IS the official docs /
artifact source. Only after you know the documented-correct behavior do you form
the Phase 3 hypothesis — "the docs say X must be Y; the code does Z" — instead of
"I think X is wrong." Pass the doc/source findings to the Sonnet
evidence-gathering subagent as part of its report.

A fix proposed while your model of "how it should work" comes from memory is
a guess: component behavior drifts across versions, so read the
docs/artifact for the pinned version first, then hypothesize.

### Android CLI — phase command mapping

For Android/Kotlin targets, the `android` CLI is the primary tool for
this phase. Invoke `[[gor-mobile-using-android-cli]]` to get the
phase→command map. That bridge skill is authoritative for Android
device ops, replacing direct `adb` / `./gradlew` invocations — except where
the CLI has no command: **gestures** (`android screen resolve` → `adb shell
input`) and **device-state reads** (`adb shell dumpsys`, `adb logcat`), which
are the documented path, and `debroid` for live process state (below).

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

### A failing command is diagnosed before it is "fixed" (isolation first)

When a build, test, or verification command fails unexpectedly — especially
one you did not write yourself, e.g. a step from a plan — the FIRST move is
the isolation run, not a hypothesis about your own code:

1. Re-run the exact command on an **unmodified** tree (`git stash` your diff,
   or check the file out to HEAD in a scratch copy). Identical failure → the
   command, its flags, or the toolchain is broken, and your diff is not
   implicated. Say so with the evidence and stop editing.
2. Only if the baseline passes does the failure belong to your change.
3. When the command's own diagnosis exists, run it: `xcodebuild
   -showBuildSettings` for a resolved-arch/destination question, `--help` for
   a flag the CLI rejected, `./gradlew <task> --info` for a task that "did
   nothing".

Field case: three rounds of edits to correct Swift before anyone re-ran the
plan's xcodebuild command on HEAD — where it failed byte-for-byte identically,
because the destination demanded an architecture slice the project had not
built since a KMM target was removed three weeks earlier. One isolation run
would have replaced all three rounds.

"One more fix and the build goes green" is the thought to stop on: three
guesses cost more than one baseline run, and a command that cannot pass on
any tree never goes green.

### Runtime evidence first — debroid (when the bug reproduces on a device)

When the failure reproduces on a connected device/emulator with a debuggable
build AND the `debroid` CLI is installed (`gor-mobile setup` offers it;
check with `which debroid`, source: github.com/PatilShreyas/debroid; the
`debroid-cli` skill in this repo's skills dir carries the full command
reference), gather RUNTIME evidence before forming hypotheses from static
reads. Inside a plan execution (SDD / executing-plans) this is the step that replaces guessing:
an implementer whose verification fails for a runtime reason has `debroid`
available and pre-authorized, and a trapped variable value settles in one
round what three edit-and-rebuild cycles do not:

1. `debroid launch <app_id>` (or `attach` to a running process).
2. Trap the failure: `debroid catch-exception` for crashes,
   `debroid break <session> <file> <line>` for wrong-value bugs.
3. Inspect the trapped state: `debroid pause-state`, `debroid inspect` —
   the variable values at the failure point are the ground truth static
   reading only guesses at.
4. Test a hypothesis in place with `debroid set-var` + `resume` before
   writing any fix: if mutating the suspect value fixes the behavior, the
   hypothesis is confirmed.

Every debroid command returns strict JSON — quote the relevant fields in the
evidence log. No debroid / no device / release-only build → the static path
below stands unchanged.

<!-- END gor-mobile overlay -->
