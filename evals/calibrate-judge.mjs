#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeText } from "./lib/judge.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "judge-calibration");
const labels = JSON.parse(readFileSync(join(dir, "labels.json"), "utf8"));
const rubric = JSON.parse(readFileSync(join(dir, "rubric.json"), "utf8"));
let wrong = 0;
for (const [file, want] of Object.entries(labels)) {
  const got = await judgeText(readFileSync(join(dir, file), "utf8"), rubric);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) wrong++;
  console.log(`${ok ? "ok  " : "MISS"} ${file} want=${JSON.stringify(want)} got=${JSON.stringify(got)}`);
}
console.log(`${wrong}/${Object.keys(labels).length} mismatches`);
process.exit(wrong > 1 ? 1 : 0);