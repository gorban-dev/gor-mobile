# Modifiers & phases

Rules for building modifier chains and putting work in the right frame
phase. Canonical shape: `examples/ModifiersLayoutSemantics.kt` — copy
that form when writing modifier-heavy UI.

## Mechanics (why these rules exist)

- `then` links modifiers into a chain; extension modifiers (`padding`,
  `background`, ...) call `then` internally. Source order IS chain order.
- When a `Layout` is emitted, the chain is materialized and assigned to
  exactly one `LayoutNode`.
- Modifiers are stateless, so the node wraps each one in a wrapper that
  holds its measured size. Wrappers link outer → modifier 1 → ... →
  modifier N → inner; measuring walks that chain, and each wrapper
  measures within what the previous ones left available.
- Drawing walks the same chain: the node, then its modifiers in order,
  then its children.
- Frame pipeline: composition (composable bodies and composed-modifier
  factories create/update nodes) → layout (measure + place through the
  wrapper chain) → draw (layers and draw modifiers paint). Later phases
  can re-run without re-running earlier ones.
- State reads are tracked per phase: a read in a measure lambda re-runs
  only that lambda; a read while drawing invalidates only that node's
  drawing layer; a read in composition re-runs the recompose scope.
- Setting a new chain makes the node rebuild its wrapper chain, reusing
  cached wrappers whose modifier matches and re-creating the rest.

## Rules

### 1. Order the chain deliberately — order is behavior

Each modifier applies to what the chain before it left over. Moving one
changes sizing, coloring, and hit areas.

```kotlin
// ❌ padding first — inset area only is filled and tappable
Modifier.padding(12.dp).background(Teal).clickable(onClick = onOpen)

// ✅ fill and click the full bounds; padding insets the content
Modifier.background(Teal).clickable(onClick = onOpen).padding(12.dp)
```

Why: wrappers are resolved outer-to-inner in declaration order, and a
modifier's measured size constrains every modifier chained after it.

### 2. One `modifier` parameter, applied to the root element

Accept a single `modifier: Modifier = Modifier` and pass it to the
outermost layout the composable emits. Do not split it, ignore it, or
attach it to an inner child.

```kotlin
// ❌ caller's chain lands on an inner node
@Composable
fun StatChip(label: String, modifier: Modifier = Modifier) {
  Row { ChipIcon(); Text(label, modifier) }
}

// ✅ caller's chain decorates the node the caller sees
@Composable
fun StatChip(label: String, modifier: Modifier = Modifier) {
  Row(modifier) { ChipIcon(); Text(label) }
}
```

Why: the materialized chain is set on one `LayoutNode` — the parent can
size/position your composable only if the chain reaches its root node.

### 3. Read fast-changing state in lambda modifiers, not composition

For per-frame values (animations, scroll offsets), use the lambda
overloads — `graphicsLayer { }`, `offset { }`, `drawBehind { }` — so the
read happens in the layout/draw phase.

```kotlin
// ❌ read in composition — the whole scope recomposes every frame
val pulse by animateScale()
Badge(Modifier.graphicsLayer(scaleX = pulse, scaleY = pulse))

// ✅ read inside the draw-phase lambda — only the layer updates
Badge(Modifier.graphicsLayer { scaleX = pulse; scaleY = pulse })
```

Why: a read in a measure/placement lambda re-executes just that lambda,
and a read during drawing invalidates just that drawing layer — the
recompose scope never runs.

### 4. Plain factory extensions for stateless modifiers; composition only when required

Write shared chains as normal `Modifier.foo()` extensions. Reach for a
stateful modifier (one that needs `remember` or a composition local)
only when the logic truly needs a composition.

```kotlin
// ❌ stateless chain forced through a per-element composition
fun Modifier.cardFrame() =
  composed { background(Slate).padding(8.dp) }

// ✅ plain chain — materialized as-is, no composition cost
fun Modifier.cardFrame() = background(Slate).padding(8.dp)
```

Why: standard modifiers pass through materialization unchanged, while a
composed modifier runs its factory in a composition once per element it
modifies.

### 5. Keep chains stable across recompositions

Hoist constant chains to a `val` (or a pure factory) instead of
assembling ad-hoc variants inline on every pass.

```kotlin
// ❌ fresh, structurally different chain on each recomposition
Row((if (selected) Modifier.border(2.dp, Teal) else Modifier)
  .padding(8.dp).clickable(onClick = onPick))

// ✅ stable base; only the varying element changes
val chipBase = Modifier.padding(8.dp)
Row(chipBase
  .then(if (selected) SelectedBorder else Modifier)
  .clickable(onClick = onPick))
```

Why: on a new chain the node reuses cached wrappers only for matching
modifiers; unmatched ones force wrapper rebuild, re-attach, redraw, and
possibly a parent remeasure.
