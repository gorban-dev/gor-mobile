# Instruction Strength for Current Models

## Overview

Earlier model generations skipped steps unless a skill pushed hard: "YOU MUST", "No exceptions", bright-line threats. Current Claude models (Claude 5 generation) and current Codex models follow plain instructions and read the whole skill. On them, pressure language backfires: it makes a skill fire where it does not apply, and it makes a rule win against the user's request or another rule it was never meant to override.

Anthropic cut over 80% of Claude Code's system prompt for Claude 5 models with no measured loss, and its prompting guide says to replace "CRITICAL: You MUST use this tool when…" with "Use this tool when…". Write skills the same way.

## What to write instead

| Old habit | Write instead |
|-----------|---------------|
| "YOU MUST do X. No exceptions." | "Do X — <one-line reason>." The reason lets the model apply the rule to cases you did not list. |
| The same rule in the description, the body and a hook | One authoritative place. The description says *when* the skill applies; the body says *how*. |
| A long table of forbidden rationalizations | The two or three failures you actually observed, each tied to the rule it breaks. |
| "IMMEDIATELY", "Every time", "= failure" | Order the steps. Sequence carries urgency without shouting. |
| Long lists of examples | A precise rule, or a structured artifact the model fills in (a checklist line, a required plan header). Examples narrow what the model will try. |
| A gate that exists only as prose | Put it in structure where you can: a required artifact the next step reads, a hook that denies the call, a reviewer check. |

## When stronger wording is justified

Only with evidence. Raise the pressure on one step when a transcript or an eval shows that step being skipped under realistic load. Then:

- Scope it to the harness that skipped it (an `On Codex` branch, for example), not to every agent.
- Keep the reason next to the rule.
- Measure again after the change, and remove the pressure if it does not move the result.

Pressure added "just in case" is the default failure: it costs tokens in every session and pulls the model toward the skill when the task does not need it.

## Where this came from

The earlier version of this file cited Meincke et al. (2025), "Call Me A Jerk: Persuading AI to Comply with Objectionable Requests". That study measured whether persuasion gets models to do things they would otherwise refuse. It says nothing about whether a skill's steps get followed, and it is not a basis for skill wording.

Sources: Anthropic, "The new rules of context engineering for Claude 5 generation models" (claude.dev, 2026); Claude Platform docs, "Prompting best practices" and "Prompting Claude Opus 5".

## Quick check before shipping a skill

1. Does every "must/never" carry a reason?
2. Is each rule stated in exactly one place?
3. Is there an observed failure behind every piece of emphasis?
4. Could a gate live in structure instead of prose?
