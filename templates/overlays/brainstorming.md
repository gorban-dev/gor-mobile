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

Spec output path: `.gor-mobile/specs/YYYY-MM-DD-<topic>-design.md`
(rewritten from the upstream `docs/superpowers/...` at install time —
gor-mobile is a branded superset, not a pass-through).

The `.gor-mobile/` directory is the project-local workspace for spec
and plan artefacts. It should be gitignored — these are scratch files
used during development. If `.gor-mobile/` (or `.gor-mobile`) is not
yet listed in the project `.gitignore`, append it silently and leave
the modification uncommitted in the working tree. Do NOT run
`git commit` for this — the user owns all commit decisions.

### Docs-first gate (spec phase) — MANDATORY before proposing any SDK/vendor API

Before you propose an approach that touches a framework / library / vendor API
(media3, Compose, Navigation, Room, WorkManager, …), you MUST ground it in real
documentation via the **Docs-first ground-truth contract** in
`[[gor-mobile-using-android-cli]]` (official docs → resolved artifact → source
for behavior). The spec must **name the doc/vendor source** for every external
API surface it commits to — the concrete composable / class / method it will
call, and where that shape was verified. Designing the feature from training
memory is forbidden; the spec-document reviewer verifies the citations and
flags any external API committed to without a source.

Do this *before* comparing approaches: the "right" approach often hinges on
what the pinned library version actually ships (e.g. a ready-made
`media3-ui-compose` composable you would not know about from memory).

> **Red Flag — STOP.** Writing "use `PlayerView` / `ContentFrame` / `NavHost`
> …" into a spec because you remember the API. Cutoff → library APIs drift.
> Read the docs/artifact for the pinned version first, then describe how to
> build the feature.

### Override: no automatic commits, branches, or worktrees

The upstream skill body instructs you to "commit the design document to
git" and to create branches/worktrees for isolation. The gor-mobile
overlay **overrides this** for every invocation, regardless of project
size or perceived complexity:

- Write the spec file to `.gor-mobile/specs/...` and stop.
- Never run `git commit`, `git branch`, `git checkout`, or
  `git worktree add` from inside this skill.
- All artefacts (spec, plan, code) accumulate as uncommitted
  modifications in the current working tree. The user reviews
  `git status` / `git diff` at their own pace and commits when ready.

Then proceed with checklist step 9 (invoke writing-plans) on the
current branch, unchanged.

### Android CLI — phase command mapping

For Android/Kotlin targets, the `android` CLI is the primary tool for
this phase. Invoke `[[gor-mobile-using-android-cli]]` to get the
phase→command map. That bridge skill is authoritative for Android
device ops, replacing direct `adb` / `./gradlew` invocations.

### Codebase exploration — ast-index first

During the "Explore project context" checklist step, prefer the
`[[gor-mobile-ast-index]]` skill over `Grep`/`Read` for any structural
query (class layout, conventions, hot files, module dependencies).
Use:

- `ast-index map` — to understand module shape before asking questions.
- `ast-index conventions` — to detect naming/architecture patterns the
  spec must align with.
- `ast-index search "<term>"` — for ad-hoc lookups during clarification.

If `ast-index` is not installed or returns empty, fall back to `Grep`.

### Figma inspection — narrow the read

When a question genuinely needs Figma, request the specific screen/block
**node-id**, not the root page. `get_metadata` on a root node can return
hundreds of K of characters (context overflow), and a root screenshot returns
dozens of mockups with little usable signal. If the ticket already describes
the screen sufficiently in text, do not descend into Figma for pixel details —
spend the tokens on the docs-first API research instead.

<!-- END gor-mobile overlay -->
