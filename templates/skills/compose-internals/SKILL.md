---
name: compose-internals
description: Use when writing, modifying, or reviewing Jetpack Compose UI code — @Composable functions, recomposition and skipping, Compose state (remember / MutableState), side effects in Compose (LaunchedEffect, DisposableEffect, rememberCoroutineScope, SideEffect, produceState, snapshotFlow), stability (@Stable / @Immutable), state hoisting / UDF, modifiers, declarative Compose style. Distilled from "Jetpack Compose Internals" — the rules digest is mandatory reading before any @Composable is written.
---

# Jetpack Compose Internals — rules digest

Mandatory ground rules for any code that creates or modifies a `@Composable`.
Read this digest fully; open the reference file for the topic your task
touches; check your shape against `examples/*.kt`.

<!-- STAGE 2 (book distillation): every rules section below is filled from
     the book "Jetpack Compose Internals" ONLY — own wording, own Kotlin
     code. Format per rule: rule → minimal Kotlin ❌/✅ → one line "why"
     (which composable property is violated). Digest total ≤ 250 lines.
     If the book does not cover something, it does not go here. -->

## The 9 properties of composable functions

<!-- STAGE 2: calling context; idempotent; free of uncontrolled side
     effects; any order; parallel; restartable/reactive; fast execution;
     skippable; positional memoization. -->

## State rules

<!-- STAGE 2: stability (@Stable / @Immutable; List/Set/Map parameters →
     kotlinx.collections.immutable); state hoisting / UDF (state down,
     events up; never pass ViewModel / MutableState down the tree);
     remember semantics. -->

## Anti-patterns

<!-- STAGE 2: at least 5 items, each ❌/✅ + one-line why: side effect in
     the body instead of an effect handler; state without remember;
     dynamic list without key(...); writing shared/global state from
     composition; heavy computation in the body. -->

## References (load on demand)

| Topic | File |
|---|---|
| Recomposition / skipping | references/recomposition.md |
| Side effects | references/side-effects.md |
| Stability | references/stability.md |
| State hoisting / UDF | references/state-hoisting.md |
| Modifiers & phases | references/modifiers-phases.md |

Canonical Kotlin examples live in `examples/*.kt` (arrive with stage 2).
