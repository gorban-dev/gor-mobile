---
name: compose-internals
description: Use when writing, modifying, or reviewing Jetpack Compose UI code — @Composable functions, recomposition and skipping, Compose state (remember / MutableState), side effects in Compose (LaunchedEffect, DisposableEffect, rememberCoroutineScope, SideEffect, produceState, snapshotFlow), stability (@Stable / @Immutable), state hoisting / UDF, modifiers, declarative Compose style. Distilled from "Jetpack Compose Internals" — the rules digest is mandatory reading before any @Composable is written.
---

# Jetpack Compose Internals — rules digest

Mandatory ground rules for any code that creates or modifies a `@Composable`.
Read this digest fully; open the reference file for the topic your task
touches; check your shape against `examples/*.kt`.

## The 9 properties of composable functions

The runtime optimizes (skipping, parallel composition, reordering,
memoization) only because it can assume these properties. Code that breaks
one takes the optimization down with it.

1. **Calling context** — a composable can be called only from another
   composable: the compiler appends an implicit `Composer` parameter and
   forwards it down every call; bodies use it to emit changes to the runtime.
2. **Idempotent** — re-executing with the same inputs must emit the same
   node tree; recomposition and skipping are built on this assumption.
3. **Free of uncontrolled side effects** — the body depends on its
   parameters alone; anything touching the outside world goes through an
   effect handler, which ties it to the composable lifecycle.
4. **Any execution order** — the runtime may run sibling composables in
   whatever order suits it (e.g. by priority); never let one sibling depend
   on another having run first.
5. **Parallel-safe** — recompositions may be offloaded to different threads
   to use multiple cores; bodies must tolerate concurrent execution.
6. **Restartable and reactive** — a body re-executes whenever state it read
   changes, any number of times; the compiler generates restart code for
   every composable that reads state.
7. **Fast execution** — composables do not build UI; they emit data into an
   in-memory structure. Bodies may run every animation frame, so they must
   stay cheap; heavy work goes to a coroutine behind an effect handler.
8. **Skippable** — during recomposition, a call whose arguments are stable
   and unchanged is skipped; a restartable composable should also be
   skippable.
9. **Positional memoization** — identity comes from the call-site position
   in the sources, plus call order inside loops; `remember` and `key(...)`
   are the developer-facing handles on this mechanism.

## State rules

One line each — the linked reference carries the full rule set and mechanics.

- **Stability** — a call is skipped only when every argument is stable and
  compares equal; model inputs as all-`val` data classes of stable types;
  never take stdlib `List`/`Set`/`Map` as parameters (use
  kotlinx.collections.immutable or an `@Immutable` wrapper) →
  `references/stability.md`.
- **Hoisting / UDF** — state down as read-only values, events up as
  callbacks; state lives in the smallest common scope of its readers and
  writers; never pass `ViewModel` or `MutableState<T>` down the tree →
  `references/state-hoisting.md`.
- **Snapshot & threading** — observable data lives in `mutableStateOf` and
  friends (a plain field write invalidates nothing); a read subscribes only
  inside an observed scope (composition, `snapshotFlow`, `derivedStateOf`);
  group related writes with `Snapshot.withMutableSnapshot`; any thread may
  write, but colliding writes on a default-policy object throw at apply →
  `references/snapshot-state.md`.
- **remember semantics** — `remember` is a per-call-site slot, not a shared
  cache: a different parent means a fresh value; one owner remembers,
  children receive parameters → `references/recomposition.md`.
- **Deferred reads** — pass `() -> T` instead of `T` for fast-changing
  values, so only the scope that invokes the lambda recomposes →
  `references/state-hoisting.md`.

## Anti-patterns

### 1. Side effect in the composable body

Never run an effect directly in the body — use the matching effect handler.

```kotlin
// ❌ fires on every recomposition, from any thread, never cancelled
val news = service.fetchHeadlines()

// ✅ owned by the composition: cancelled on leave, relaunched on key change
LaunchedEffect(Unit) { news = service.fetchHeadlines() }
```

Why: breaks idempotence and effect-freedom — the runtime re-executes bodies
at will, so an in-body effect fires an uncontrolled number of times.

### 2. State without `remember`

Every state object created in a body must be remembered.

