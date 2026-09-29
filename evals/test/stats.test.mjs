import { test } from "node:test";
import assert from "node:assert/strict";
import { caseRates, pairedDelta, verdict } from "../lib/stats.mjs";

const row = (variant, c, pass, harness = "claude", split = "train") => ({ variant, harness, case: c, split, pass });

test("caseRates averages runs", () => {
  const r = caseRates([row("a", "x", true), row("a", "x", false), row("b", "x", true)]);
  assert.equal(r.get("claude|x").a, 0.5);
  assert.equal(r.get("claude|x").b, 1);
});

test("missing cells are skipped, not zero", () => {
  const rows = [row("a", "x", true), row("b", "x", true), row("a", "only-a", false)];
  const d = pairedDelta(caseRates(rows), "a", "b");
  assert.equal(d.n, 1);
  assert.equal(d.mean, 0);
});

test("pairedDelta is deterministic and brackets the mean", () => {
  const rows = [];
  for (const c of ["c1", "c2", "c3", "c4"]) { rows.push(row("a", c, false), row("b", c, true)); }
  const d1 = pairedDelta(caseRates(rows), "a", "b");
  const d2 = pairedDelta(caseRates(rows), "a", "b");
  assert.deepEqual(d1, d2);
  assert.equal(d1.mean, 1);
  assert.ok(d1.lo <= d1.mean && d1.mean <= d1.hi);
});

test("verdict rules", () => {
  const up = { mean: 0.2, lo: 0.1, hi: 0.3 };
  const flat = { mean: 0.01, lo: -0.05, hi: 0.07 };
  const down = { mean: -0.2, lo: -0.3, hi: -0.1 };
  assert.equal(verdict({ train: up, test: up, noise: 0.05 }), "keep");
  assert.equal(verdict({ train: up, test: flat, noise: 0.05 }), "revert");
  assert.equal(verdict({ train: flat, test: down, noise: 0.05 }), "revert");
  assert.equal(verdict({ train: flat, test: flat, noise: 0.05 }), "noise");
});