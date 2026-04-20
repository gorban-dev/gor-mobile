<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADDS to it when the target
is an Android/Kotlin codebase.

### Architecture rules pointer
Before producing the spec, load `core` + `architecture` sections from
`$HOME/.gor-mobile/rules/` via `manifest.json`. Reference the canonical
layer examples (`examples/index.json` → `.layers`) when the spec needs to
mention concrete structural constraints (ViewModel base class, Repository
boundaries, DI scope, etc.).

Brainstorming stays on main Claude — the analysis/judgment work is the
whole point of this skill. No local-LLM offload here.

Spec output path: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.

<!-- END gor-mobile overlay -->
