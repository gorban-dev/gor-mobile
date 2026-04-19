---
description: Android — research and design a solution before implementation (HARD-GATE before /plan)
---

# /brainstorm — Android feature brainstorm

Task from user: **$ARGUMENTS**

<EXTREMELY_IMPORTANT>
This is a HARD GATE. You MUST NOT proceed to /implement or write code until the user explicitly approves one of the proposals. If the user tries to skip straight to coding, remind them the next step is /plan, then /implement.
</EXTREMELY_IMPORTANT>

## Inputs to load

1. Core rules (always): `$HOME/.gor-mobile/rules/rules/core.md`
2. Architecture: `$HOME/.gor-mobile/rules/rules/architecture.md`
3. 1-2 related example files under `$HOME/.gor-mobile/rules/examples/` matching the feature layer

## Process

1. **Clarify intent** — ask the user 1-3 focused questions if the task is under-specified (inputs/outputs, data sources, success criteria). Do not invent requirements.
2. **Survey existing code** — Glob/Grep for existing features in the same area. Identify reusable layers.
3. **Propose 2-3 approaches** — for each: layer breakdown, data flow, DI impact, risks. Compare tradeoffs explicitly (latency, reuse, test surface, risk of regression).
4. **Recommend** — state which approach you would take and why (1-2 sentences).
5. **Gate** — end with: `Which approach should we take? Reply with 1/2/3 or describe adjustments.`

## Routing

Brainstorm is cloud-routed (Opus). Do NOT call `gor-mobile llm impl` here — analysis is your job, not code-gen.

## Output format

```
## Context
<what the user wants, what exists>

## Approach A — <name>
- ...
- Tradeoffs: ...

## Approach B — <name>
...

## Recommendation
Approach X, because ...

## Next step
Reply with a choice, then run `/plan`.
```
