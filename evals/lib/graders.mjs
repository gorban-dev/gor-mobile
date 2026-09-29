import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeText } from "./judge.mjs";

const bare = (n) => String(n ?? "").replace(/^.*:/, "");
const re = (s, f = "") => new RegExp(s, f);
const touches = (e, r) =>
  (e.kind === "read" && r.test(e.path ?? "")) || ((e.kind === "bash" || e.kind === "tool") && r.test(e.command ?? ""));
const writes = (e, r) => e.kind === "write" && r.test(e.path ?? "");
const read = (dir, f) => readFileSync(join(dir, f), "utf8");

export function changedFiles(workdir) {
  // Get base commit (first commit)
  const base = execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: workdir, encoding: "utf8" }).trim();
  // Tracked files: changes from base to working tree, no deletions
  const tracked = execFileSync("git", ["diff", "--name-only", "-z", "--diff-filter=d", base], { cwd: workdir, encoding: "utf8" });
  // Untracked files
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: workdir, encoding: "utf8" });
  // Union, split on \0, filter init footprint, sort
  return (tracked + untracked).split("\0").filter(Boolean)
    .filter((p) => !p.startsWith(".claude/") && !p.startsWith(".gor-mobile/marker") && !p.startsWith(".gor-mobile/state/"))
    .sort();
}

const GRADERS = {
  first_skill: ({ events }, { any_of }) => {
    const s = events.find((e) => e.kind === "skill");
    return { pass: !!s && any_of.includes(bare(s.name)), detail: s ? bare(s.name) : "no skill" };
  },
  no_skill: ({ events }, { matching }) => {
    const hit = events.find((e) => e.kind === "skill" && re(matching).test(bare(e.name)));
    return { pass: !hit, detail: hit ? bare(hit.name) : "none" };
  },
  skill_before_write: ({ events }, { skill, write }) => {
    const s = events.findIndex((e) => e.kind === "skill" && bare(e.name) === skill);
    const w = events.findIndex((e) => writes(e, re(write)));
    return { pass: s !== -1 && (w === -1 || s < w), detail: `skill@${s} write@${w}` };
  },
  read_before_write: ({ events }, { read: r, write }) => {
    const i = events.findIndex((e) => touches(e, re(r)));
    const w = events.findIndex((e) => writes(e, re(write)));
    return { pass: i !== -1 && w !== -1 && i < w, detail: `read@${i} write@${w}` };
  },
  file_matches: ({ workdir, changed }, { path, content, min = 1 }) => {
    const n = changed.filter((f) => re(path).test(f) && re(content, "m").test(read(workdir, f))).length;
    return { pass: n >= min, detail: `${n} files` };
  },
  conforms_to: ({ workdir, changed }, { path, required }) => {
    const files = changed.filter((f) => re(path).test(f));
    const lines = files.flatMap((f) => read(workdir, f).split("\n")).filter((l) => l.includes("Conforms to")).join("\n");
    const missing = required.filter((r) => !lines.includes(r));
    return { pass: files.length > 0 && missing.length === 0, detail: files.length ? `missing: ${missing.join(", ") || "none"}` : "no file" };
  },
  bash_uses: ({ events }, { regex }) => {
    const hit = events.find((e) => e.kind === "bash" && re(regex).test(e.command ?? ""));
    return { pass: !!hit, detail: hit?.command ?? "none" };
  },
  max_denies: ({ events }, { n }) => {
    const d = events.filter((e) => e.kind === "deny").length;
    return { pass: d <= n, detail: `${d} denies` };
  },
  final_text_matches: ({ meta }, { regex }) => ({ pass: re(regex, "m").test(meta.final_text ?? ""), detail: "" }),
  judge: async ({ workdir, changed, meta }, { path, rubric }) => {
    const text = path ? changed.filter((f) => re(path).test(f)).map((f) => read(workdir, f)).join("\n\n") : meta.final_text ?? "";
    if (!text) return { pass: false, detail: "nothing to judge" };
    try {
      const yes = await judgeText(text, rubric);
      return { pass: yes.every(Boolean), detail: yes.map((y) => (y ? "Y" : "N")).join("") };
    } catch (err) {
      const msg = String(err?.message ?? err).slice(0, 200);
      return { pass: false, detail: `judge error: ${msg}` };
    }
  }
};

export async function grade(spec, ctx) {
  const [name, args] = Object.entries(spec)[0] ?? [];
  const fn = GRADERS[name];
  if (!fn) throw new Error(`unknown grader: ${name}`);
  return { grader: name, ...(await fn(ctx, args ?? {})) };
}