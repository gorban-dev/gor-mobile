---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

Invoke the matching gor-mobile skill before the first tool call or
clarifying question. The skills carry what the code does not show: the
repo's Android conventions and layer examples, the docs-first and
examples-first gates, the review routing and the no-git policy. A task that
turns out not to need the skill costs one invocation; a task run without it
reproduces the failures the gates exist for.

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. Brainstorming and systematic-debugging are Superpowers' most common process skills, but the rule holds for any of them.

- "Let's build X" → superpowers:brainstorming first, then implementation skills.
- "Fix this bug" → superpowers:systematic-debugging first, then domain skills.

## Where the routing usually slips

| Thought | Reality |
|---------|---------|
| "Let me grep / read the code first" | Structural lookups go through the ast-index skill; the guard hook denies bare-identifier greps anyway. |
| "This is a one-line fix" | One-line fixes touch a layer, and the layer has a canonical shape. Route through the skill. |
| "I know this Jetpack API" | Cutoff → APIs drift. The docs-first gate runs before any signature is written. |
| "Another plugin's skill matched" | A foreign match does not replace the gor-mobile process skill; run both. |

## Platform Adaptation

gor-mobile installs into Claude Code and OpenAI Codex CLI. Skill bodies use Claude Code tool names (`Skill`, `Task`, `TodoWrite`); on Codex, invoke skills through the native skill mechanism and track checklists in your plan tool.

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, etc, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.
