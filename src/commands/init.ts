import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import pc from "picocolors";
import { cancel, isCancel } from "@clack/prompts";
import {
  DEFAULT_RULES_REF,
  DEFAULT_RULES_URL,
  GOR_MOBILE_RULES_DIR,
  GOR_MOBILE_VERSION,
  gorMobileRoot
} from "../constants.js";
import {
  ANDROID_CLI_INSTALL_URL,
  androidCliInstallSupported,
  ensureAndroidCliCurrent,
  installAndroidCli,
  installAndroidCliViaBrew,
  runAndroidInit
} from "../helpers/android-cli.js";
import { writeManagedSection } from "../helpers/claude-md-section.js";
import { androidCliPath, which } from "../helpers/deps.js";
import {
  AST_INDEX_INSTALL_SNIPPET,
  AST_INDEX_REPO_URL,
  astIndexPath
} from "../helpers/ast-index.js";
import {
  cleanupLegacyAgents,
  cleanupLegacyCommands,
  copyHookTemplates,
  installAgents,
  installSkills
} from "../helpers/install-assets.js";
import {
  cloneOrPull,
  fallbackToBundled,
  readManifest,
  saveConfig
} from "../helpers/rules-pack.js";
import {
  countManagedHooks,
  installAstIndexGuardHook,
  installSessionStartHook,
  installUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import type { TargetId, TargetSpec } from "../targets.js";
import { resolveTargets } from "../ui/target-select.js";
import { renderBanner } from "../ui/banner.js";
import { confirmStep, textPrompt } from "../ui/confirm-step.js";
import { modeSelect, type WizardMode } from "../ui/mode-select.js";
import { note } from "../ui/note.js";
import { finalOutro } from "../ui/outro.js";
import { progressItem } from "../ui/progress.js";
import { sectionHeader } from "../ui/section-header.js";
import { forceNoTui, isTuiOn } from "../ui/tui-mode.js";
import { welcome } from "../ui/welcome.js";
import { CLAUDE_COMMANDS_DIR, CODEX_CONFIG_TOML } from "../constants.js";
import { log } from "../ui/log.js";
import { statusLineSelect, showStatusLinePreviews } from "../ui/statusline-select.js";
import { installStatusLine, statusLineState } from "../helpers/settings-statusline.js";
import {
  CODEX_STATUS_LINE_ITEMS,
  codexStatusLineState,
  installCodexStatusLine
} from "../helpers/codex-statusline.js";

export interface InitOptions {
  dryRun?: boolean;
  yes?: boolean;
  skipSanity?: boolean;
  noTui?: boolean;
  tui?: boolean;
  advanced?: boolean;
  rules?: string;
  skipAndroidUpdate?: boolean;
  target?: string;
}

interface TargetCounts {
  skills: number;
  agents: number;
  hooks: number;
}

interface RunCtx {
  mode: WizardMode;
  opts: InitOptions;
  rulesUrl: string;
  rulesVersion: string;
  targets: TargetSpec[];
  perTarget: Map<TargetId, TargetCounts>;
  androidInitRan: boolean;
}

// Global steps (deps, android binary, ast-index, rules) run once, then one
// integration section per target, then the summary.
const GLOBAL_STEPS = 4;

function dryLog(msg: string): void {
  console.log(`    ${pc.dim("[dry-run]")} ${msg}`);
}

function totalSteps(ctx: RunCtx): number {
  return GLOBAL_STEPS + ctx.targets.length + 1;
}

function runStep(ctx: RunCtx, stepNum: number, title: string): void {
  sectionHeader(stepNum, totalSteps(ctx), title);
}

async function step1Deps(ctx: RunCtx): Promise<void> {
  runStep(ctx, 1, "Base dependencies");
  const required: Array<[string, string | null]> = [
    ["git", which("git")],
    ["curl", which("curl")],
    ["node", which("node")]
  ];
  const missing: string[] = [];
  let i = 0;
  for (const [name, path] of required) {
    i++;
    if (path) {
      progressItem(i, required.length, name, "ok", path);
    } else {
      progressItem(i, required.length, name, "fail", "not found");
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Install missing deps first: ${missing.join(", ")}`);
  }
}

// Global: ensure the android binary is on PATH (hard-mandatory). The per-target
// `android init --agent=<flag>` that drops the stock skill runs later, inside
// each integration section.
async function step2AndroidBinary(ctx: RunCtx): Promise<void> {
  runStep(ctx, 2, "Google Android CLI");

  const existing = androidCliPath();
  if (existing) {
    progressItem(1, 1, "android CLI", "ok", existing);
    if (!ctx.opts.dryRun) {
      await ensureAndroidCliCurrent({
        skip: ctx.opts.skipAndroidUpdate,
        dryRun: ctx.opts.dryRun
      });
    }
    return;
  }

  if (!androidCliInstallSupported()) {
    progressItem(1, 1, "android CLI", "fail", `unsupported platform ${process.platform}/${process.arch}`);
    const body = [
      `gor-mobile requires the Google Android CLI, and Google does not`,
      `ship an installer for ${process.platform}/${process.arch}.`,
      "",
      "Supported platforms: darwin/arm64, darwin/x64, linux/x64, win32/x64.",
      "",
      "See https://developer.android.com/tools/agents — if Google later",
      "publishes an installer for your platform, re-run 'gor-mobile init'."
    ].join("\n");
    note(body, "Android CLI required");
    throw new Error(`platform ${process.platform}/${process.arch} unsupported by Google Android CLI`);
  }

  const displayCmd =
    process.platform === "win32"
      ? `curl -fsSL ${ANDROID_CLI_INSTALL_URL} -o "%TEMP%\\gm-android-i.cmd" && "%TEMP%\\gm-android-i.cmd"`
      : process.platform === "darwin"
        ? "brew tap android/tap && brew install android-cli"
        : `curl -fsSL ${ANDROID_CLI_INSTALL_URL} | bash`;

  const body = [
    "The Google Android CLI is required by gor-mobile and is not yet",
    "installed on this machine.",
    "",
    "What it is:",
    "  An official Google CLI that lets AI agents drive the Android",
    "  toolchain (build, install, run, SDK) without shelling out to",
    "  adb/gradle directly. It also ships a skill (via `android init`)",
    "  into each agent's skills folder.",
    "",
    "Learn more: https://developer.android.com/tools/agents",
    "",
    "Install command (from Google):",
    `  ${displayCmd}`,
    "",
    "This installs a ~5 MB launcher into ~/.local/bin/android",
    "(user-local, no sudo). The launcher fetches the full CLI on",
    "first run."
  ].join("\n");
  note(body, "Android CLI required");

  if (ctx.opts.dryRun) {
    progressItem(1, 1, "android CLI", "skip", `dry-run: ${displayCmd}`);
    return;
  }

  const install = ctx.opts.yes
    ? true
    : await confirmStep("Install the Android CLI now? (required to continue)", true);
  if (!install) {
    progressItem(1, 1, "android CLI", "fail", "declined — gor-mobile requires the Android CLI");
    throw new Error("user declined Android CLI install — gor-mobile cannot continue");
  }

  let res = process.platform === "darwin" && which("brew") !== null
    ? await installAndroidCliViaBrew()
    : { installed: false as const, error: undefined };
  if (!res.installed) {
    res = await installAndroidCli();
  }
  if (!res.installed) {
    progressItem(1, 1, "android CLI", "fail", res.error ?? "install failed");
    throw new Error(`Android CLI install failed: ${res.error ?? "unknown error"}`);
  }
  progressItem(1, 1, "android CLI", "ok", androidCliPath() ?? "installed");
  await ensureAndroidCliCurrent({
    skip: ctx.opts.skipAndroidUpdate,
    dryRun: ctx.opts.dryRun
  });
}

async function step3AstIndex(ctx: RunCtx): Promise<void> {
  runStep(ctx, 3, "ast-index CLI (code search)");

  if (ctx.opts.dryRun) {
    progressItem(1, 1, "ast-index CLI", "skip", "dry-run: which ast-index");
    return;
  }

  const path = astIndexPath();
  if (path) {
    progressItem(1, 1, "ast-index CLI", "ok", path);
    return;
  }

  progressItem(1, 1, "ast-index CLI", "warn", "not found");
  const body = [
    "ast-index is recommended for fast structural code search in",
    "Android/Kotlin/Java projects. gor-mobile installs the skill",
    "(gor-mobile-ast-index) regardless — but search commands will",
    "only work once the CLI is installed.",
    "",
    "Install (Homebrew):",
    `  ${AST_INDEX_INSTALL_SNIPPET}`,
    "",
    `Other install options: ${AST_INDEX_REPO_URL}`,
    "",
    "Re-run 'gor-mobile doctor' after install to verify."
  ].join("\n");
  note(body, "ast-index recommended");
}

async function step4Rules(ctx: RunCtx): Promise<void> {
  runStep(ctx, 4, "Rules pack");

  if (ctx.mode === "advanced" && !ctx.opts.rules) {
    ctx.rulesUrl = await textPrompt(
      "Rules pack URL",
      ctx.rulesUrl,
      (v) => {
        if (!v.trim()) return "URL cannot be empty";
        if (!/^https?:\/\/|^git@|^\//.test(v.trim())) return "Expected http(s)://, git@, or absolute path";
        return undefined;
      }
    );
  }

  if (ctx.opts.dryRun) {
    progressItem(1, 2, "fetch rules pack", "skip", `dry-run: ${ctx.rulesUrl}`);
    progressItem(2, 2, "save config", "skip", "dry-run");
    return;
  }

  const alreadyCloned = existsSync(join(GOR_MOBILE_RULES_DIR, ".git"));
  if (alreadyCloned) {
    await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], { reject: false });
    const m = readManifest();
    ctx.rulesVersion = m?.version ?? "?";
    progressItem(1, 2, "pull existing pack", "ok", `v${ctx.rulesVersion} @ ${GOR_MOBILE_RULES_DIR}`);
  } else {
    try {
      await cloneOrPull(ctx.rulesUrl, DEFAULT_RULES_REF);
      const m = readManifest();
      ctx.rulesVersion = m?.version ?? "?";
      progressItem(1, 2, "clone rules pack", "ok", `v${ctx.rulesVersion} from ${ctx.rulesUrl}`);
    } catch (err) {
      log.warn(`git clone failed: ${(err as Error).message}`);
      fallbackToBundled(join(gorMobileRoot(), "rules-default"));
      const m = readManifest();
      ctx.rulesVersion = m?.version ?? "bundled";
      progressItem(1, 2, "clone rules pack", "warn", `fallback to bundled v${ctx.rulesVersion}`);
    }
  }

  saveConfig(ctx.rulesUrl, DEFAULT_RULES_REF);
  progressItem(2, 2, "save config", "ok", GOR_MOBILE_RULES_DIR);
}

function templateSkillCount(): number {
  const src = join(gorMobileRoot(), "templates", "skills");
  return existsSync(src) ? readdirSync(src).filter((n) => !n.startsWith(".")).length : 0;
}

function templateAgentCount(target: TargetSpec): number {
  const sub = target.agentFormat === "toml" ? "agents-codex" : "agents";
  const src = join(gorMobileRoot(), "templates", sub);
  return existsSync(src)
    ? readdirSync(src).filter((f) => f.endsWith(`.${target.agentFormat}`)).length
    : 0;
}

async function statusLineFor(ctx: RunCtx, idx: number, total: number): Promise<void> {
  const choice = await statusLineSelect(Boolean(ctx.opts.yes));
  if (choice === "skip") {
    progressItem(idx, total, "status line", "skip", "not installed");
    return;
  }
  if (!which("jq")) {
    log.warn("jq not found — the status line needs jq to render (brew install jq); installing anyway");
  }
  const st = statusLineState();
  let force = false;
  if (st.foreign) {
    force = await confirmStep("A non-gor-mobile statusLine already exists. Replace it?", false);
    if (!force) {
      progressItem(idx, total, "status line", "skip", "kept your existing statusLine");
      return;
    }
  }
  installStatusLine(choice, { force });
  const label = choice === "cat" ? "Cat" : "Classic";
  progressItem(idx, total, "status line", "ok", label);
}

async function codexStatusLineFor(ctx: RunCtx, idx: number, total: number): Promise<void> {
  // Mirror Claude's status-line UX: offered interactively, skipped under
  // --yes / non-TTY so a non-interactive run never imposes a footer.
  if (ctx.opts.yes || !isTuiOn()) {
    progressItem(idx, total, "status line", "skip", "non-interactive");
    return;
  }
  const st = codexStatusLineState();
  if (st.foreign) {
    const replace = await confirmStep(
      "~/.codex/config.toml already has a status_line. Replace it with the gor-mobile default?",
      false
    );
    if (!replace) {
      progressItem(idx, total, "status line", "skip", "kept your existing status_line");
      return;
    }
    installCodexStatusLine({ force: true });
    progressItem(idx, total, "status line", "ok", "replaced in config.toml");
    return;
  }
  const install = await confirmStep(
    "Install the recommended Codex status line (model · context · usage limits · task)?",
    true
  );
  if (!install) {
    progressItem(idx, total, "status line", "skip", "not installed");
    return;
  }
  installCodexStatusLine();
  progressItem(idx, total, "status line", "ok", CODEX_CONFIG_TOML);
}

const MANAGED_HOOK_TYPES = ["SessionStart", "UserPromptSubmit", "PreToolUse"] as const;

async function targetSection(ctx: RunCtx, target: TargetSpec, stepNum: number): Promise<void> {
  runStep(ctx, stepNum, `${target.label} integration`);
  const counts: TargetCounts = { skills: 0, agents: 0, hooks: 0 };
  ctx.perTarget.set(target.id, counts);
  const steps = target.supportsStatusLine ? 6 : 5;

  if (ctx.opts.dryRun) {
    dryLog(`merge SessionStart + UserPromptSubmit → ${target.hooksFile}`);
    dryLog(`merge PreToolUse (ast-index guard) → ${target.hooksFile}`);
    dryLog(`install ${templateSkillCount()} skills → ${target.skillsDir}`);
    dryLog(`install agents (${target.agentFormat}) → ${target.agentsDir}`);
    dryLog(`write managed section → ${target.instructionsFile}`);
    dryLog("android init (stock android-cli skill for detected agents)");
    if (target.statusLineKind === "claude-command") {
      showStatusLinePreviews();
      dryLog("status line: choose Classic / Cat / Skip");
    } else if (target.statusLineKind === "codex-config") {
      dryLog(`status line: tui.status_line = [${CODEX_STATUS_LINE_ITEMS.join(", ")}]`);
    }
    counts.hooks = MANAGED_HOOK_TYPES.length;
    counts.skills = templateSkillCount();
    counts.agents = templateAgentCount(target);
    return;
  }

  installSessionStartHook(target);
  installUserPromptSubmitHook(target);
  installAstIndexGuardHook(target);
  counts.hooks = MANAGED_HOOK_TYPES.reduce((n, h) => n + countManagedHooks(h, target), 0);
  progressItem(1, steps, "hooks (SessionStart + UserPromptSubmit + guard)", "ok", target.hooksFile);

  if (target.id === "claude") cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  const skillsRes = installSkills(target);
  counts.skills = skillsRes.installed.length;
  if (skillsRes.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite issues in ${skillsRes.missingPrefix.length} skill(s)`);
  }
  progressItem(
    2,
    steps,
    `${counts.skills} gor-mobile-* skills`,
    skillsRes.missingPrefix.length > 0 ? "warn" : "ok",
    target.skillsDir
  );

  if (target.id === "claude") cleanupLegacyAgents();
  const agents = installAgents(target);
  counts.agents = agents.length;
  progressItem(3, steps, `${counts.agents} review agents (${target.agentFormat})`, "ok", target.agentsDir);

  writeManagedSection(target.instructionsFile, join(gorMobileRoot(), "templates", target.instructionsSnippet));
  progressItem(4, steps, "managed instructions section", "ok", target.instructionsFile);

  const androidRes = await runAndroidInit(target);
  if (androidRes.ran && androidRes.skillInstalled) {
    ctx.androidInitRan = true;
    progressItem(5, steps, "android init (android-cli skill)", "ok", `${target.skillsDir}/android-cli/`);
  } else if (!androidRes.ran) {
    progressItem(5, steps, "android init", "warn", "android CLI not on PATH");
  } else {
    ctx.androidInitRan = androidRes.ran;
    progressItem(5, steps, "android init", "warn", androidRes.error ?? "stock android-cli skill not placed here");
  }

  if (target.statusLineKind === "claude-command") {
    await statusLineFor(ctx, 6, steps);
  } else if (target.statusLineKind === "codex-config") {
    await codexStatusLineFor(ctx, 6, steps);
  }
}

async function stepSummary(ctx: RunCtx, stepNum: number): Promise<void> {
  runStep(ctx, stepNum, "Summary");
  if (ctx.opts.skipSanity) {
    log.info("Skipped (--skip-sanity)");
    return;
  }
  for (const target of ctx.targets) {
    const c = ctx.perTarget.get(target.id) ?? { skills: 0, agents: 0, hooks: 0 };
    log.info(
      `${target.label}: ${c.skills} skills · ${c.agents} agents · ${c.hooks} hooks → ${target.home}`
    );
  }
  log.info(`Rules pack: v${ctx.rulesVersion}`);
}

export async function cmdInit(opts: InitOptions = {}): Promise<void> {
  if (opts.noTui || opts.tui === false) forceNoTui();

  await welcome(Boolean(opts.yes));

  const mode: WizardMode = opts.advanced
    ? "advanced"
    : opts.yes
    ? "quickstart"
    : await modeSelect({ yes: Boolean(opts.yes), advanced: Boolean(opts.advanced) });

  if (opts.dryRun) {
    log.info("DRY RUN — no changes will be made");
  }

  let targets: TargetSpec[];
  try {
    targets = await resolveTargets(opts);
  } catch (err) {
    log.err(`init failed: ${(err as Error).message}`);
    process.exit(1);
  }

  const ctx: RunCtx = {
    mode,
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    rulesVersion: "?",
    targets,
    perTarget: new Map(),
    androidInitRan: false
  };

  try {
    await step1Deps(ctx);
    await step2AndroidBinary(ctx);
    await step3AstIndex(ctx);
    await step4Rules(ctx);

    if (!ctx.opts.dryRun) copyHookTemplates();

    let step = GLOBAL_STEPS;
    for (const target of ctx.targets) {
      step++;
      await targetSection(ctx, target, step);
    }

    await stepSummary(ctx, totalSteps(ctx));
  } catch (err) {
    if (isCancel(err as unknown)) {
      cancel("Cancelled");
      process.exit(130);
    }
    log.err(`init failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (ctx.androidInitRan) {
    log.info(
      "Browse Google's skill catalog — run 'gor-mobile android-skills' to install optional skills."
    );
  }

  const totals = [...ctx.perTarget.values()].reduce(
    (acc, c) => ({
      skills: acc.skills + c.skills,
      agents: acc.agents + c.agents,
      hooks: acc.hooks + c.hooks
    }),
    { skills: 0, agents: 0, hooks: 0 }
  );
  finalOutro({
    skills: totals.skills,
    agents: totals.agents,
    hooks: totals.hooks,
    rulesVersion: ctx.rulesVersion
  });

  void GOR_MOBILE_VERSION;
}
