import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export function buildJudgePrompt(text, rubric) {
  const claims = rubric.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return [
    "You grade a document against checkable claims. For each numbered claim answer YES only if the document clearly satisfies it, otherwise NO.",
    'Reply with JSON only: {"answers":["YES"|"NO", ...]} in claim order.',
    "", "Claims:", claims, "", "Document:", "<<<", text, ">>>"
  ].join("\n");
}

export function parseJudge(out, n) {
  const m = /\{[\s\S]*\}/.exec(out);
  let answers = [];
  try { answers = JSON.parse(m?.[0] ?? "{}").answers ?? []; } catch { answers = []; }
  return Array.from({ length: n }, (_, i) => String(answers[i] ?? "").toUpperCase() === "YES");
}

// Empty cwd: no gor-mobile marker, so the project hooks stay silent.
export async function judgeText(text, rubric, model = "haiku") {
  const cwd = mkdtempSync(join(tmpdir(), "judge-"));
  const { stdout } = await run("claude", [
    "-p", buildJudgePrompt(text, rubric), "--model", model, "--tools", "",
    "--max-turns", "1", "--output-format", "json", "--no-session-persistence"
  ], { cwd, maxBuffer: 16 << 20, timeout: 180_000 });
  const result = JSON.parse(stdout).result ?? "";
  return parseJudge(result, rubric.length);
}