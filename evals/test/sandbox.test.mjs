import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupStale, removeProjectKeys } from "../lib/sandbox.mjs";

test("stale registry cleanup", () => {
  const d = mkdtempSync(join(tmpdir(), "reg-"));
  const claudeJson = join(d, "claude.json");
  const registry = join(d, "registry.json");
  writeFileSync(claudeJson, JSON.stringify({ projects: { "/tmp/run1/app": { mcpServers: {} }, "/real/repo": { x: 1 } }, other: 1 }));
  writeFileSync(registry, JSON.stringify(["/tmp/run1/app"]));
  cleanupStale(registry, claudeJson);
  const j = JSON.parse(readFileSync(claudeJson, "utf8"));
  assert.deepEqual(Object.keys(j.projects), ["/real/repo"]);
  assert.equal(j.other, 1);
  assert.deepEqual(JSON.parse(readFileSync(registry, "utf8")), []);
});

test("removeProjectKeys deletes only listed keys and skips write when nothing changed", () => {
  const d = mkdtempSync(join(tmpdir(), "rpk-"));
  const claudeJson = join(d, "claude.json");
  writeFileSync(claudeJson, JSON.stringify({ projects: { "/a": {}, "/b": { k: 1 } } }));
  removeProjectKeys(["/a", "/missing"], claudeJson);
  const raw = readFileSync(claudeJson, "utf8");
  assert.deepEqual(JSON.parse(raw), { projects: { "/b": { k: 1 } } });
  assert.ok(raw.includes('\n  "projects"'));
  const mtime = statSync(claudeJson).mtimeMs;
  removeProjectKeys(["/nope"], claudeJson);
  assert.equal(statSync(claudeJson).mtimeMs, mtime);
});
