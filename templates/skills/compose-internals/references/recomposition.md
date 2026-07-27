# Recomposition & skipping

Read this before writing any `@Composable` that holds state, loops over data,
or passes callbacks. Canonical form: `examples/RecompositionAndKeys.kt`.

## How it works

- A composable does not build UI; it emits changes into an in-memory
  structure (the slot table). Recomposition is re-execution of a composable
  whose observed state changed, to bring that structure up to date.
- The compiler wraps every restartable composable in a restart group; the
  runtime backs it with a `RecomposeScope` — the smallest region that can
  re-execute independently. When a `State` read inside a scope changes, only
  that scope is invalidated and re-run, not its parents.
- During re-execution the runtime skips a child call when its parameters
  compare unchanged against the values stored in the slot table. The
  `$changed` bitmask lets it shortcut comparisons for compile-time constants
  and for values a parent already compared (comparison propagation).
  Unstable arguments force the full compare-and-store path every time — see
  `references/stability.md`.
- Identity is positional: each call site gets an id from its position in the
  source, plus call order inside loops. `remember` and `key(...)` are the
  developer-facing handles on this positional memoization.
- Control flow gets its own groups: each branch of an `if`/`when` is a
  replaceable group (discarded wholesale when the condition flips); the body
  of `key(...)` is a movable group (identity survives reordering).

## Rules

### 1. Write bodies that survive re-execution

A restartable body may run again at any time — as often as every frame of an
animation. Nothing in it may depend on executing once.

```kotlin
// ❌ mutates on every pass — runs N times, N unknown
@Composable
fun PlayQueue(tracks: ImmutableList<Track>) {
    sessionStats.queueRenders++
    QueueList(tracks)
}

// ✅ one-shot work goes through remember (or an effect handler)
@Composable
fun PlayQueue(tracks: ImmutableList<Track>) {
    val ordered = remember(tracks) { tracks.sortedBy { it.position } }
    QueueList(ordered)
}
```

Why: violates restartability — the runtime is free to re-invoke the body, so
per-invocation side work multiplies unpredictably.

### 2. `remember(inputs)` around any expensive derivation

```kotlin
// ❌ re-sorted on every recomposition of the enclosing scope
val ranked = players.sortedByDescending { it.score }

// ✅ cached in the slot table, recomputed only when players changes
val ranked = remember(players) { players.sortedByDescending { it.score } }
```

Why: violates fast execution — bodies must stay cheap because they re-run
often; truly heavy work belongs in a coroutine behind an effect handler
(`references/side-effects.md`).

### 3. `key(stableId)` around items emitted from a loop

```kotlin
// ❌ identity = call order; inserting at the top recomposes every row below
for (chat in chats) {
    ChatRow(chat)
}

// ✅ identity pinned to the data; rows keep state and skip on reorder
for (chat in chats) {
    key(chat.id) {
        ChatRow(chat)
    }
}
```

Why: inside a loop positional memoization falls back to call order, so an
insert or reorder shifts every identity after that point; `key` emits a
movable group whose identity travels with the data.

### 4. `remember` is a per-call-site slot, not a cache

```kotlin
// ❌ expecting one shared instance across two call sites
@Composable fun ImportScreen() { val parser = remember { CsvParser() } }
@Composable fun ExportScreen() { val parser = remember { CsvParser() } } // new instance

// ✅ one owner remembers; children receive it as a parameter
@Composable
fun DataScreen() {
    val parser = remember { CsvParser() }
    ImportPane(parser)
    ExportPane(parser)
}
```

Why: memoization is scoped to the slots of the calling composable — a
different parent means a different slot range and a fresh value.

### 5. Callbacks must capture only stable values

```kotlin
// ❌ captures an unstable object — a fresh lambda instance every pass
Button(onClick = { repository.retry() })   // repository: unstable class

// ✅ captures a stable value — compiler memoizes the lambda, Button skips
Button(onClick = onRetry)                  // onRetry: () -> Unit parameter
```

Why: the compiler auto-wraps a capturing lambda in `remember` keyed on its
captures only when those captures are stable; an unstable capture recreates
the lambda each recomposition, so the receiver's parameter always "changes".

### 6. One call site, not one call per branch

```kotlin
// ❌ two identities; toggling the flag discards NoteCard's remembered state
if (editing) NoteCard(note, editable = true)
else NoteCard(note, editable = false)

// ✅ one call site, one identity across the toggle
NoteCard(note, editable = editing)
```

Why: each conditional branch is a replaceable group — when the condition
flips, the old group and its slot data are cleaned up, not moved.

### 7. Defer state reads with a lambda instead of forwarding the value

```kotlin
// ❌ read high in the tree: this scope and the layers between recompose per tick
val progress = playback.progress
PlayerShell(progress = progress)

// ✅ pass a lambda; passing it is not a read — only the invoking scope recomposes
PlayerShell(progress = { playback.progress })
```

Why: lambdas are modeled like state holders — handing the instance down does
not read it, so recomposition lands only where it is actually invoked
("donut-hole skipping").
