import {
  cpSync,
  chmodSync,
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, join } from "node:path";
import {
  CLAUDE_AGENTS_DIR,
  CLAUDE_SKILLS_DIR,
  GOR_MOBILE_TEMPLATES_DIR,
  gorMobileRoot
} from "../constants.js";
import { ensureDir } from "./paths.js";

export function copyHookTemplates(): void {
  ensureDir(GOR_MOBILE_TEMPLATES_DIR);
  const names = ["session-start-hook.sh", "user-prompt-submit-hook.sh"];
  for (const name of names) {
    const src = join(gorMobileRoot(), "templates", name);
    const dst = join(GOR_MOBILE_TEMPLATES_DIR, name);
    copyFileSync(src, dst);
    chmodSync(dst, 0o755);
  }
  const stale = join(GOR_MOBILE_TEMPLATES_DIR, "session-start-snippet.md");
  if (existsSync(stale)) rmSync(stale);
}

function transformSkillBody(content: string): string {
  return content
    .replace(/superpowers:/g, "gor-mobile-")
    .replace(/^name: /gm, "name: gor-mobile-")
    .replace(
      /"Invoke brainstorming skill"/g,
      '"Invoke gor-mobile-brainstorming skill"'
    )
    .replace(
      /"Invoke writing-plans skill"/g,
      '"Invoke gor-mobile-writing-plans skill"'
    )
    .replace(
      /~\/\.config\/superpowers\/worktrees/g,
      "~/.config/gor-mobile/worktrees"
    )
    .replace(/all 5 tasks/g, "all tasks")
    .replace(/docs\/superpowers\/specs\//g, ".gor-mobile/specs/")
    .replace(/docs\/superpowers\/plans\//g, ".gor-mobile/plans/")
    .replace(
      /^[ \t]*-[^\n]*(using-git-worktrees|finishing-a-development-branch)[^\n]*\n/gm,
      ""
    )
    .replace(
      /"Use gor-mobile-finishing-a-development-branch"/g,
      '"User decides next step"'
    )
    .replace(
      /Use gor-mobile-finishing-a-development-branch/g,
      "User decides next step"
    );
}

export interface InstallSkillsResult {
  installed: string[];
  missingPrefix: string[];
}

export function installSkills(): InstallSkillsResult {
  ensureDir(CLAUDE_SKILLS_DIR);
  for (const entry of readdirSync(CLAUDE_SKILLS_DIR)) {
    if (entry.startsWith("gor-mobile-")) {
      rmSync(join(CLAUDE_SKILLS_DIR, entry), { recursive: true, force: true });
    }
  }

  const root = gorMobileRoot();
  const skillsDir = join(root, "templates", "skills");
  const overlaysDir = join(root, "templates", "overlays");
  const installed: string[] = [];
  const missingPrefix: string[] = [];

  if (!existsSync(skillsDir)) return { installed, missingPrefix };

  for (const name of readdirSync(skillsDir)) {
    const srcDir = join(skillsDir, name);
    if (!statSync(srcDir).isDirectory()) continue;
    const dstDir = join(CLAUDE_SKILLS_DIR, `gor-mobile-${name}`);
    cpSync(srcDir, dstDir, { recursive: true });
    const skillMd = join(dstDir, "SKILL.md");
    if (existsSync(skillMd)) {
      let body = transformSkillBody(readFileSync(skillMd, "utf8"));
      const overlayPath = join(overlaysDir, `${name}.md`);
      if (existsSync(overlayPath)) {
        body += "\n" + readFileSync(overlayPath, "utf8");
      }
      writeFileSync(skillMd, body);
      if (!/^name: gor-mobile-/m.test(body)) {
        missingPrefix.push(skillMd);
      }
      if (/using-git-worktrees|finishing-a-development-branch/.test(body)) {
        console.warn(
          `[gor-mobile] warning: stale skill reference in ${skillMd}`
        );
      }
    }
    installed.push(name);
  }

  return { installed, missingPrefix };
}

export function installAgents(): string[] {
  ensureDir(CLAUDE_AGENTS_DIR);
  const src = join(gorMobileRoot(), "templates", "agents");
  const copied: string[] = [];
  if (!existsSync(src)) return copied;
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".md")) continue;
    const from = join(src, name);
    const to = join(CLAUDE_AGENTS_DIR, name);
    copyFileSync(from, to);
    chmodSync(to, 0o644);
    copied.push(name);
  }
  return copied;
}

export function cleanupLegacyCommands(commandsDir: string): string[] {
  if (!existsSync(commandsDir)) return [];
  const legacy = [
    "brainstorm",
    "plan",
    "worktree",
    "implement",
    "execute",
    "parallel",
    "tdd",
    "review",
    "verify",
    "debug",
    "finishing-branch"
  ];
  const removed: string[] = [];
  for (const cmd of legacy) {
    const file = join(commandsDir, `${cmd}.md`);
    if (!existsSync(file)) continue;
    const head = readFileSync(file, "utf8").split("\n").slice(0, 10).join("\n");
    if (head.includes("Task from user: **$ARGUMENTS**")) {
      rmSync(file);
      removed.push(basename(file));
    }
  }
  return removed;
}

export function cleanupLegacyAgents(): string[] {
  const removed: string[] = [];
  const advisor = join(CLAUDE_AGENTS_DIR, "gor-mobile-advisor.md");
  if (existsSync(advisor)) {
    rmSync(advisor);
    removed.push(basename(advisor));
  }
  const legacyCr = join(CLAUDE_AGENTS_DIR, "code-reviewer.md");
  if (existsSync(legacyCr)) {
    const head = readFileSync(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
    if (/^name: code-reviewer/m.test(head)) {
      rmSync(legacyCr);
      removed.push(basename(legacyCr));
    }
  }
  return removed;
}
