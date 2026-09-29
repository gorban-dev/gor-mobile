import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseClaude } from "../lib/adapters/claude.mjs";
import { parseCodex, unwrapShell } from "../lib/adapters/codex.mjs";

const lines = (f) => readFileSync(new URL(`./samples/${f}`, import.meta.url), "utf8").split("\n");

test("claude: skill, read, deny, bash, write, meta", () => {
  const { events, meta } = parseClaude(lines("claude.jsonl"));
  const kinds = events.map((e) => e.kind);
  assert.deepEqual(kinds, ["text", "skill", "read", "tool", "deny", "bash", "write"]);
  assert.equal(events[1].name, "gor-mobile-brainstorming");
  assert.equal(meta.model, "claude-opus-5-5");
  assert.equal(meta.cost_usd, 0.18);
  assert.equal(meta.final_text, "done");
});

test("codex: skill read via sed", () => {
  const { events } = parseCodex(lines("codex.jsonl"));
  const skills = events.filter((e) => e.kind === "skill").map((e) => e.name);
  assert.deepEqual(skills, ["gor-mobile-systematic-debugging", "gor-mobile-writing-plans"]);
});

test("codex: deny, write, usage, final text", () => {
  const { events, meta } = parseCodex(lines("codex.jsonl"));
  assert.equal(events.filter((e) => e.kind === "deny").length, 1);
  assert.equal(events.find((e) => e.kind === "write").path, "/tmp/app/docs/plans/p.md");
  assert.equal(meta.input_tokens, 100);
  assert.equal(meta.final_text, "done");
});

test("codex: unwrapShell keeps quotes", () => {
  assert.equal(unwrapShell("/bin/zsh -lc 'echo '\\''hi'\\'''"), "echo 'hi'");
  assert.equal(unwrapShell("ls -la"), "ls -la");
});

test("claude: API-error result is flagged, normal result has has_result", () => {
  const err = JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "API Error: 529", total_cost_usd: 0 });
  const { meta } = parseClaude([err]);
  assert.equal(meta.has_result, true);
  assert.equal(meta.is_error, true);
  assert.equal(meta.outcome, "success");
  assert.equal(parseClaude(lines("claude.jsonl")).meta.is_error, false);
  assert.equal(parseClaude([]).meta.has_result, undefined);
});

test("codex: turn.failed and error events set error_message, turn.completed sets completed", () => {
  const failed = [
    JSON.stringify({ type: "error", message: "stream disconnected" }),
    JSON.stringify({ type: "turn.failed", error: { message: "usage limit" } })
  ];
  assert.equal(parseCodex(failed).meta.error_message, "usage limit");
  assert.equal(parseCodex([failed[0]]).meta.error_message, "stream disconnected");
  assert.equal(parseCodex(lines("codex.jsonl")).meta.completed, true);
  assert.equal(parseCodex(lines("codex.jsonl")).meta.error_message, undefined);
});

test("codex: non-gor-mobile skills (android-cli) are credited", () => {
  const l = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "cat /h/.codex/skills/android-cli/SKILL.md", aggregated_output: "" } });
  assert.deepEqual(parseCodex([l]).events.filter((e) => e.kind === "skill").map((e) => e.name), ["android-cli"]);
});