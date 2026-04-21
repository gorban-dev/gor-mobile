import { existsSync, readFileSync } from "node:fs";
import { execa } from "execa";
import {
  CLAUDE_AGENTS_DIR,
  CLAUDE_CLAUDE_MD,
  CLAUDE_SETTINGS,
  CLAUDE_SKILLS_DIR,
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_HOME,
  GOR_MOBILE_RULES_DIR,
  SECTION_BEGIN
} from "../constants.js";
import { hasManagedHook } from "../helpers/settings-merge.js";
import { androidCliPath, which } from "../helpers/deps.js";
import { readManifest } from "../helpers/rules-pack.js";
import { log } from "../ui/log.js";

interface DoctorOptions {
  verbose?: boolean;
}

function reportDep(name: string, path: string | null, required: boolean): void {
  if (path) {
    log.ok(`${name} → ${path}`);
  } else if (required) {
    log.err(`${name} not found (required)`);
  } else {
    log.warn(`${name} not found (optional)`);
  }
}

function checkFile(path: string, label: string): boolean {
  if (existsSync(path)) {
    log.ok(`${label} → ${path}`);
    return true;
  }
  log.warn(`${label} missing (${path})`);
  return false;
}

function checkHooks(): void {
  if (!existsSync(CLAUDE_SETTINGS)) {
    log.warn(`No ${CLAUDE_SETTINGS}`);
    return;
  }
  if (hasManagedHook("SessionStart")) {
    log.ok("SessionStart hook registered");
  } else {
    log.warn("SessionStart hook NOT registered — run 'gor-mobile repair'");
  }
  if (hasManagedHook("UserPromptSubmit")) {
    log.ok("UserPromptSubmit hook registered");
  } else {
    log.warn("UserPromptSubmit hook NOT registered — run 'gor-mobile repair'");
  }
}

function checkClaudeMdSection(): void {
  if (!existsSync(CLAUDE_CLAUDE_MD)) {
    log.warn(`${CLAUDE_CLAUDE_MD} does not exist`);
    return;
  }
  if (readFileSync(CLAUDE_CLAUDE_MD, "utf8").includes(SECTION_BEGIN)) {
    log.ok("CLAUDE.md managed section present");
  } else {
    log.warn("CLAUDE.md managed section missing — run 'gor-mobile repair'");
  }
}

function checkRulesPack(): void {
  if (!existsSync(GOR_MOBILE_RULES_DIR)) {
    log.warn(`Rules pack not installed (${GOR_MOBILE_RULES_DIR})`);
    return;
  }
  const m = readManifest();
  if (!m) {
    log.warn("manifest.json missing or unreadable in rules pack");
    return;
  }
  log.ok(
    `Rules pack v${m.version ?? "?"} (stack=${m.stack ?? "?"}) at ${GOR_MOBILE_RULES_DIR}`
  );
}

async function verboseHookEmulation(): Promise<void> {
  const hooks: Array<[string, string]> = [
    ["session-start-hook.sh", "SessionStart"],
    ["user-prompt-submit-hook.sh", "UserPromptSubmit"]
  ];
  for (const [file, label] of hooks) {
    const path = `${GOR_MOBILE_HOME}/templates/${file}`;
    if (!existsSync(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    const result = await execa("bash", [path], { reject: false });
    if (result.exitCode !== 0) {
      log.warn(`[${label}] hook exited ${result.exitCode}:`);
      console.error(result.stdout || result.stderr);
      continue;
    }
    try {
      const parsed = JSON.parse(result.stdout);
      const ctx = parsed?.hookSpecificOutput?.additionalContext;
      if (!ctx) {
        log.warn(`[${label}] hook produced no additionalContext`);
        console.error(result.stdout);
        continue;
      }
      log.ok(`[${label}] hook injects ${String(ctx).length} chars of additionalContext`);
      console.error(`    --- first 30 lines of ${label} context ---`);
      console.error(
        String(ctx)
          .split("\n")
          .slice(0, 30)
          .map((l) => `    ${l}`)
          .join("\n")
      );
      console.error("    --- end ---");
    } catch {
      log.warn(`[${label}] hook output is not valid JSON`);
      console.error(result.stdout);
    }
  }
}

function verboseSkillsFrontmatter(): void {
  if (!existsSync(CLAUDE_SKILLS_DIR)) {
    log.warn(`${CLAUDE_SKILLS_DIR} missing`);
    return;
  }
  const { readdirSync } = require("node:fs");
  const { join } = require("node:path");
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync(CLAUDE_SKILLS_DIR)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join(CLAUDE_SKILLS_DIR, entry, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    count++;
    const content = readFileSync(skillMd, "utf8");
    if (!/^name: gor-mobile-/m.test(content)) {
      bad++;
      log.warn(`  ${skillMd} missing 'name: gor-mobile-' prefix`);
    }
  }
  if (bad === 0) {
    log.ok(`Skills frontmatter OK (${count} SKILL.md files, all prefixed)`);
  } else {
    log.warn(`Skills frontmatter: ${bad} of ${count} missing prefix — run 'gor-mobile repair'`);
  }
}

export async function cmdDoctor(opts: DoctorOptions = {}): Promise<void> {
  log.step("Environment");
  reportDep("brew", which("brew"), false);
  reportDep("git", which("git"), true);
  reportDep("curl", which("curl"), true);
  reportDep("node", which("node"), true);
  reportDep("android", androidCliPath(), false);

  log.step("Claude Code integration");
  checkFile(CLAUDE_SETTINGS, "settings.json");
  checkHooks();
  checkFile(CLAUDE_AGENTS_DIR, "agents/");
  checkClaudeMdSection();

  log.step("Rules pack");
  checkRulesPack();

  log.step("Config");
  checkFile(GOR_MOBILE_CONFIG, "config.json");

  if (opts.verbose) {
    log.step("Hooks emulation (verbose)");
    await verboseHookEmulation();
    log.step("Skills frontmatter (verbose)");
    verboseSkillsFrontmatter();
  }

  console.error("");
  log.info("If anything is missing, run: gor-mobile repair");
  if (!opts.verbose) {
    log.info("Run 'gor-mobile doctor --verbose' for hook-payload dump.");
  }
}
