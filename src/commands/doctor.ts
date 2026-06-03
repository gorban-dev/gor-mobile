import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { androidCliSkillInstalled, smokeTestContract } from "../helpers/android-cli.js";
import { ANDROID_CONTRACT } from "../android-contract.js";
import { countManagedHooks } from "../helpers/settings-merge.js";
import { statusLineState } from "../helpers/settings-statusline.js";
import { androidCliPath, which } from "../helpers/deps.js";
import { astIndexPath } from "../helpers/ast-index.js";
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
  for (const hookType of ["SessionStart", "UserPromptSubmit"] as const) {
    const n = countManagedHooks(hookType);
    if (n === 0) {
      log.warn(`${hookType} hook NOT registered — run 'gor-mobile repair'`);
    } else if (n > 1) {
      log.warn(`${hookType} has ${n} duplicate managed entries — run 'gor-mobile repair'`);
    } else {
      log.ok(`${hookType} hook registered`);
    }
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

function checkStatusLine(): void {
  const st = statusLineState();
  if (st.managed) {
    log.ok(`Status line: ${st.variant === "cat" ? "Cat" : "Classic"} (managed)`);
    if (!which("jq")) {
      log.warn("  → status line needs jq to render — brew install jq");
    }
  } else if (st.foreign) {
    log.info("Status line: custom (not managed by gor-mobile)");
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
    const result = await execa("bash", [path], {
      reject: false,
      input: JSON.stringify({
        cwd: process.cwd(),
        session_id: "gor-mobile-doctor",
        prompt: "gor-mobile doctor"
      }),
      env: { ...process.env, GORM_FORCE_MOBILE: "1" }
    });
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

async function checkAndroidContract(): Promise<void> {
  const smoke = await smokeTestContract();
  if (smoke.version === null) {
    log.warn("android CLI version unreadable — run 'gor-mobile repair'");
    return;
  }
  if (smoke.missing.length > 0) {
    log.err(`android CLI missing contract commands: ${smoke.missing.join(", ")} — update gor-mobile`);
  } else if (smoke.belowFloor) {
    log.warn(`android CLI v${smoke.version} is below floor — run 'gor-mobile init' to upgrade`);
  } else {
    log.ok(`android CLI contract OK (v${smoke.version}, ${ANDROID_CONTRACT.length} commands)`);
  }
}

function verboseContractLint(): void {
  const skill = join(CLAUDE_SKILLS_DIR, "gor-mobile-using-android-cli", "SKILL.md");
  if (!existsSync(skill)) {
    log.warn("bridge skill missing — cannot lint contract");
    return;
  }
  const text = readFileSync(skill, "utf8");
  const mentioned = new Set<string>();
  const re = /`android ([a-z-]+(?: [a-z-]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) mentioned.add(m[1]!);
  const known = new Set(ANDROID_CONTRACT.map((c) => c.command.join(" ")));
  const knownTopLevel = new Set(ANDROID_CONTRACT.map((c) => c.command[0]!));
  const stray = [...mentioned].filter((cmd) => !known.has(cmd) && !knownTopLevel.has(cmd.split(" ")[0]!));
  if (stray.length === 0) log.ok(`bridge skill ↔ contract in sync (${mentioned.size} cmds referenced)`);
  else log.warn(`bridge skill references commands NOT in contract: ${stray.join(", ")}`);
}

export async function cmdDoctor(opts: DoctorOptions = {}): Promise<void> {
  log.step("Environment");
  reportDep("brew", which("brew"), false);
  reportDep("git", which("git"), true);
  reportDep("curl", which("curl"), true);
  reportDep("node", which("node"), true);
  reportDep("android", androidCliPath(), true);
  if (!androidCliPath()) {
    log.info("  → run 'gor-mobile init' to install android CLI (hard-mandatory after v0.1.0)");
  } else {
    await checkAndroidContract();
  }
  reportDep("ast-index", astIndexPath(), false);
  if (!astIndexPath()) {
    log.info(
      "  → install: brew tap defendend/ast-index && brew install ast-index"
    );
  }

  log.step("Claude Code integration");
  checkFile(CLAUDE_SETTINGS, "settings.json");
  checkHooks();
  checkFile(
    join(GOR_MOBILE_HOME, "templates", "detect-mobile-context.sh"),
    "mobile-context detector"
  );
  checkFile(CLAUDE_AGENTS_DIR, "agents/");
  if (androidCliSkillInstalled()) {
    log.ok("android-cli skill installed in ~/.claude/skills/");
  } else if (androidCliPath()) {
    log.warn("android-cli skill missing — run 'gor-mobile repair'");
  }
  const bridgePath = join(CLAUDE_SKILLS_DIR, "gor-mobile-using-android-cli", "SKILL.md");
  if (existsSync(bridgePath)) {
    log.ok("gor-mobile-using-android-cli bridge skill installed");
  } else if (androidCliPath()) {
    log.warn("gor-mobile-using-android-cli skill missing — run 'gor-mobile repair'");
  }
  const astIndexSkillPath = join(CLAUDE_SKILLS_DIR, "gor-mobile-ast-index", "SKILL.md");
  if (existsSync(astIndexSkillPath)) {
    log.ok("gor-mobile-ast-index skill installed");
  } else {
    log.warn("gor-mobile-ast-index skill missing — run 'gor-mobile repair'");
  }
  checkClaudeMdSection();
  checkStatusLine();

  log.step("Rules pack");
  checkRulesPack();

  log.step("Config");
  checkFile(GOR_MOBILE_CONFIG, "config.json");

  if (opts.verbose) {
    log.step("Hooks emulation (verbose)");
    await verboseHookEmulation();
    log.step("Skills frontmatter (verbose)");
    verboseSkillsFrontmatter();
    verboseContractLint();
  }

  console.error("");
  log.info("If anything is missing, run: gor-mobile repair");
  if (!opts.verbose) {
    log.info("Run 'gor-mobile doctor --verbose' for hook-payload dump.");
  }
}
