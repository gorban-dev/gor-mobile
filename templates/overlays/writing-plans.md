<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADDS to it when the target
is an Android/Kotlin codebase.

### No test steps by default (run this FIRST)

Do NOT emit test steps. Plan each task around the implementation plus its
verification step — the task's Gradle/compile/on-device check (on-device
per `[[gor-mobile-using-android-cli]]` where relevant; Codex:
`[[gor-mobile-verification-before-completion]]`) — never a "write the
failing test" step.

The one exception is an **explicit user request** for tests. If the user asked
for tests (for a specific task or the whole feature), plan a normal test step
for the tasks it covers, with real assertions against behavior. Absent that
request, tests are not part of the plan.

> **Red Flag — STOP.** Emitting "Step 1: Write the failing test" into a task by
> reflex. The user did not ask for tests → the plan has no test step. Never
> invent a new seam (a flag, an extracted helper) purely to make something
> unit-testable; plan the minimal change and verify it, on-device where the
> effect is only observable there.

### Docs-first gate (plan phase) — cite the API source in every step

The upstream body tells you to put "full code in each step". That is fine —
**but every step that writes code against an SDK / library / vendor API must
carry the verified signature *and* its source**, taken from the spec's
docs research or a fresh check per the **Docs-first ground-truth contract** in
`[[gor-mobile-using-android-cli]]` (official docs → resolved artifact →
source for behavior). A step that pastes an API signature with no cited source
(docs reference, `javap` output, or source link) is a plan defect: it invites
the implementer to code a remembered, possibly-drifted signature. The
Self-Review gate below verifies this and flags unsourced API signatures.

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
API signature. The Self-Review gate below verifies that every layer-touching
task carries, for each touched layer, one of the three artifact lines, that
each cited path resolves on disk, and that the task's code does not
contradict the cited reference. A layer-touching task with none is a plan
defect.

> **Red Flag — STOP.** A task that designs retry / caching / mapping logic
> into a datasource when the cited layer example is a one-liner. That plan is
> anchored on an external instruction, not the conventions — move the
> behavior where the conventions put it, or escalate.

### Compose gate (plan phase) — every @Composable task carries its rules reference

The Examples-first gate above owns layer placement and shape; this gate owns
**Compose correctness**. Every task that creates or modifies a `@Composable`
function must be authored **after reading** the rules digest of
`[[gor-mobile-compose-internals]]` (the SKILL.md body) plus the reference
files matching the task's surface, and must carry an artifact line:

    Compose rules: references/<file>.md[, references/<file>.md...]

Topics: `recomposition.md` (skipping/restart), `side-effects.md`
(LaunchedEffect / DisposableEffect / rememberCoroutineScope / SideEffect /
produceState / snapshotFlow), `stability.md` (@Stable / @Immutable,
collection parameters), `state-hoisting.md` (UDF, state down / events up),
`snapshot-state.md` (snapshot threading, atomic writes),
`modifiers-phases.md`, `layout-semantics.md` (measure contract, custom
Layout, semantics tree). The paths are relative to the installed
`gor-mobile-compose-internals` skill directory. A `@Composable`-touching task
with no `Compose rules:` line is a plan defect — the Self-Review gate below
verifies this exactly like the `Conforms to:` lines above.

> **Red Flag — STOP.** Authoring a `@Composable` task step from memory of
> Compose patterns. The digest and the cited reference files are the ground
> truth — read them before writing the step's code, and cite what you read.

### Self-Review gate — the plan's own claims are executed, not asserted (MANDATORY)

The body's Self-Review (steps 1-6) is the only reviewer this plan gets: there
is no separate plan-review agent, and the executor treats the plan as ground
truth — an implementer follows a step literally and reports broken code when
the step is what is broken. Run all six steps before the handoff. Steps 4-6
are where an Android/KMM plan actually fails:

- **Verification commands are RUN, on the clean tree, before the plan ships.**
  Gradle: `./gradlew <exact task>` — the real module path, not a guess.
  Deploy: the pipeline from `[[gor-mobile-using-android-cli]]` (gradle build →
  `android describe` → `android run --apks <path>`) — never an invented flag:
  `android run` takes `--apks` / `--device` / `--activity` / `--type` /
  `--install-options` / `--use-delta-install` / `--debug`, and nothing else.
  Check any flag you did not just read in `--help` against `--help`.
  iOS/KMM: never `-destination 'generic/platform=iOS Simulator'` (it forces
  `ARCHS="arm64 x86_64"` while a KMM framework declaring only `iosArm64()` /
  `iosSimulatorArm64()` has no x86_64 slice), and never a hardcoded
  `name=iPhone NN` (`name=` without `OS=` means `OS:latest`, which usually
  resolves to nothing). Resolve a UDID with
  `xcrun simctl list devices available --json` and cite `-destination
  'id=<UDID>'`.
- **Steps are checked against the repo's own hooks.** A `grep`/`rg` for a bare
  identifier in an ast-index repo is refused by the guard hook — cite
  `ast-index usages <symbol>` instead, and reserve grep for literals.
- **Manual steps are labeled.** A step no agent can execute — a store review
  prompt, a beggar whose trigger is a server-side condition, a real invite
  send — is marked `Manual (user):`. An unlabeled one becomes an agent's
  "verified" checkbox over something it never ran.

> **Red Flag — STOP.** Writing a verification command from memory of the
> toolchain, or copying one from an older plan without running it here. Every
> command in the plan has been executed once on this repository, or it is not
> in the plan.

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

The body's Execution Handoff (which now just names `/gor-execute`) is
**replaced** by this fuller sequence. The plan→execute boundary is the
cleanest point to shed context — spec, plan, and checkpoint on disk are
complete ground truth; the planning transcript is dead weight — so **every**
plan exits through a handoff that offers clearing.

1. **Write the initial checkpoint** — unconditionally, first — to
   `.gor-mobile/state/<plan-basename>/progress.md` (a directory named after
   the plan file's basename; `mkdir -p` it — execution skills use the same
   directory for task briefs, reports, and review packages). Seed it with:
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
   `clear`, fresh checkpoint) rehydrates and execution starts by running
   `/gor-execute <plan-path>` (Codex:
   `[[gor-mobile-subagent-driven-development]]` or
   `[[gor-mobile-executing-plans]]` per the plan header, as before). A plain
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

> **Red Flag — STOP.** Ending planning with prose instead of the handoff
> seam, or skipping the handoff because the plan "looks short" or the
> session "feels light". Checkpoint first, then the plan-approval dialog (or
> its fallback) on every plan — the user decides whether to clear, not you.

<!-- END gor-mobile overlay -->
