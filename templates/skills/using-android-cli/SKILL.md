---
name: using-android-cli
description: Use when working on an Android/Kotlin codebase — maps gor-mobile workflow phases (brainstorm, plan, execute, debug, verify) to specific `android` CLI commands. Authoritative for Android device ops. Activates on any Android task that touches research, project introspection, build/deploy, UI debugging, verification, or Google's optional skill catalog.
---

# Bridging gor-mobile workflow with the `android` CLI

This skill maps gor-mobile workflow phases to the Google `android` CLI
commands you should use at each phase. It is the source of truth for
Android device ops on this machine. For command reference details
(flags, output schemas) see `[[android-cli]]` — Google's stock skill
that ships via `android init`.

## When this skill applies

- The codebase is Android/Kotlin (presence of `build.gradle(.kts)`,
  `AndroidManifest.xml`, or `settings.gradle(.kts)`).
- `android` CLI is on PATH (hard-mandatory after `gor-mobile init`
  v0.1.0+).
- Non-Android targets are out of scope for this skill — it simply
  does not apply.

## Phase → command map

### Brainstorm / research
- `android docs search "<keywords>"` — find authoritative Android docs.
- `android docs fetch "<id>"` — fetch a specific article.
- `android studio version-lookup <artifact>` — look up the latest
  Maven artifact version when proposing a dependency bump.

### Plan / project introspection
- `android describe --project_dir=.` — JSON dump of build targets +
  APK paths. Use this before assuming module layout.
- `android info` — SDK location and environment data.
- `android studio find-declaration "<symbol>"` — locate where a class /
  function is defined.
- `android studio find-usages "<symbol>"` — find callers of a symbol.

### Execute / SDK / build
- `android sdk list --all` — what's installed locally vs. available.
- `android sdk install platforms/android-<api>` — pull a missing
  platform; `android sdk update` to refresh existing.
- `android emulator list` / `emulator create` / `emulator start <name>`
  / `emulator stop` — manage AVDs.
- `android run --apks=<path>` — deploy and launch an APK.
  **This replaces `adb install` and manual `./gradlew installDebug`
  for Android targets** — do not fall back to those.

### Verify / device UI ops (mandatory before claiming "done" on UI work)
- Deploy via `android run --apks=<path>` (see Execute section above).
- `android screen capture -o <path>` — basic screenshot.
- `android screen capture --annotate -o <path>` — annotated screenshot
  (numerical labels + bounding boxes). Always visually examine the PNG.
- `android layout --pretty` — UI tree as JSON (primary inspection tool).
- `android layout --diff` — only elements that changed since the last
  `layout` call. Use to keep context small after a tap/scroll.
- `android screen resolve --screen <png> --string "#N"` — convert an
  annotated-screenshot label into tap coordinates.
- See `[[android-cli]] references/interact.md` for the full interaction
  protocol (tap, scroll, focus rules).

### Debug (UI bugs)
- `android layout --diff` after each user action — narrows context
  to changed elements only.
- `android screen capture` when `layout` fails (WebView, animation,
  full-screen image).
- `android studio render-compose-preview <file>:<previewName>` — render
  a Compose preview without booting a device.
- `android studio analyze-file <path>` — inspector output for IDE-level
  issues.

### E2E specs / TDD
- Journey XMLs are the `android` CLI's E2E test format — distinct from
  existing test infra (Espresso, UI Automator, Compose test rules).
  When writing new acceptance tests for an agent-driven flow, prefer
  authoring journeys; do not deprioritize existing test suites already
  in the project. Format reference: `[[android-cli]] references/journeys.md`.

## Catalog management

Google publishes a catalog of optional, domain-specific skills:
`navigation-3`, `edge-to-edge`, `r8-analyzer`,
`migrate-xml-views-to-jetpack-compose`, `play-billing-library-version-upgrade`,
`agp-9-upgrade`, `appfunctions`, `engage-sdk-integration`, etc.

To browse and install them:

```sh
gor-mobile android-skills
```

Multi-select prompt — pick the ones relevant to the current project
(e.g. install `play-billing-library-version-upgrade` when planning a
Billing v6→v7 migration; install `migrate-xml-views-to-jetpack-compose`
when planning Compose adoption). Don't suggest installing a Google skill
unconditionally — they're domain tools, not always-on.

## When `android` is missing

This should not happen after `gor-mobile init` v0.1.0+ (the CLI is
hard-mandatory). If it does happen mid-session:

1. **Do not silently fall back to `adb` or `./gradlew`.** That breaks
   the workflow contract.
2. Tell the user: «`android` CLI отсутствует — выполни
   `gor-mobile repair` или `gor-mobile init`».
3. Wait for the user to restore the CLI before proceeding.

The same rule applies if `android` is on PATH but its subcommands fail
(broken update, expired binary, etc.) — surface the error, instruct
`gor-mobile repair` / `android update`, do not paper over with `adb`.