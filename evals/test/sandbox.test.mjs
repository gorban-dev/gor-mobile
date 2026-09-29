import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLock, cleanupStale, releaseLock, removeProjectKeys } from "../lib/sandbox.mjs";

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
  assert.deepEqual(readdirSync(d), ["claude.json"]);
  const mtime = statSync(claudeJson).mtimeMs;
  removeProjectKeys(["/nope"], claudeJson);
  assert.equal(statSync(claudeJson).mtimeMs, mtime);
});

test("lock: live pid blocks, stale pid is replaced", () => {
  const lock = join(mkdtempSync(join(tmpdir(), "lk-")), ".lock");
  acquireLock(lock);
  assert.equal(readFileSync(lock, "utf8"), String(process.pid));
  assert.throws(() => acquireLock(lock), new RegExp(`another eval run is active \\(pid ${process.pid}\\)`));
  releaseLock(lock);
  writeFileSync(lock, "999999999");
  acquireLock(lock);
  assert.equal(readFileSync(lock, "utf8"), String(process.pid));
  releaseLock(lock);
});