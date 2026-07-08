<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADDS to it when the target
is an Android/Kotlin codebase.

### Architecture rules pointer
Before producing the spec, load `core` + `architecture` sections from
`$HOME/.gor-mobile/rules/` via `manifest.json`. The canonical layer examples
are governed by the **Examples-first gate** below — a MANDATORY read of the
example `.kt` files themselves, not a conditional glance at their index.

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

### Examples-first gate (spec phase) — MANDATORY before comparing approaches

The docs-first gate above grounds every *external* API in real documentation.
This gate is its internal twin: **docs-first owns external API signatures;
examples-first owns internal placement and shape.** Before you compare
approaches, resolve which layers the feature touches via
`$HOME/.gor-mobile/rules/examples/index.json` → `.layers` and **Read the
example `.kt` files themselves** — the index only lists names; only the files
show the canonical shape (e.g. that a datasource is a one-line
`httpClient.get(...).body()`, which vetoes designing a retry protocol into
it). The spec must record, per touched layer, which example file(s) the
design conforms to, using the literal artifact line
`Conforms to: <path verbatim from index.json → .layers.<layer>.files>` —
`Conforms to: examples/<layer>/<ExampleFile>.kt` in the default pack.

**Precedence rule.** An external requirement (backend contract, ticket,
vendor doc) defines *behavior* — what the system does. The rules-pack
conventions define *placement and shape* — where and in what form it is
written. A retry protocol from the backend gets implemented — but in the
layer where the conventions put error handling (e.g. the UseCase) — while
the datasource keeps its canonical shape. If a requirement genuinely cannot
be satisfied within the layer's canonical shape — STOP and ask the user;
never silently redesign the layer.

**Absence ladder.** Examples are an optional pack feature (packs are
user-replaceable via `gor-mobile rules use <url>`); layer membership comes
from the current pack's `index.json`, never from a remembered default list.
When the index is missing/empty or no declared layer matches:

1. **Project precedent** — find 1–3 existing analogous files in the target
   repo (`ast-index search` / `ast-index conventions`, see
   `[[gor-mobile-ast-index]]`) and use them as the reference shape; note
   them in the spec as `Conforms to (project precedent): <repo paths>`.
2. **No precedent either** (greenfield, first file of its kind) — ask the
   user what shape to follow before settling the design; record the answer
   as `Shape per user: <one-line summary>`.

Never fabricate: citing an example file that does not exist in the current
pack, or describing a "canonical shape" from memory of the default pack, is
the same defect class as coding a remembered API signature.

> **Red Flag — STOP.** Designing a datasource / ViewModel / repository around
> a protocol, ticket, or backend instruction without having read that layer's
> `Example*.kt` (or its absence-ladder substitute). The layer example vetoes
> remembered or externally-anchored shapes.

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
