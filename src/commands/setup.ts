import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import pc from "picocolors";
import { cancel, isCancel } from "@clack/prompts";
import {
  DEFAULT_RULES_REF,
  DEFAULT_RULES_URL,
  GOR_MOBILE_RULES_DIR,
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
import { copyHookTemplates, installAgents, installSkills } from "../helpers/install-assets.js";
import { legacyClaudeFootprint } from "../helpers/legacy.js";
import {
  cloneOrPull,
  fallbackToBundled,
  readManifest,
  saveConfig
} from "../helpers/rules-pack.js";
import {
  installAstIndexGuardHook,
  installSessionStartHook,
  installUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { installStatusLine, statusLineState } from "../helpers/settings-statusline.js";
import {
  codexStatusLineState,
  installCodexStatusLine
} from "../helpers/codex-statusline.js";
import { TARGETS, agentHomeExists, parseTargetFlag, type TargetSpec } from "../targets.js";
import { renderBanner } from "../ui/banner.js";
import { confirmStep, textPrompt } from "../ui/confirm-step.js";
import { log } from "../ui/log.js";
import { note } from "../ui/note.js";
import { progressItem } from "../ui/progress.js";
import { sectionHeader } from "../ui/section-header.js";
import { statusLineSelect } from "../ui/statusline-select.js";
import { forceNoTui, isTuiOn } from "../ui/tui-mode.js";

export interface SetupOptions {
  dryRun?: boolean;
  yes?: boolean;
  noTui?: boolean;
  tui?: boolean;
  advanced?: boolean;
  rules?: string;
  skipAndroidUpdate?: boolean;
  /** comma-separated; only `codex` is a valid user-level agent target now. */
  target?: string;
}

interface SetupCtx {
  opts: SetupOptions;
  rulesUrl: string;
  rulesVersion: string;
  installCodex: boolean;
}

function dryLog(msg: string): void {
  console.log(`    ${pc.dim("[dry-run]")} ${msg}`);
}

/** Codex is the only agent installed at user level. Claude goes per-project. */
function shouldInstallCodex(target?: string): boolean {
  if (target) return parseTargetFlag(target).includes("codex");
  return agentHomeExists("codex");
}

function warnLegacy(): void {
  const findings = legacyClaudeFootprint();
  if (findings.length === 0) return;
  const body = [
    "A legacy v0.2.x global install was found in ~/.claude:",
    ...findings.map((f) => `  · ${f.label} → ${f.path}`),
    "",
    "Since v0.3.0 the Claude workflow installs per-project. Remove the old",
    "global footprint first:",
    "  gor-mobile migrate",
    "then re-run 'gor-mobile setup'."
  ].join("\n");
  note(body, "Legacy install detected");
}

async function stepDeps(): Promise<void> {
  sectionHeader(1, 5, "Base dependencies");
  const required: Array<[string, string | null]> = [
    ["git", which("git")],
    ["curl", which("curl")],
    ["node", which("node")]
  ];
  const missing: string[] = [];
  let i = 0;
  for (const [name, path] of required) {
    i++;
    if (path) progressItem(i, required.length, name, "ok", path);
    else {
      progressItem(i, required.length, name, "fail", "not found");
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Install missing deps first: ${missing.join(", ")}`);
  }
  if (!which("jq")) {
    log.warn("jq not found — status line and the ast-index guard hook need it (brew install jq)");
  }
}

async function stepAndroidBinary(ctx: SetupCtx): Promise<void> {
  sectionHeader(2, 5, "Google Android CLI");
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
    throw new Error(`platform ${process.platform}/${process.arch} unsupported by Google Android CLI`);
  }

  const displayCmd =
    process.platform === "win32"
      ? `curl -fsSL ${ANDROID_CLI_INSTALL_URL} -o "%TEMP%\\gm-android-i.cmd" && "%TEMP%\\gm-android-i.cmd"`
      : process.platform === "darwin"
        ? "brew tap android/tap && brew install android-cli"
        : `curl -fsSL ${ANDROID_CLI_INSTALL_URL} | bash`;

  note(
    [
      "The Google Android CLI is required by gor-mobile and is not yet installed.",
      "",
      "Install command (from Google):",
      `  ${displayCmd}`,
      "",
      "This installs a ~5 MB launcher into ~/.local/bin/android (user-local, no sudo)."
    ].join("\n"),
    "Android CLI required"
  );

  if (ctx.opts.dryRun) {
    progressItem(1, 1, "android CLI", "skip", `dry-run: ${displayCmd}`);
    return;
  }

  const install = ctx.opts.yes
    ? true
    : await confirmStep("Install the Android CLI now? (required to continue)", true);
  if (!install) {
    progressItem(1, 1, "android CLI", "fail", "declined");
    throw new Error("user declined Android CLI install — gor-mobile cannot continue");
  }

  let res = process.platform === "darwin" && which("brew") !== null
    ? await installAndroidCliViaBrew()
    : { installed: false as const, error: undefined };
  if (!res.installed) res = await installAndroidCli();
  if (!res.installed) {
    progressItem(1, 1, "android CLI", "fail", res.error ?? "install failed");
    throw new Error(`Android CLI install failed: ${res.error ?? "unknown error"}`);
  }
  progressItem(1, 1, "android CLI", "ok", androidCliPath() ?? "installed");
  await ensureAndroidCliCurrent({ skip: ctx.opts.skipAndroidUpdate, dryRun: ctx.opts.dryRun });
}

function stepAstIndex(ctx: SetupCtx): void {
  sectionHeader(3, 5, "ast-index CLI (code search)");
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
  note(
    [
      "ast-index powers fast structural code search. gor-mobile installs the",
      "skill (gor-mobile-ast-index) regardless, but search only works with the CLI.",
      "",
      "Install (Homebrew):",
      `  ${AST_INDEX_INSTALL_SNIPPET}`,
      "",
      `Other install options: ${AST_INDEX_REPO_URL}`
    ].join("\n"),
    "ast-index recommended"
  );
}

async function stepRules(ctx: SetupCtx): Promise<void> {
  sectionHeader(4, 5, "Rules pack + shared hook scripts");

  if (ctx.opts.advanced && !ctx.opts.rules) {
    ctx.rulesUrl = await textPrompt("Rules pack URL", ctx.rulesUrl, (v) => {
      if (!v.trim()) return "URL cannot be empty";
      if (!/^https?:\/\/|^git@|^\//.test(v.trim())) return "Expected http(s)://, git@, or absolute path";
      return undefined;
    });
  }

  if (ctx.opts.dryRun) {
    progressItem(1, 3, "fetch rules pack", "skip", `dry-run: ${ctx.rulesUrl}`);
    progressItem(2, 3, "save config", "skip", "dry-run");
    progressItem(3, 3, "hook scripts → ~/.gor-mobile/templates", "skip", "dry-run");
    return;
  }

  const alreadyCloned = existsSync(join(GOR_MOBILE_RULES_DIR, ".git"));
  if (alreadyCloned) {
    await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], { reject: false });
    ctx.rulesVersion = readManifest()?.version ?? "?";
    progressItem(1, 3, "pull existing pack", "ok", `v${ctx.rulesVersion} @ ${GOR_MOBILE_RULES_DIR}`);
  } else {
    try {
      await cloneOrPull(ctx.rulesUrl, DEFAULT_RULES_REF);
      ctx.rulesVersion = readManifest()?.version ?? "?";
      progressItem(1, 3, "clone rules pack", "ok", `v${ctx.rulesVersion} from ${ctx.rulesUrl}`);
    } catch (err) {
      log.warn(`git clone failed: ${(err as Error).message}`);
      fallbackToBundled(join(gorMobileRoot(), "rules-default"));
      ctx.rulesVersion = readManifest()?.version ?? "bundled";
      progressItem(1, 3, "clone rules pack", "warn", `fallback to bundled v${ctx.rulesVersion}`);
    }
  }
  saveConfig(ctx.rulesUrl, DEFAULT_RULES_REF);
  progressItem(2, 3, "save config", "ok", GOR_MOBILE_RULES_DIR);

  copyHookTemplates();
  progressItem(3, 3, "hook scripts", "ok", "~/.gor-mobile/templates");
}

async function stepClaudeStatusLine(ctx: SetupCtx): Promise<void> {
  if (ctx.opts.dryRun || ctx.opts.yes || !isTuiOn()) return;
  const choice = await statusLineSelect(false);
  if (choice === "skip") return;
  const st = statusLineState();
  let force = false;
  if (st.foreign) {
    force = await confirmStep("A non-gor-mobile statusLine already exists in ~/.claude. Replace it?", false);
    if (!force) {
      log.info("Kept your existing statusLine");
      return;
    }
  }
  installStatusLine(choice, { force });
  log.ok(`Claude status line installed (${choice === "cat" ? "Cat" : "Classic"})`);
}

// Full user-level install for Codex — hooks, skills, agents, AGENTS.md section,
// stock android-cli skill, status line. This layout is unchanged from < v0.3.0
// because Codex has no project-scoped config to migrate into.
async function stepCodex(ctx: SetupCtx): Promise<void> {
  if (!ctx.installCodex) return;
  const target = TARGETS.codex;
  sectionHeader(5, 5, "Codex integration (user-level)");

  if (ctx.opts.dryRun) {
    dryLog(`merge SessionStart + UserPromptSubmit + PreToolUse → ${target.hooksFile}`);
    dryLog(`install skills → ${target.skillsDir}`);
    dryLog(`install agents (${target.agentFormat}) → ${target.agentsDir}`);
    dryLog(`write managed section → ${target.instructionsFile}`);
    dryLog("android init (stock android-cli skill)");
    dryLog("status line: tui.status_line in config.toml");
    return;
  }

  installSessionStartHook(target);
  installUserPromptSubmitHook(target);
  installAstIndexGuardHook(target);
  log.ok(`Hooks merged → ${target.hooksFile}`);

  const skills = installSkills(target);
  log.ok(`${skills.installed.length} gor-mobile-* skills → ${target.skillsDir}`);
  const agents = installAgents(target);
  log.ok(`${agents.length} review agents → ${target.agentsDir}`);

  writeManagedSection(target.instructionsFile, join(gorMobileRoot(), "templates", target.instructionsSnippet));
  log.ok(`Managed section → ${target.instructionsFile}`);

  const androidRes = await runAndroidInit(target);
  if (androidRes.ran && androidRes.skillInstalled) {
    log.ok(`android-cli skill → ${target.skillsDir}/android-cli/`);
  } else if (!androidRes.ran) {
    log.warn("android CLI not on PATH — skipped android init");
  }

  if (!ctx.opts.yes && isTuiOn()) {
    const st = codexStatusLineState();
    if (st.foreign) {
      if (await confirmStep("~/.codex/config.toml already has a status_line. Replace it?", false)) {
        installCodexStatusLine({ force: true });
        log.ok("Codex status line replaced");
      }
    } else if (await confirmStep("Install the recommended Codex status line?", true)) {
      installCodexStatusLine();
      log.ok("Codex status line installed");
    }
  }
}

function templateSkillCount(): number {
  const src = join(gorMobileRoot(), "templates", "skills");
  return existsSync(src) ? readdirSync(src).filter((n) => !n.startsWith(".")).length : 0;
}

export async function cmdSetup(opts: SetupOptions = {}): Promise<void> {
  if (opts.noTui || opts.tui === false) forceNoTui();

  renderBanner();
  console.log(pc.bold("  Machine setup — one time per machine:"));
  for (const b of [
    "Verify base deps (git, curl, node, jq).",
    "Install + update the Google Android CLI (hard requirement).",
    "Soft-check the ast-index CLI.",
    "Clone the rules pack + hook scripts into ~/.gor-mobile/.",
    "Optionally install a Claude status line.",
    "Install the Codex workflow (user-level) if Codex is present."
  ]) {
    console.log(`    ${pc.dim("•")} ${b}`);
  }
  console.log("");
  console.log(pc.dim("  Per-repo: run 'gor-mobile init' inside each mobile project.\n"));

  if (opts.dryRun) log.info("DRY RUN — no changes will be made");
  warnLegacy();

  const ctx: SetupCtx = {
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    rulesVersion: "?",
    installCodex: shouldInstallCodex(opts.target)
  };

  try {
    await stepDeps();
    await stepAndroidBinary(ctx);
    stepAstIndex(ctx);
    await stepRules(ctx);
    await stepClaudeStatusLine(ctx);
    await stepCodex(ctx);
  } catch (err) {
    if (isCancel(err as unknown)) {
      cancel("Cancelled");
      process.exit(130);
    }
    log.err(`setup failed: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log("");
  log.ok(`Machine ready — rules v${ctx.rulesVersion}, ${templateSkillCount()} skills available per project.`);
  log.info("Next: cd into a mobile repo and run 'gor-mobile init'.");
}
