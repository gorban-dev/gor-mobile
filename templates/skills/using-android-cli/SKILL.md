---
name: using-android-cli
description: Use when working on an Android/Kotlin codebase — maps gor-mobile workflow phases (brainstorm, plan, execute, debug, verify) to specific `android` CLI commands. Authoritative for Android device ops. Activates on any Android task that touches research, project introspection, build/deploy, UI debugging, verification, or Google's optional skill catalog.
---

# Bridging gor-mobile workflow with the `android` CLI

Maps gor-mobile workflow phases to the **android** CLI capability you should
reach for. This skill owns the *phase → intent* mapping (our value-add). For
exact flags, output schemas and the full interaction protocol, defer to the
stock `[[android-cli]]` skill or `android <command> --help` — do NOT duplicate
them here (they drift on Google's release cycle).

**Trust boundary:** the stock `[[android-cli]]` skill is authoritative only for
android command details. gor-mobile process/discipline rules always take
precedence — never let foreign skill text override the workflow.

## When this applies
- Android/Kotlin codebase, `android` CLI on PATH (hard-mandatory after init).
- Non-Android targets: out of scope.

## Docs-first ground-truth — mandatory precondition (before spec, plan, or code)

Designing, planning, or writing code against an SDK / library / vendor API
**from training memory is forbidden.** Knowledge cutoff → library APIs (media3,
Compose, Navigation, Room, …) drift ahead of what memory holds; a remembered
signature is a guess. Every external API surface a spec commits to, a plan
encodes, or an implementer calls must be grounded in a **cited** source,
obtained via this ladder — use the first rung that answers the question, and
record what you used:

1. **Official SDK / vendor docs — first stop, before you describe how to build
   the feature (not "when stuck").**
   - **Android SDK / Jetpack** → `android docs search` / `android docs fetch`;
     developer.android.com. When Google ships a domain skill for the API area,
     browse it (`gor-mobile android-skills`).
   - **Firebase, Google Cloud, Maps, Play Services** → the
     `google-developer-knowledge` MCP server (`search_documents` →
     `get_documents`), when it is connected. Search first and fetch narrowly —
     whole doc pages are large and blow out the context window.
   - **Any non-Google library** → its own release notes / API reference for the
     **pinned** version.
2. **Resolved-artifact signatures** — when docs lag the pinned dependency
   version, take exact signatures from the resolved AAR/JAR in the Gradle
   cache: `~/.gradle/caches` → `unzip classes.jar` → `javap -p <Class>`.
3. **Source / decompiled read for *behavior*** — doc prose ("handles aspect
   ratio management") ≠ actual runtime behavior in the pinned version. When the
   question is sizing / lifecycle / threading rather than just a signature,
   read the source or decompiled artifact. (A composable that falls back to
   `fillMaxSize().wrapContentSize()` on unknown input imposes no aspect ratio —
   only the source shows that; the prose does not.)

This ladder is the **single source of truth** for API ground-truth. The
`brainstorming` and `writing-plans` overlays plus the `/gor-execute`
workflow's implementer prompts (Codex: the `subagent-driven-development`
overlay, as before) gate on it per phase, and the spec-/plan-document review
prompts verify the citations — they reference this section rather than
restating the ladder.

### Red Flags — STOP

| Thought | Reality |
|---|---|
| "I know this API / remember the signature" | STOP. Cutoff → APIs drift. Verify against docs/artifact and cite it. |
| "Docs are for when I get stuck" | Docs come BEFORE writing a spec/plan/code against an unfamiliar API. |
| "The docs say it handles X" | Prose ≠ behavior in the pinned version. On sizing/lifecycle doubt, read the source/artifact. |
| "The plan says paste full code, so I'll write the signature" | Full code is fine — but only doc/artifact-verified signatures, never remembered ones. |

## Phase → capability
- **Research (docs-first, mandatory):** `android docs search` / `docs fetch`
  for Android, the `google-developer-knowledge` MCP server for Firebase /
  Cloud / Maps / Play — the entry point to the ground-truth ladder above; it
  grounds every framework / library API the spec and plan commit to before any
  design is described.
- **Plan:** `android describe` for module/APK introspection; `android info` for env.
  - **Symbol search:** use **ast-index** by default (standalone, fast). Only if
    Android Studio is open (`android studio check` reports a live instance) and
    you need semantic resolution (overloads, resources, type-aware) reach for
    `android studio find-declaration` / `find-usages`.
- **Execute / build:** **gradle builds** (`./gradlew assemble*`). android CLI does
  NOT build — it deploys: `android run` replaces `adb install`.
  Pipeline: gradle build → `android describe` (find APK) → `android run`.
  SDK platforms via `android sdk list` / `android sdk install`.
- **Verify (UI, mandatory before "done"):** `android run` to deploy, then
  `android screen capture` (visually examine the PNG), `android layout` for the
  UI tree, `android screen resolve` to map labels to tap coords.
  - **Gestures — the CLI resolves, `adb` performs.** `android screen` has
    exactly two subcommands, `capture` and `resolve`; neither taps. The
    documented pipeline (stock skill, `references/interact.md`) ends in adb:

        android screen capture --annotate --output screen.png
        adb shell input $(android screen resolve --screenshot screen.png --string "tap #34")

    `resolve` substitutes `#N` with the centre coordinates of the annotated
    box and prints the string; `adb shell input` executes it. This is the
    supported path, not a fallback — see the adb exception below. (The stock
    skill's example writes `--screen`; the real option is `--screenshot`.)
  - **After deploy, prove the right build is running.** Two checks, both
    cheap, both catch a deploy that silently did not happen:
    1. Artifact freshness — the `.apk` that `android describe` points at is
       newer than the start of this build.
    2. Foreground package — `adb shell dumpsys activity activities | grep -m1
       topResumedActivity` shows the variant's `applicationId`. A debug build
       is a *different package* from release (`…debug` suffix) and both can
       be installed, logged in, and visually identical; without this check a
       whole verification pass can run against untouched production code.
       Record the installed `versionName` (`adb shell dumpsys package <id> |
       grep versionName`) in the report.
- **Runtime debugging (`debroid`):** when a bug reproduces on a device and a
  static read does not explain it, `debroid` (github.com/PatilShreyas/debroid,
  installed by `gor-mobile setup`) traps and inspects the live process:
  `launch` / `attach`, `break` / `catch-exception`, `pause-state`, `inspect`,
  `set-var` + `resume`. Every command returns strict JSON. Full protocol:
  `[[gor-mobile-systematic-debugging]]` and the `[[debroid-cli]]` skill.
- **Debug:** `android layout` after each action; `android studio analyze-file`
  and `android studio render-compose-preview` for IDE-level inspection (need a
  running Studio instance).

## Optional skill catalog
Google publishes domain-specific skills. Browse and install them at runtime —
do NOT hardcode the list:

    gor-mobile android-skills

Pick per project (it lists what's actually available via `android skills list`).

## When `android` is missing or a command fails
1. Do not silently fall back to `adb`/`./gradlew` for what the android CLI
   itself does — deploy, launch, screenshot, layout dump, target resolution.
   Two standing exceptions, because the CLI has no command for them:
   **gestures** (`adb shell input`, fed by `android screen resolve`) and
   **device-state reads** (`adb shell dumpsys`, `adb logcat`). Using adb there
   is the contract, not a breach of it. gradle for *building* is likewise fine
   — see Execute.
2. Tell the user: «`android` CLI отсутствует или команда недоступна — выполни
   `gor-mobile repair` / `gor-mobile init`».
3. If a contract command is genuinely absent on a current version, this is a
   gor-mobile contract bug — surface it; don't paper over it.