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

## Phase → capability
- **Research:** `android docs search` / `docs fetch` for authoritative docs.
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
- **Debug:** `android layout` after each action; `android studio analyze-file`
  and `android studio render-compose-preview` for IDE-level inspection (need a
  running Studio instance).

## Optional skill catalog
Google publishes domain-specific skills. Browse and install them at runtime —
do NOT hardcode the list:

    gor-mobile android-skills

Pick per project (it lists what's actually available via `android skills list`).

## When `android` is missing or a command fails
1. Do not silently fall back to `adb`/`./gradlew` for device ops — that breaks
   the workflow contract. (gradle for *building* is fine — see Execute.)
2. Tell the user: «`android` CLI отсутствует или команда недоступна — выполни
   `gor-mobile repair` / `gor-mobile init`».
3. If a contract command is genuinely absent on a current version, this is a
   gor-mobile contract bug — surface it; don't paper over it.