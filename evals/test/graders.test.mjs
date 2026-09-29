import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { grade, changedFiles } from "../lib/graders.mjs";
import { parseJudge, buildJudgePrompt } from "../lib/judge.mjs";

const events = [
  { kind: "skill", name: "gor-mobile-writing-plans" },
  { kind: "read", path: "/h/.gor-mobile/rules/examples/presentation/ExampleViewModel.kt" },
  { kind: "deny" },
  { kind: "bash", command: "ast-index usages ProfileRepository --limit 1000" },
  { kind: "write", path: "/w/docs/plans/p.md" }
];

function repo(files) {
  const d = mkdtempSync(join(tmpdir(), "gr-"));
  execFileSync("git", ["init", "-q"], { cwd: d });
  writeFileSync(join(d, "old-plan.md"), "Conforms to: examples/presentation/ExampleViewModel.kt\n");
  execFileSync("git", ["add", "-A"], { cwd: d });
  execFileSync("git", ["-c", "user.email=e@e", "-c", "user.name=e", "commit", "-qm", "base"], { cwd: d });
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

const ctx = (extra = {}) => ({ events, meta: { final_text: "Critical: VM uses repository" }, workdir: "/nope", changed: [], ...extra });

test("first_skill / no_skill", async () => {
  assert.equal((await grade({ first_skill: { any_of: ["gor-mobile-writing-plans"] } }, ctx())).pass, true);
  assert.equal((await grade({ first_skill: { any_of: ["gor-mobile-brainstorming"] } }, ctx())).pass, false);
  assert.equal((await grade({ no_skill: { matching: "brainstorming" } }, ctx())).pass, true);
});

test("order graders", async () => {
  assert.equal((await grade({ skill_before_write: { skill: "gor-mobile-writing-plans", write: "plans/" } }, ctx())).pass, true);
  assert.equal((await grade({ read_before_write: { read: "examples/presentation/", write: "plans/" } }, ctx())).pass, true);
  assert.equal((await grade({ read_before_write: { read: "examples/usecase/", write: "plans/" } }, ctx())).pass, false);
});

test("bash_uses / max_denies / final_text_matches", async () => {
  assert.equal((await grade({ bash_uses: { regex: "^ast-index usages" } }, ctx())).pass, true);
  assert.equal((await grade({ max_denies: { n: 0 } }, ctx())).pass, false);
  assert.equal((await grade({ max_denies: { n: 1 } }, ctx())).pass, true);
  assert.equal((await grade({ final_text_matches: { regex: "Critical" } }, ctx())).pass, true);
});

test("conforms_to ignores pre-existing files", async () => {
  const d = repo({ "docs/plans/new.md": "Task 1\nConforms to: examples/presentation/ExampleViewModel.kt, examples/presentation/ExampleViewState.kt\n" });
  const c = ctx({ workdir: d, changed: changedFiles(d) });
  assert.deepEqual(c.changed, ["docs/plans/new.md"]);
  const ok = await grade({ conforms_to: { path: "\\.md$", required: ["examples/presentation/ExampleViewState.kt"] } }, c);
  assert.equal(ok.pass, true);
  const miss = await grade({ conforms_to: { path: "\\.md$", required: ["examples/usecase/ExampleUseCase.kt"] } }, c);
  assert.equal(miss.pass, false);
  const none = await grade({ conforms_to: { path: "old-plan" , required: [] } }, c);
  assert.equal(none.pass, false);
});

test("file_matches", async () => {
  const d = repo({ "a/X.kt": "class X : UseCase" });
  const c = ctx({ workdir: d, changed: changedFiles(d) });
  assert.equal((await grade({ file_matches: { path: "\\.kt$", content: "UseCase" } }, c)).pass, true);
  assert.equal((await grade({ file_matches: { path: "\\.kt$", content: "Nope" } }, c)).pass, false);
});

test("unknown grader throws", async () => {
  await assert.rejects(grade({ bogus: {} }, ctx()), /unknown grader/);
});

test("judge parsing", () => {
  assert.deepEqual(parseJudge('noise {"answers":["YES","NO"]} tail', 2), [true, false]);
  assert.deepEqual(parseJudge("garbage", 2), [false, false]);
  assert.match(buildJudgePrompt("T", ["a", "b"]), /1\. a\n2\. b/);
});