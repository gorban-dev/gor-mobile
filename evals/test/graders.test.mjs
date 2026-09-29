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

test("deleted file not in changedFiles, file_matches does not throw", async () => {
  const d = repo({ "a/X.kt": "class X" });
  const changed = changedFiles(d);
  assert.equal(changed.length, 1);
  // Delete the file
  execFileSync("rm", ["-f", join(d, "a/X.kt")], { cwd: d });
  const changedAfter = changedFiles(d);
  assert.deepEqual(changedAfter, []); // Deleted files excluded
  // file_matches should not throw even if changed is stale
  const result = await grade({ file_matches: { path: "\\.kt$", content: "X" } }, ctx({ workdir: d, changed: [] }));
  assert.equal(result.pass, false); // No matching files
  assert.equal(result.detail, "0 files"); // No crash
});

test("committed file after base still in changedFiles", async () => {
  const d = repo({});
  // Simulate agent committing a file
  mkdirSync(join(d, "docs"), { recursive: true });
  writeFileSync(join(d, "docs/plan.md"), "Plan here\n");
  execFileSync("git", ["add", "docs/plan.md"], { cwd: d });
  execFileSync("git", ["-c", "user.email=e@e", "-c", "user.name=e", "commit", "-qm", "task"], { cwd: d });
  const changed = changedFiles(d);
  assert.deepEqual(changed, ["docs/plan.md"]);
});

test("no_skill / skill_before_write negatives", async () => {
  // no_skill fails when matching skill exists
  assert.equal((await grade({ no_skill: { matching: "writing-plans" } }, ctx())).pass, false);
  // skill_before_write fails when write comes before skill
  const writeFirstEvents = [
    { kind: "write", path: "/w/docs/plans/p.md" },
    { kind: "skill", name: "gor-mobile-writing-plans" }
  ];
  assert.equal((await grade({ skill_before_write: { skill: "gor-mobile-writing-plans", write: "plans/" } }, ctx({ events: writeFirstEvents }))).pass, false);
});

test("router skill is ignored by skill graders", async () => {
  const ev = [
    { kind: "skill", name: "gor-mobile-using-superpowers" },
    { kind: "skill", name: "gor-mobile-systematic-debugging" }
  ];
  assert.equal((await grade({ first_skill: { any_of: ["gor-mobile-systematic-debugging"] } }, ctx({ events: ev }))).pass, true);
  const only = [{ kind: "skill", name: "gor-mobile-using-superpowers" }];
  assert.equal((await grade({ no_skill: { matching: "using" } }, ctx({ events: only }))).pass, true);
  assert.equal((await grade({ first_skill: { any_of: ["gor-mobile-using-superpowers"] } }, ctx({ events: only }))).pass, false);
});