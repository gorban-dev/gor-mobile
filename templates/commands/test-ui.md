---
description: Android — UI testing on a device via Android CLI + vision LLM
---

# /test-ui — UI test on device

Target: **$ARGUMENTS** (feature to exercise, e.g., "login flow")

<EXTREMELY_IMPORTANT>
- Device build, install, launch, and interaction MUST go through the Google Android CLI (https://developer.android.com/tools/agents), invoked as `gor-mobile android <subcommand>`.
- Vision analysis of screenshots MUST go through the local vision model:

  ```sh
  gor-mobile llm vision --input <prompt-file>
  ```
</EXTREMELY_IMPORTANT>

## Flow

1. Use `gor-mobile android` to build, install, launch the app, and drive it through the target flow.
2. Capture screenshots at each meaningful state.
3. For each screenshot, compose a vision prompt including:
   - The screenshot (as a base64 data URL attached to the message content)
   - The expected UI state (from the feature's `ViewState`)
   - The design rubric (rules/theme-system.md)
   - Instruction: "Report Issues as `[Rendering|Interaction|Navigation|Accessibility] description`. End with VERDICT."

4. Run `gor-mobile llm vision --input /tmp/gor-mobile-vision-$$.md`
5. Aggregate issues across all screens.

## What to check

- Visible state matches ViewState at each step
- Theme compliance: typography, colours, spacing all from `{App}Theme`
- Empty/loading/error states render
- Back navigation behaves correctly
- Accessibility: touch targets, content descriptions

## Exit

- Pass the aggregated issue list to `/implement` in FIX mode if any FAIL
- Otherwise proceed to `/verify`
