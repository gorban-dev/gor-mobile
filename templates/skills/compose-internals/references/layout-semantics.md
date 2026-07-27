# Layout & semantics

Rules for measuring, custom layouts, and the semantics tree. Canonical
shape: `examples/ModifiersLayoutSemantics.kt` — copy that form when
writing a custom `Layout` or a semantics block.

## Mechanics (why these rules exist)

- Constraints (min/max width and height, in px) flow parent → child;
  each child picks a size inside them; sizes flow child → parent, and
  the parent places children using those measured sizes.
- A parent measures children through its `MeasurePolicy` — the trailing
  lambda of `Layout`. It turns each child measurable into a `Placeable`,
  then calls `layout(w, h) { ...place... }`. The `LayoutNode` itself is
  policy-agnostic: every `Layout` supplies its own.
- Measure is single-pass: a child is measured exactly once per pass, and
  a second `measure` call on it throws. Intrinsics are the sanctioned
  estimate when a size is needed before real measurement.
- If measuring changes a node's size, the parent gets a remeasure
  request. State read inside a measure lambda re-runs that lambda when
  the state changes.
- A parallel semantics tree describes the UI to accessibility services
  and the test framework. foundation/material components populate it
  implicitly; a custom `Layout` contributes nothing until you add
  `Modifier.semantics`. `mergeDescendants` collapses a subtree into one
  node in the merged tree; the unmerged tree keeps the parts separate.

## Rules

### 1. Measure each child exactly once per pass

```kotlin
// ❌ probe-measure, then measure again with the "right" constraints
val probe = measurable.measure(constraints)
val real  = measurable.measure(Constraints.fixedWidth(probe.width)) // throws

// ✅ measure once; the returned Placeable carries size and placement
val track = measurable.measure(constraints)
layout(track.width, track.height) { track.place(0, 0) }
```

Why: Compose enforces single-pass measure for performance — a repeat
`measure` throws; when a size is needed early, use intrinsics (rule 5)
or `SubcomposeLayout`, never a second measure.

### 2. Report a size inside the incoming constraints

```kotlin
// ❌ reports whatever the content wants, ignoring the imposed range
layout(coverArtWidth, coverArtHeight) { ... }

// ✅ chosen size coerced into min..max before reporting it upward
layout(
  coverArtWidth.coerceIn(constraints.minWidth, constraints.maxWidth),
  coverArtHeight.coerceIn(constraints.minHeight, constraints.maxHeight)
) { ... }
```

Why: constraints are a contract — the measured layout must satisfy
`minWidth <= chosen <= maxWidth` (same for height); the parent places
you assuming it holds.

### 3. Custom arrangement = `Layout` + MeasurePolicy, not nested-Box offset hacks

```kotlin
// ❌ overlap faked with guessed dp offsets — breaks when sizes change
Box { Avatar(first); Box(Modifier.offset(x = 26.dp)) { Avatar(second) } }

// ✅ policy measures children and places them from their real sizes
Layout({ speakers.forEach { Avatar(it) } }) { measurables, constraints ->
  val items = measurables.map { it.measure(constraints.copy(minWidth = 0)) }
  val step = items.first().width * 2 / 3
  layout(step * (items.size - 1) + items.last().width, items.first().height) {
    items.forEachIndexed { i, item -> item.place(i * step, 0) }
  }
}
```

Why: the trailing lambda of `Layout` is the node's measure policy — it
sees every child's measured size, so the arrangement adapts instead of
depending on constants that drift out of sync.

### 4. Don't fill the unbounded axis of a scrollable parent

```kotlin
// ❌ inside LazyColumn the height constraint is Infinity — this wraps
LazyColumn { item { NowPlayingBanner(Modifier.fillMaxHeight()) } }

// ✅ explicit size on the scroll axis
LazyColumn { item { NowPlayingBanner(Modifier.height(240.dp)) } }
```

Why: scrollable containers measure children with `Constraints.Infinity`
on the scroll axis; filling infinity is meaningless, so fill modifiers
silently degrade to wrap-content there.

### 5. Size against unmeasured siblings with intrinsics — sparingly

```kotlin
// ❌ hardcoded width to make the menu fit its widest row
Column(Modifier.width(220.dp)) { actions.forEach { ActionRow(it) } }

// ✅ preferred width = max intrinsic width of the children
Column(Modifier.width(IntrinsicSize.Max)) { actions.forEach { ActionRow(it) } }
```

Why: intrinsics are the legal pre-measure estimate (each dimension is
computed from the opposite one, since there are no constraints yet), but
they add an extra calculation pass and ancestors depending on them
re-layout whenever the node's measure policy changes — reserve them for
sibling-dependent sizing.

### 6. Every custom layout and drawn control declares its semantics

```kotlin
// ❌ drawn icon button — invisible to TalkBack and to UI tests
Canvas(Modifier.size(40.dp).clickable(onClick = onMute)) { drawMuteGlyph() }

// ✅ description for accessibility, tag for the test framework
Canvas(
  Modifier.size(40.dp).clickable(onClick = onMute)
    .semantics { contentDescription = "Mute" }
    .testTag("player_mute")
) { drawMuteGlyph() }
```

Why: foundation/material composables hook their semantics implicitly; a
bare `Layout`/`Canvas` adds no node to the semantics tree, so neither
accessibility services nor the test framework can find it.

### 7. Merge composite rows with `mergeDescendants` so they read as one

```kotlin
// ❌ TalkBack stops on title, artist, and duration separately, per row
Row { Text(title); Text(artist); Text(duration) }

// ✅ each row is announced as a single unit in the merged tree
Row(Modifier.semantics(mergeDescendants = true) {}) {
  Text(title); Text(artist); Text(duration)
}
```

Why: the merged tree folds descendants into the node that sets
`mergeDescendants`, each property combining values by its own merge
policy (e.g. `contentDescription` concatenates into a list); the
unmerged tree keeps the parts for tools that need them.
