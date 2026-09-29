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