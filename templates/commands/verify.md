---
description: Android — evidence-based final check before declaring done (cloud/Opus)
---

# /verify — evidence-based final verification

<EXTREMELY_IMPORTANT>
This is the final gate. You MUST produce evidence — not "should work". Acceptable evidence:

- A passing test run (paste the command + the green tail of the output)
- A screenshot from `/test-ui` matching the expected state
- A diff showing the specific rule that had been violated is now fixed

Do NOT accept "looks correct" as evidence. If you cannot produce evidence for a claim, mark it as UNVERIFIED.
</EXTREMELY_IMPORTANT>

## Routing

`/verify` runs on Opus. Do NOT delegate to `gor-mobile llm` — the point is independent scrutiny.

## Rubric

For each acceptance criterion in the original plan / user request:

- Criterion: ...
- Evidence: <paste test output | reference screenshot | reference diff>
- Status: PASS / FAIL / UNVERIFIED

## Final report

```
## Acceptance criteria
1. <criterion> — PASS (evidence: ...)
2. <criterion> — FAIL (reason: ...)

## Regressions checked
- <surface area> — no regression (evidence: ...)

## VERDICT: PASS | FAIL (<N> unverified, <M> failed)
```

If VERDICT != PASS, loop back to `/implement` with the failed items as a FIX list.
