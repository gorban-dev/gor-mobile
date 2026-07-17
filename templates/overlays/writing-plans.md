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

### Docs-first gate (plan phase) — cite the API source in every step

The upstream body tells you to put "full code in each step". That is fine —
**but every step that writes code against an SDK / library / vendor API must
carry the verified signature *and* its source**, taken from the spec's
docs research or a fresh check per the **Docs-first ground-truth contract** in
`[[gor-mobile-using-android-cli]]` (official docs → resolved artifact →
source for behavior). A step that pastes an API signature with no cited source
(docs reference, `javap` output, or source link) is a plan defect: it invites
the implementer to code a remembered, possibly-drifted signature. The
plan-document reviewer verifies this and flags unsourced API signatures.

> **Red Flag — STOP.** Emitting "full code" for a task from memory of the API.
> If you cannot cite where a signature came from for the pinned version, you
> have not verified it — resolve it via the ladder before writing the step.

### Examples-first gate (plan phase) — every layer task carries its shape reference

The docs-first gate above owns **external API signatures**; this gate owns
**internal placement and shape**. Every task that creates or modifies a file in
a layer declared in `$HOME/.gor-mobile/rules/examples/index.json` → `.layers`
must be authored **after reading** that layer's example `.kt` files (the
files, not the index) and must carry an artifact line per touched layer —
a task spanning two declared layers carries two lines, or is split per the
Decomposition rules below:

    Conforms to: examples/<layer>/<ExampleFile>.kt

The path is the file entry verbatim from the pack's
`index.json → .layers.<layer>.files` — `examples/<layer>/<ExampleFile>.kt` is the
default pack's shape, not a required prefix.

**Precedence rule.** External requirements (backend contract, ticket, vendor
doc) define *behavior*; the rules-pack conventions define *placement and
shape*. Put the required behavior where the conventions put it (e.g.
retry/error handling in the UseCase) and keep each layer file in its
canonical shape. Genuinely incompatible → STOP and ask the user; never
silently redesign the layer.

**Absence ladder** (examples are an optional, user-replaceable pack feature;
layer membership is defined by the current pack's `index.json`, never by a
remembered default list):

1. No index / no matching layer → ground the task in **project precedent**:
   1–3 existing analogous files from the target repo (`ast-index search` /
   `ast-index conventions`, see `[[gor-mobile-ast-index]]`), recorded
   as `Conforms to (project precedent): <repo paths>`. These files travel
   the pipeline exactly like pack examples (implementer reference files,
   reviewer context).
2. No precedent either → **ask the user** for the shape before authoring the
   task; record `Shape per user: <one-line summary>`.

Never fabricate a citation: an artifact line naming an example file that
does not exist in the current pack is the same defect class as an unsourced
API signature. The plan-document reviewer verifies that every layer-touching
task carries, for each touched layer, one of the three artifact lines and
that the task's code does not contradict the cited reference. A
layer-touching task with none is a plan defect.

> **Red Flag — STOP.** A task that designs retry / caching / mapping logic
> into a datasource when the cited layer example is a one-liner. That plan is
> anchored on an external instruction, not the conventions — move the
> behavior where the conventions put it, or escalate.

### Decomposition: sealed / enum + exhaustive `when` is compile-coupled

Adding a variant to a `sealed` type or `enum` that is read by an **exhaustive
`when`** breaks compilation of every such `when` the moment the variant lands
(Kotlin requires all branches). The type producer and all its mandatory `when`
branches are therefore **compile-coupled** — put them in **one task**, or
sequence tasks so each one still compiles on its own. Splitting "add the
subtype" and "handle it in the `when`" across separate tasks forces the
executor out of its allowed-paths to keep the build green, breaking the
"every task compiles" invariant.

### Override: no baked-in git steps

The body's task template ends each task with a "Commit" step and lists
`frequent commits` under Remember. The gor-mobile overlay **overrides this**: do
NOT bake `git commit` / `git branch` / `git worktree` steps into tasks. Per the
no-automatic-git policy, code accumulates as uncommitted working-tree
modifications and the user decides when to commit. Replace each "Commit" step
with the task's verification step (Gradle test / compile / on-device check).

### Override: Execution Handoff — the clear-context seam (MANDATORY)

The body's Execution Handoff is **replaced**. Never end planning with the
body's two-option "Which approach?" prose. The plan→execute boundary is the
cleanest point to shed context — spec, plan, and checkpoint on disk are
complete ground truth; the planning transcript is dead weight — so **every**
plan exits through a handoff that offers clearing.

1. **Write the initial checkpoint** — unconditionally, first — to
   `.gor-mobile/state/<plan-basename>.progress.md` (basename of the plan file,
   `.md` → `.progress.md`). Seed it with:
   - `Spec:` and `Plan:` — the two file paths.
   - A task table with every task `pending`.
   - `Next action:` — Task 1, plus the execution mode (Subagent-Driven per
     the plan header unless the user chose otherwise earlier).
   Execution fills in decisions/deviations/touched-files later. This must be
   on disk BEFORE the handoff: when the user picks the clear option, you do
   not get another turn.
2. **Hand off through plan mode** (primary path). Call `EnterPlanMode` (skip
   if already in plan mode), then `ExitPlanMode`. Its plan argument is the
   **handoff card**, not the full plan: goal (one line), `Spec:` / `Plan:` /
   `Checkpoint:` file paths, task count, execution mode. The approval dialog's
   first option — "Yes, clear context …" (enabled per-repo by `gor-mobile
   init` via `showClearContextOnPlanAccept`) — makes the harness clear the
   planning context exactly once and restart; the SessionStart hook (source
   `clear`, fresh checkpoint) rehydrates and execution starts at Task 1 via
   `[[gor-mobile-subagent-driven-development]]` (or
   `[[gor-mobile-executing-plans]]` if the plan header says inline). A plain
   "Yes" → same execution, this session, no clearing. "No, keep planning" →
   back to editing.
3. **Fallback — no plan-mode tools available** (tool absent or the call is
   refused): show the same choice as a two-option AskUserQuestion dialog —
   "Clear context & execute (recommended): you run `/clear`, the checkpoint
   rehydrates execution at Task 1" / "Execute without clearing". If clear is
   chosen, reply with exactly one line — "Checkpoint written — run `/clear`
   now; execution resumes at Task 1 after rehydration." — and END YOUR TURN
   (you cannot clear context yourself).
4. **Codex:** no plan mode and no AskUserQuestion — ask the same two options
   as a plain-text numbered question, then stop and wait; the clear analogue
   is `/compact`.

**If the whole session ran in user-initiated plan mode:** files are not
writable before approval — skip step 1, put the full plan text (not the card)
into `ExitPlanMode`, and make writing the plan file + checkpoint the plan's
step 0, executed first thing after the handoff lands (post-clear the seeded
plan text carries everything needed to do that).

> **Red Flag — STOP.** Emitting the body's "Which approach?" question, ending
> planning with prose, or skipping the handoff because the plan "looks short"
> or the session "feels light". Checkpoint first, then the plan-approval
> dialog (or its fallback) on every plan — the user decides whether to clear,
> not you.

<!-- END gor-mobile overlay -->
