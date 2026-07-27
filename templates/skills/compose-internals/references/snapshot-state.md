# Snapshot state

Read this before storing any observable value, writing state from a
coroutine or background thread, or reading state outside composition.
Canonical form: `examples/SnapshotStateUsage.kt`.

## How it works (MVCC, condensed)

- Snapshot state is whatever `mutableStateOf`, `mutableStateListOf`,
  `mutableStateMapOf`, `derivedStateOf`, `collectAsState` and friends
  return: a `State` object the runtime can observe. The compiler wraps
  every composable body so each `.value` read inside it is reported to a
  read observer and recorded against the enclosing `RecomposeScope`; a
  later write to that object invalidates exactly those scopes.
- Storage is multiversion concurrency control (MVCC): a write never
  mutates in place — it prepends a new state record, tagged with the
  writing snapshot's id, to the object's record list. A read walks the
  list and returns the newest record valid for the current snapshot.
- A snapshot is a point-in-time view of the whole program state, with a
  monotonically increasing id. Records from snapshots that are still
  open, or taken later, are invalid to it. Because visibility is decided
  by ids, reads and writes on different threads need no locking.
- Every composition and recomposition runs inside its own mutable
  snapshot, with the Recomposer's read/write observers attached. When
  the pass ends, `apply` publishes all its writes to the parent (or
  global) state as a single atomic change. The system is optimistic: if
  apply fails, the writes are discarded and a new composition is
  scheduled.
- Collisions between concurrently applied snapshots are handed to the
  object's `SnapshotMutationPolicy.merge`; the default
  structural-equality policy cannot merge, so a genuine collision on the
  same object throws at apply time.

## Rules

### 1. Observable data must live in snapshot state

```kotlin
// ❌ plain field — writes are invisible to the runtime
class CartModel { var itemCount = 0 }

// ✅ snapshot state — every read is tracked, every write invalidates
class CartModel { val itemCount = mutableStateOf(0) }
```

Why: only `State` objects participate in read tracking; a plain field
write creates no state record and never invalidates a `RecomposeScope`.

### 2. A read is a subscription — read inside an observed scope

Dependency tracking exists only where a read observer is installed:
composable bodies, `snapshotFlow`, `derivedStateOf`. A bare read
elsewhere returns a value and registers nothing.

```kotlin
// ❌ one-shot read in a coroutine — nothing re-runs when it changes
scope.launch { if (session.isExpired.value) logout() }

// ✅ snapshotFlow re-executes its block when any state read in it changes
scope.launch {
    snapshotFlow { session.isExpired.value }.first { it }
    logout()
}
```

Why: `snapshotFlow` records the reads in its block and re-emits on
writes to them; a plain `.value` access outside any observed scope is
never recorded, so no invalidation reaches that code.

### 3. Group related writes so they publish atomically

Writes inside a snapshot stay invisible to other snapshots until
`apply`; `apply` publishes them as one atomic change. Multi-field
updates outside composition should share one mutable snapshot.

```kotlin
// ❌ two independent global writes — a concurrent reader can see the
// new item while the total still holds the old value
order.items.add(item)
order.total.value += item.price

// ✅ all-or-nothing: both writes land in one atomic apply
Snapshot.withMutableSnapshot {
    order.items.add(item)
    order.total.value += item.price
}
```

Why: atomic apply is the transactional-memory guarantee of the snapshot
system; separate writes straight to global state propagate one by one,
exposing intermediate states that break invariants spanning objects.

### 4. Concurrent writers need explicit snapshots plus a merge policy

Isolation belongs to explicit snapshots, not to threads. Inside
`Snapshot.withMutableSnapshot` a write stays local until `apply`, where
collisions with other snapshots are detected. A bare write from another
thread is a read-modify-write on shared global state: no isolation, no
`apply`, so `SnapshotMutationPolicy.merge` never runs and concurrent
increments can be lost.

```kotlin
// ❌ bare global read-modify-writes race — updates can be lost; even
// wrapped in snapshots, the default policy aborts a collision with a
// runtime error instead of summing
repeat(4) { scope.launch { stats.processed.value++ } }

// ✅ isolated writes that collide at apply, on state whose policy merges
val processed =
    mutableStateOf(0, additiveCountPolicy()) // your merge-capable policy
repeat(4) {
    scope.launch { Snapshot.withMutableSnapshot { processed.value++ } }
}
```

Why: collision detection and `merge` run only when an applying snapshot
propagates its changes, and stock policies cannot merge — the snapshot
wrapper and a merge-capable policy are both required.

### 5. Explicit snapshots have a lifecycle — always dispose

```kotlin
// ❌ never disposed — its pinned state versions leak
val frame = Snapshot.takeSnapshot()
frame.enter { render(scene) }

// ✅ bounded lifespan
val frame = Snapshot.takeSnapshot()
try { frame.enter { render(scene) } } finally { frame.dispose() }
```

Why: a snapshot keeps its records valid (and un-reusable) until
disposed; for mutable snapshots, dispose-without-apply discards pending
writes and apply-after-dispose throws — end every one with
`apply`/`dispose`, or use `Snapshot.withMutableSnapshot`.

### 6. Background reads of several objects: enter a read-only snapshot

```kotlin
// ❌ each read may hit a different version while the UI keeps writing
fun exportProfile() = save(profile.name.value, profile.avatarUrl.value)

// ✅ one point-in-time consistent view for the whole read
fun exportProfile() {
    val snap = Snapshot.takeSnapshot()
    try { snap.enter { save(profile.name.value, profile.avatarUrl.value) } }
    finally { snap.dispose() }
}
```

Why: `enter` makes the snapshot the source of truth for every state read
in the block, so all values come from the same version id; unscoped
global reads track the advancing global state mid-sequence.
