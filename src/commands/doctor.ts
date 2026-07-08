import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import {
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_HOME,
  GOR_MOBILE_RULES_DIR,
  SECTION_BEGIN
} from "../constants.js";
import { androidCliSkillInstalled, smokeTestContract } from "../helpers/android-cli.js";
import { ANDROID_CONTRACT } from "../android-contract.js";
import { countManagedHooks } from "../helpers/settings-merge.js";
import { statusLineState } from "../helpers/settings-statusline.js";
import { codexStatusLineState } from "../helpers/codex-statusline.js";
import { androidCliPath, which } from "../helpers/deps.js";
import { astIndexPath } from "../helpers/ast-index.js";
import { readManifest } from "../helpers/rules-pack.js";
import {
  detectGorMobileTargets,
  detectInstalledTargets,
  parseTargetFlag,
  targetSpecs,
  type TargetSpec
} from "../targets.js";
import { log } from "../ui/log.js";

interface DoctorOptions {
  verbose?: boolean;
  target?: string;
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

function checkHooks(target: TargetSpec): void {
  if (!existsSync(target.hooksFile)) {
    log.warn(`No ${target.hooksFile}`);
    return;
  }
  for (const hookType of ["SessionStart", "UserPromptSubmit", "PreToolUse"] as const) {
    const n = countManagedHooks(hookType, target);
    if (n === 0) {
      log.warn(`${hookType} hook NOT registered — run 'gor-mobile repair'`);
    } else if (n > 1) {
      log.warn(`${hookType} has ${n} duplicate managed entries — run 'gor-mobile repair'`);
    } else {
      log.ok(`${hookType} hook registered`);
    }
  }
}

function checkInstructionsSection(target: TargetSpec): void {
  if (!existsSync(target.instructionsFile)) {
    log.warn(`${target.instructionsFile} does not exist`);
    return;
  }
  if (readFileSync(target.instructionsFile, "utf8").includes(SECTION_BEGIN)) {
    log.ok("managed instructions section present");
  } else {
    log.warn("managed instructions section missing — run 'gor-mobile repair'");
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

function checkCodexStatusLine(): void {
  const st = codexStatusLineState();
  if (st.managed) {
    log.ok("Status line: managed (tui.status_line in config.toml)");
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

async function verboseHookEmulation(target: TargetSpec): Promise<void> {
  const hooks: Array<[string, string]> = [
    ["session-start-hook.sh", "SessionStart"],
    ["user-prompt-submit-hook.sh", "UserPromptSubmit"],
    ["ast-index-guard-hook.sh", "PreToolUse"]
  ];
  for (const [file, label] of hooks) {
    const path = `${GOR_MOBILE_HOME}/templates/${file}`;
    if (!existsSync(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    // The guard is a deny-gate, not a context injector: silent exit 0 on a
    // benign probe is its success shape, so skip the additionalContext parse.
    const input =
      label === "PreToolUse"
        ? JSON.stringify({
            tool_name: "Grep",
            cwd: process.cwd(),
            tool_input: { pattern: "gor-mobile doctor probe" }
          })
        : JSON.stringify({
            cwd: process.cwd(),
            session_id: "gor-mobile-doctor",
            prompt: "gor-mobile doctor"
          });
    const result = await execa("bash", [path], {
      reject: false,
      input,
      env: {
        ...process.env,
        GORM_FORCE_MOBILE: "1",
        GORM_SKILLS_DIR: target.skillsDir
      }
    });
    if (result.exitCode !== 0) {
      log.warn(`[${label}] hook exited ${result.exitCode}:`);
      console.error(result.stdout || result.stderr);
      continue;
    }
    if (label === "PreToolUse") {
      log.ok(`[${label}] guard allows non-symbol probe (exit 0)`);
      // Deny path: an indexed repo + bare-identifier pattern must exit 2.
      // Exit 0 here means the guard is INERT — it would silently allow every
      // structural grep it exists to catch. Missing jq or a missing ast-index
      // binary both fail open by design; the warning names them so a correct
      // fail-open is not misread as a broken hook.
      const probeDir = mkdtempSync(join(tmpdir(), "gorm-guard-probe-"));
      try {
        mkdirSync(join(probeDir, ".claude", "rules"), { recursive: true });
        writeFileSync(join(probeDir, ".claude", "rules", "ast-index.md"), "");
        const deny = await execa("bash", [path], {
          reject: false,
          input: JSON.stringify({
            tool_name: "Grep",
            cwd: probeDir,
            tool_input: { pattern: "getFormatValue" }
          })
        });
        if (deny.exitCode === 2) {
          log.ok(`[${label}] guard denies structural probe (exit 2)`);
        } else {
          log.warn(
            `[${label}] guard is INERT — structural probe exited ${deny.exitCode}, expected 2 (jq or ast-index missing, or hook broken)`
          );
        }
      } finally {
        rmSync(probeDir, { recursive: true, force: true });
      }
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

function verboseSkillsFrontmatter(target: TargetSpec): void {
  if (!existsSync(target.skillsDir)) {
    log.warn(`${target.skillsDir} missing`);
    return;
  }
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync(target.skillsDir)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join(target.skillsDir, entry, "SKILL.md");
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
    log.warn(`android CLI v${smoke.version} is below floor — run 'gor-mobile repair' to upgrade`);
  } else {
    log.ok(`android CLI contract OK (v${smoke.version}, ${ANDROID_CONTRACT.length} commands)`);
  }
}

function verboseContractLint(target: TargetSpec): void {
  const skill = join(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
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

function doctorTargets(target?: string): TargetSpec[] {
  if (target) return targetSpecs(parseTargetFlag(target));
  const gm = detectGorMobileTargets();
  if (gm.length > 0) return targetSpecs(gm);
  const installed = detectInstalledTargets();
  return targetSpecs(installed.length > 0 ? installed : ["claude"]);
}

function checkTarget(target: TargetSpec): void {
  log.step(`${target.label} integration`);
  checkFile(target.hooksFile, target.hooksKind === "codex-hooks-json" ? "hooks.json" : "settings.json");
  checkHooks(target);
  checkFile(target.agentsDir, "agents/");
  if (androidCliSkillInstalled(target.skillsDir)) {
    log.ok(`android-cli skill installed in ${target.skillsDir}`);
  } else if (androidCliPath()) {
    log.warn("android-cli skill missing — run 'gor-mobile repair'");
  }
  const bridgePath = join(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (existsSync(bridgePath)) {
    log.ok("gor-mobile-using-android-cli bridge skill installed");
  } else if (androidCliPath()) {
    log.warn("gor-mobile-using-android-cli skill missing — run 'gor-mobile repair'");
  }
  const astIndexSkillPath = join(target.skillsDir, "gor-mobile-ast-index", "SKILL.md");
  if (existsSync(astIndexSkillPath)) {
    log.ok("gor-mobile-ast-index skill installed");
  } else {
    log.warn("gor-mobile-ast-index skill missing — run 'gor-mobile repair'");
  }
  checkInstructionsSection(target);
  if (target.statusLineKind === "claude-command") checkStatusLine();
  else if (target.statusLineKind === "codex-config") checkCodexStatusLine();
}

export async function cmdDoctor(opts: DoctorOptions = {}): Promise<void> {
  const targets = doctorTargets(opts.target);

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
  reportDep("jq", which("jq"), false);
  if (!which("jq")) {
    log.info(
      "  → jq powers the status line AND the ast-index guard hook (guard fails open without it) — brew install jq"
    );
  }
  checkFile(
    join(GOR_MOBILE_HOME, "templates", "detect-mobile-context.sh"),
    "mobile-context detector"
  );

  for (const target of targets) {
    checkTarget(target);
  }

  log.step("Rules pack");
  checkRulesPack();

  log.step("Config");
  checkFile(GOR_MOBILE_CONFIG, "config.json");

  if (opts.verbose) {
    for (const target of targets) {
      log.step(`Hooks emulation (verbose) — ${target.label}`);
      await verboseHookEmulation(target);
      log.step(`Skills frontmatter (verbose) — ${target.label}`);
      verboseSkillsFrontmatter(target);
      verboseContractLint(target);
    }
  }

  console.error("");
  log.info("If anything is missing, run: gor-mobile repair");
  if (!opts.verbose) {
    log.info("Run 'gor-mobile doctor --verbose' for hook-payload dump.");
  }
}
