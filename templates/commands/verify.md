---
description: Verification Before Completion — evidence before claims, always
---

Target: **$ARGUMENTS** (feature name, plan path, or "last changes")

## gor-mobile overlay (two deltas only)

This command runs the superpowers `verification-before-completion` skill **verbatim** — read
`~/.claude/skills/gor-mobile-verification-before-completion/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
Android-specific evidence forms the Gate Function accepts:
- Test command: `./gradlew :<module>:test` (exit 0, pasted green tail).
- Build: `./gradlew assembleDebug` (exit 0).
- Rule-violation fix: diff showing the previously violated rule (from whichever
  section of `$HOME/.gor-mobile/rules/manifest.json` → `.sections`) is gone.

The rules-pack is the authoritative source — both the default one and any
user-installed custom pack (`gor-mobile rules use <url>`). Read it from the
manifest; do not hardcode section names.

### 2. Local-LLM delegation
This command routes to Opus — no local delegation. Independent scrutiny is the point.

Append this final-report shape after the standard gate:

    ## Acceptance criteria
    1. <criterion> — PASS (evidence: <command + green tail>)
    2. <criterion> — FAIL (reason: <why>)

    ## Regressions checked
    - <surface area> — no regression (evidence: ...)

    ## VERDICT: PASS | FAIL (<N> unverified, <M> failed)

If `VERDICT != PASS`, loop back to `/implement` in FIX mode with the failed items.