```kotlin
// ❌ fresh state instance on every pass — the value resets each recomposition
val count = mutableStateOf(0)

// ✅ stored in the slot table; survives re-execution
var count by remember { mutableStateOf(0) }
```

Why: a restartable body re-runs at arbitrary times; only `remember` writes
the value into the slot table so it outlives the invocation.

### 3. Dynamic list without `key(...)`

```kotlin
// ❌ identity = call order; inserting at the top recomposes every row below
for (task in tasks) { TaskRow(task) }

// ✅ identity travels with the data; rows keep state and skip on reorder
for (task in tasks) { key(task.id) { TaskRow(task) } }
```

Why: inside a loop positional memoization falls back to call order, so an
insert or reorder shifts every identity after that point.

### 4. Writing shared or global state from composition

Mutate state only in event callbacks or effect handlers, never mid-body.

```kotlin
// ❌ publishes from a composition that may be re-run, reordered, or discarded
legacyMap.zoomEnabled = uiState.editing

// ✅ runs after every successful composition only
SideEffect { legacyMap.zoomEnabled = uiState.editing }
```

Why: siblings may run in any order or in parallel, and a failed composition
is thrown away — an in-body write leaks from passes that never applied.

### 5. Heavy computation in the body

```kotlin
// ❌ re-sorted on every recomposition of the enclosing scope
val ranked = players.sortedByDescending { it.score }

// ✅ cached; recomputed only when players changes
val ranked = remember(players) { players.sortedByDescending { it.score } }
```

Why: violates fast execution — bodies can re-run every frame; truly heavy
work belongs in a coroutine behind an effect handler.

### 6. Measuring a child twice in a `MeasurePolicy`

```kotlin
// ❌ probe-measure, then measure again — the second call throws
val probe = measurable.measure(constraints)
val real = measurable.measure(Constraints.fixedWidth(probe.width))

// ✅ measure once; when a size is needed early, use intrinsics
val placeable = measurable.measure(constraints)
```

Why: layout is single-pass by contract — one measure per child per pass;
pre-measure estimates go through intrinsics or `SubcomposeLayout`.

### 7. Reading per-frame state in composition instead of the draw phase

```kotlin
// ❌ value read while composing — the whole scope recomposes every frame
Badge(Modifier.graphicsLayer(scaleX = pulse, scaleY = pulse))

// ✅ read inside the draw-phase lambda — only the layer updates
Badge(Modifier.graphicsLayer { scaleX = pulse; scaleY = pulse })
```

Why: state reads are tracked per phase — a read during drawing invalidates
just that node's layer, and the recompose scope never runs.

## Progressive disclosure — what to open when

### References (full rules + mechanics)

| Open when the task involves… | File |
|---|---|
| Recomposition, skipping, `remember`, `key(...)`, callbacks as parameters | references/recomposition.md |
| Effect handlers (LaunchedEffect, DisposableEffect, rememberCoroutineScope, SideEffect, produceState, snapshotFlow), effect keys | references/side-effects.md |
| Model classes, collections, or lambdas used as composable parameters; @Stable / @Immutable | references/stability.md |
| Writing state from coroutines or background threads, atomic multi-field updates, explicit snapshots | references/snapshot-state.md |
| Where state lives, stateless/stateful split, ViewModel boundaries, deferred reads | references/state-hoisting.md |
| Modifier chain order, custom modifier factories, phase-aware state reads | references/modifiers-phases.md |
| Custom `Layout` / `MeasurePolicy`, constraints, intrinsics, semantics / testTag | references/layout-semantics.md |

### Examples (canonical Kotlin shapes — copy the form)

| Copy the shape from… | When writing |
|---|---|
| examples/RecompositionAndKeys.kt | Bodies that survive re-execution; `remember(inputs)` derivations; keyed loops; single call sites |
| examples/StableModels.kt | UI model classes, immutable collections, @Stable / @Immutable annotations, memoized lambdas |
| examples/EffectHandlers.kt | Any effect handler usage — subscriptions, suspend loads, callback-launched jobs, state bridges |
| examples/SnapshotStateUsage.kt | State holders outside composables; background-thread writes; snapshot-scoped reads and writes |
| examples/StateHoistingUdf.kt | Stateful screens: state-down/events-up wiring, stateless core + thin stateful wrapper |
| examples/ModifiersLayoutSemantics.kt | Modifier-heavy UI, custom `Layout`s, drawn controls needing semantics and test tags |
