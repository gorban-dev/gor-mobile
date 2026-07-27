# Stability

Read this before declaring any class, collection, or lambda that becomes a
`@Composable` parameter. Canonical form: `examples/StableModels.kt`.

## Why stability matters

- A composable call is skipped during recomposition only when every argument
  has a stable type and compares equal to the value stored in the slot table.
  One unstable parameter and the function re-executes whenever its parent
  does — and its whole subtree pays.
- Newer Compose compilers default to strong skipping: unstable arguments are
  compared by identity, stable ones by equality, so an unchanged unstable
  instance may still skip. Treat that as a backstop, not a license — stable
  parameters keep skipping equality-based, so every rule here still applies.
- Stable is three promises: `equals` is deterministic (one pair of
  instances, one verdict, forever); composition is notified whenever a
  public property changes; every public property is itself stable.
- The compiler infers stability per class (synthesizing `@StabilityInferred`
  and a `$stable` field): a class is inferred stable when all its fields are
  read-only and of stable types, resolved recursively through member types;
  generic type parameters push part of the check to runtime.
- Stable out of the box: primitives, `String`, function types,
  `MutableState` (its writes notify composition).
- Assumed unstable — anything the compiler cannot prove: interface-typed
  parameters (`List`/`Set`/`Map` included), classes with `var` properties,
  classes with internal mutable state.
- `@Stable` / `@Immutable` are promises the compiler never validates.

## Rules

### 1. Model composable inputs as all-`val` data classes of stable types

One `var` anywhere in the chain makes the whole class unstable.

```kotlin
// ❌ unstable: mutable field
data class TimerState(var remainingSec: Int, val label: String)

// ✅ stable: read-only fields, mutate by copy()
data class TimerState(val remainingSec: Int, val label: String)
```

Why: inference demands every field read-only and stable; a `var` breaks the
notify-on-change promise, so skipping is disabled for every composable that
takes this type.

### 2. Never take stdlib collections as composable parameters

`List`, `Set`, `Map` are interfaces; a mutable implementation can hide
behind them, so the compiler assumes unstable. Use
kotlinx.collections.immutable types, or wrap in an `@Immutable` holder.

```kotlin
// ❌ List defeats skipping even when contents never change
@Composable fun IngredientPanel(items: List<Ingredient>) { /* … */ }

// ✅ provably immutable collection type
@Composable fun IngredientPanel(items: ImmutableList<Ingredient>) { /* … */ }

// ✅ alternative: a wrapper whose stability you vouch for
@Immutable data class IngredientList(val items: List<Ingredient>)
```

Why: the compiler treats a type as stable only when it can prove it, and an
interface admits mutable implementations such as `ArrayList`.

### 3. `@Immutable` only when nothing public ever changes after construction

A stronger claim than `val`: a `val` can still point at mutable data.

```kotlin
// ❌ lie: the val points at a list the repository mutates later
@Immutable class Menu(val dishes: MutableList<Dish>)

// ✅ deep immutability: primitives and immutable members only
@Immutable data class Dish(val name: String, val priceCents: Int)
```

Why: the runtime trusts the annotation to skip comparisons and
recompositions; a post-construction mutation leaves skipped composables
showing stale data.

### 4. `@Stable` for types that are mutable inside but stable from outside

Annotate in exactly two cases: (a) an interface or abstract class used as a
composable parameter — the annotation imposes the contract on implementors;
(b) a class whose mutability is invisible to callers (internal cache, or
delegation to `MutableState`, whose writes notify composition).

```kotlin
// ✅ interface param would otherwise be assumed unstable
@Stable
interface SessionUiState {
    val user: String?
    val error: Throwable?
}
```

Do not annotate plain all-`val` data classes: inference already covers them,
is guaranteed correct, and cannot go stale the way a hand-written promise can.

Why: the annotation substitutes for a proof the compiler cannot derive; it
carries the three `@StableMarker` promises and is never validated.

### 5. No custom getters that recompute on stable model types

```kotlin
// ❌ each read may return a different value — unstable to read from
data class Download(val bytesTotal: Long) {
    val progress: Int get() = ProgressTracker.current(this)
}

// ✅ plain stored value; publish changes by emitting a new instance
data class Download(val bytesTotal: Long, val progress: Int)
```

Why: a getter deriving from external state can return a different result on
every call, breaking the consistent-comparison promise skipping relies on.

### 6. Lambdas passed to composables must capture only stable values

The compiler memoizes a capturing lambda by wrapping it in
`remember(captures)` — but only when every captured value is stable. An
unstable capture means a fresh lambda instance per recomposition, and the
receiving composable never skips.

```kotlin
// ❌ captures an unstable controller: memoization off, child recomposes
val onRetry = { feedController.reload() }

// ✅ capture stable values, or remember the lambda on explicit stable keys
val onRetry = remember(feedId) { { reload(feedId) } }
```

Why: captured values become the `remember` comparison keys; unstable keys
cannot be compared reliably, so the lambda is rebuilt and arrives as a
changed argument.
