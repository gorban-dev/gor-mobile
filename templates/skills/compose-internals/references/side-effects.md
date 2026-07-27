# Side effects and effect handlers

Canonical example forms: `examples/EffectHandlers.kt`.

## Why the body must stay effect-free

The runtime re-executes (recomposes) a composable body any number of times,
skips it when inputs are unchanged, and may run bodies on different threads,
in parallel, or in any order. Code placed directly in the body therefore runs
once per recomposition — uncoordinated, never cancelled, never disposed.
Effect handlers attach work to the composable lifecycle instead: run at the
right step, dispose/cancel on leave, relaunch on key change.

## Rule: never run a side effect in the composable body

The body must be idempotent: same inputs → same emitted tree, nothing else.

❌
```kotlin
@Composable
fun Inbox(repo: MailRepo) {
  val mail = repo.fetchInbox() // fires on EVERY recomposition, from any thread
  MailList(mail)
}
```
✅
```kotlin
@Composable
fun Inbox(repo: MailRepo) {
  var mail by remember { mutableStateOf<List<Mail>>(emptyList()) }
  LaunchedEffect(Unit) { mail = repo.fetchInbox() }
  MailList(mail)
}
```
Why: an uncontrolled effect breaks idempotence — the runtime can no longer
skip or restart the body safely, and concurrent re-executions fire it N times.

Corollary: never make one sibling depend on a side effect of another (write a
shared variable in `Header`, read it in `Footer`) — siblings may execute in
any order, or in parallel.

## Handler selection table

| Job | Handler |
|-----|---------|
| Subscribe to an external source; must unsubscribe | `DisposableEffect(keys)` |
| Publish composed state to a non-Compose object | `SideEffect` |
| Suspend work started by the composition (load, collect) | `LaunchedEffect(keys)` |
| Launch a coroutine from a callback (click, gesture) | `rememberCoroutineScope()` |
| External async source exposed as `State<T>` | `produceState(initial, keys)` |
| Snapshot state reads exposed as a cold `Flow` | `snapshotFlow { }` |
| `Flow` / `LiveData` / RxJava stream → `State` | `collectAsState` / `observeAsState` / `subscribeAsState` |

## Per-handler rules

**DisposableEffect** — non-suspend effects that need cleanup. Runs on enter
and again on every key change (previous effect disposed first); `onDispose`
is mandatory and also runs when the composable leaves the composition.
```kotlin
DisposableEffect(bus) {
  val sub = bus.subscribe(::onEvent)
  onDispose { sub.cancel() } // skip this → the callback leaks past the composable
}
```
Why: a captured reference without a dispose step outlives the composition.

**SideEffect** — fire-and-forget publication that runs after every successful
composition; discarded if the composition fails; not stored in the slot
table, never retried.
```kotlin
SideEffect { legacyMap.zoomEnabled = uiState.editing }
```
Why: assigning `legacyMap.zoomEnabled` in the body would publish values from
compositions that may still be thrown away.

**LaunchedEffect** — suspend work owned by the composition. Runs on enter,
cancelled on leave, cancelled and relaunched when a key changes. Requires at
least one key.
```kotlin
LaunchedEffect(articleId) { article = repo.loadArticle(articleId) }
```
Why: lifecycle-driven cancellation is what stops a request whose composable
is already gone — the bare body offers no cancellation point at all.

**rememberCoroutineScope** — for jobs started by user interaction, not by the
composition. The same scope instance is returned across recompositions; every
job still running is cancelled when the composable leaves.
```kotlin
val scope = rememberCoroutineScope()
Button(onClick = { scope.launch { repo.syncNow() } }) { Text("Sync") }
```
Why: `LaunchedEffect` scopes jobs initiated by the composition; interaction-
initiated work needs a scope callable from plain (non-composable) callbacks.

**produceState** — sugar over `LaunchedEffect` for the common "async source
feeds a `State`" case.
```kotlin
val quote by produceState(initialValue = 0.0, ticker) {
  value = feed.awaitQuote(ticker)
}
```
Gotcha: keys are optional here; with none it runs keyed on `Unit` and spans
all recompositions — passing no key must be a deliberate choice.

**snapshotFlow** — the bridge from snapshot state into the coroutine world: a
cold `Flow` that re-runs its block and emits whenever any `State` read inside
the block changes.
```kotlin
LaunchedEffect(listState) {
  snapshotFlow { listState.firstVisibleItemIndex }
    .collect { analytics.scrolledTo(it) }
}
```
Why: it records the block's state reads through a snapshot read observer, so
only `State` objects actually read inside the block trigger emissions.

**Stream adapters** — `collectAsState` (Flow), `observeAsState` (LiveData),
`subscribeAsState` (RxJava) delegate to the handlers above (`DisposableEffect`
/ `produceState`): each maps emissions into a `State`. Prefer them over
hand-rolled observers; follow the same pattern for other libraries.

**currentRecomposeScope.invalidate()** — forces recomposition when the source
of truth is not Compose `State`. Last resort: model the data as `State`
instead, otherwise skipping and smart recomposition stop working.

## Effect keys

Keys declare the inputs the effect depends on. A wrong key set gives the
effect a wrong lifecycle:

❌ `LaunchedEffect(Unit) { chat = repo.openRoom(roomId) }` — `roomId` missing
from the keys: navigating to another room never relaunches the effect, which
keeps serving the stale captured id.
✅ `LaunchedEffect(roomId) { chat = repo.openRoom(roomId) }` — cancelled and
relaunched per room.

- Constant key (`Unit`, `true`): run once on enter, dispose/cancel on leave
  only.
- Every value the effect body uses that can vary over time must be a key —
  the handler contract is "dispose/cancel and relaunch when an input varies".
- Do not key on values recreated every composition (fresh lambdas/objects):
  the effect then restarts on each recomposition, reproducing exactly the
  uncontrolled body-effect behavior. (Derived from key-change mechanics.)
