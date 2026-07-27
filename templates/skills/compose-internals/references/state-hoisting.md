# State hoisting & UDF

Rules for where state lives and how it flows through the tree. Canonical
shape: `examples/StateHoistingUdf.kt` — copy that form when adding
stateful UI.

## Mechanics (why these rules exist)

- Snapshot state (`mutableStateOf`, `derivedStateOf`, ...) is observed:
  the compiler wraps composable bodies so every `state.value` read is
  recorded against that composable's `RecomposeScope`.
- A write invalidates exactly the scopes that recorded a read of that
  object; only those re-execute on the next recomposition.
- Reads register where `.value` is evaluated — not where the `State`
  object is created or passed along.
- The runtime skips composables with unchanged inputs and may run them in
  arbitrary order or on different threads — safe only for idempotent,
  side-effect-free functions that depend on their parameters alone.
- Event-callback writes propagate on snapshot apply; the runtime then
  schedules recomposition of the invalidated readers.

WHERE a read happens decides WHAT recomposes; WHO can write decides
whether skip/reorder/parallel stays safe. Each rule is a corollary.

## Rules

### 1. State down, events up

Pass children read-only values; send changes up as callbacks. A child
never writes state it does not own.

```kotlin
// ❌ child mutates shared state directly
@Composable
fun VolumeRow(volume: MutableState<Float>) {
  Slider(value = volume.value, onValueChange = { volume.value = it })
}

// ✅ value in, event out
@Composable
fun VolumeRow(volume: Float, onVolumeChange: (Float) -> Unit) {
  Slider(value = volume, onValueChange = onVolumeChange)
}
```

Why: a child writing external state is an uncontrolled side effect, and
siblings may run in any order or in parallel — cross-writes create order
dependencies the runtime is free to break.

### 2. State lives in the smallest common scope

Hoist state exactly to the lowest composable shared by all its readers
and writers — never higher.

```kotlin
// ❌ query hoisted to the screen root that doesn't need it
@Composable
fun LibraryScreen(albums: ImmutableList<Album>) {
  var query by remember { mutableStateOf("") }
  SearchRow(query, onQueryChange = { query = it })
  AlbumGrid(albums)
}

// ✅ query owned next to its only reader/writer
@Composable
fun LibraryScreen(albums: ImmutableList<Album>) {
  SearchRow()   // stateful wrapper owns query (rule 3)
  AlbumGrid(albums)
}
```

Why: the `query` read registers the root's `RecomposeScope`, so every
keystroke re-runs the whole screen body; owning state where it is read
confines invalidation to that scope.

### 3. Stateless by default; stateful wrapper only at the boundary

Write the stateless version first (all data via parameters). Add a thin
stateful overload only where a caller needs self-contained behavior.

```kotlin
// ✅ stateless core — reusable, skippable on parameters alone
@Composable
fun RatingBar(rating: Int, onRatingChange: (Int) -> Unit) { /* ... */ }

// ✅ thin wrapper: ownership only, no extra logic
@Composable
fun RatingBar() {
  var rating by remember { mutableStateOf(0) }
  RatingBar(rating, onRatingChange = { rating = it })
}
```

Why: a composable that uses only its parameters to produce output is
idempotent, so the runtime can skip it when inputs are unchanged and
re-execute it at arbitrary times safely.

### 4. Never pass `ViewModel` or `MutableState<T>` down the tree

Pass plain values and callbacks. State holders stay at the root of the
feature.

```kotlin
// ❌ every descendant gets write access and an opaque input
@Composable
fun PlayerControls(viewModel: PlayerViewModel) { /* ... */ }

// ✅ values in, events out
@Composable
fun PlayerControls(isPlaying: Boolean, onTogglePlay: () -> Unit) { /* ... */ }
```

Why: a writable/opaque holder gives arbitrary depths of the tree
uncontrolled write access (a forbidden side effect), and output no longer
follows from parameter values, so idempotence-based skipping is lost.

### 5. Defer reads with lambda providers to narrow the recompose scope

When a fast-changing value is consumed deeper in the tree, pass
`() -> T`, not `T`.

```kotlin
// ❌ .value read in the caller — caller's scope re-runs on every change
NowPlayingBar(progress = playback.progress.value)

// ✅ read deferred into the consumer's scope
NowPlayingBar(progress = { playback.progress.value })

@Composable
fun NowPlayingBar(progress: () -> Float) {
  ProgressStripe(progress)  // only the invoking scope registers the read
}
```

Why: read observers fire where `.value` actually executes, so moving the
read into a lambda re-registers it in the scope that invokes the lambda —
writes then invalidate only that scope.

### 6. Mutate state only in event callbacks, never during composition

```kotlin
// ❌ write while composing
@Composable
fun PlayCounter() {
  var plays by remember { mutableStateOf(0) }
  plays++
  Text("$plays")
}

// ✅ write only from an event
@Composable
fun PlayCounter() {
  var plays by remember { mutableStateOf(0) }
  Button(onClick = { plays++ }) { Text("$plays") }
}
```

Why: composition can re-run at arbitrary times, so an in-body write is a
side effect that makes the function non-idempotent and — because writes
invalidate their readers — can invalidate the very scope being composed.
