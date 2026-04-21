import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import pc from "picocolors";
import { cancel, isCancel } from "@clack/prompts";
import {
  CLAUDE_AGENTS_DIR,
  CLAUDE_SETTINGS,
  CLAUDE_SKILLS_DIR,
  DEFAULT_RULES_REF,
  DEFAULT_RULES_URL,
  GOR_MOBILE_RULES_DIR,
  GOR_MOBILE_VERSION,
  gorMobileRoot
} from "../constants.js";
import { writeClaudeMdSection } from "../helpers/claude-md-section.js";
import { androidCliPath, has, which } from "../helpers/deps.js";
import {
  cleanupLegacyAgents,
  cleanupLegacyCommands,
  copyHookTemplates,
  installAgents,
  installSkills
} from "../helpers/install-assets.js";
import { registerGoogleDevKnowledge } from "../helpers/mcp-register.js";
import {
  cloneOrPull,
  fallbackToBundled,
  readManifest,
  saveConfig
} from "../helpers/rules-pack.js";
import {
  installSessionStartHook,
  installUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { renderBanner } from "../ui/banner.js";
import { confirmStep, textPrompt } from "../ui/confirm-step.js";
import { modeSelect, type WizardMode } from "../ui/mode-select.js";
import { note } from "../ui/note.js";
import { finalOutro } from "../ui/outro.js";
import { progressItem } from "../ui/progress.js";
import { sectionHeader } from "../ui/section-header.js";
import { spinner } from "../ui/spinner.js";
import { forceNoTui } from "../ui/tui-mode.js";
import { welcome } from "../ui/welcome.js";
import { CLAUDE_COMMANDS_DIR } from "../constants.js";
import { log } from "../ui/log.js";

export interface InitOptions {
  dryRun?: boolean;
  yes?: boolean;
  skipSanity?: boolean;
  noTui?: boolean;
  tui?: boolean;
  advanced?: boolean;
  rules?: string;
}

const TOTAL_STEPS = 9;

interface RunCtx {
  mode: WizardMode;
  opts: InitOptions;
  rulesUrl: string;
  counts: {
    skills: number;
    agents: number;
    hooks: number;
    mcp: number;
  };
  rulesVersion: string;
}

function dryLog(msg: string): void {
  console.log(`    ${pc.dim("[dry-run]")} ${msg}`);
}

async function maybeRunStep(ctx: RunCtx, stepNum: number, title: string): Promise<boolean> {
  sectionHeader(stepNum, TOTAL_STEPS, title);
  if (ctx.mode !== "advanced") return true;
  const go = await confirmStep(`Run step ${stepNum}?`, true);
  if (!go) {
    console.log(`    ${pc.yellow("skipped")}`);
  }
  return go;
}

async function step1Deps(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 1, "Base dependencies"))) return;
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

async function step2Android(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 2, "Google Android CLI"))) return;

  const existing = androidCliPath();
  if (existing) {
    progressItem(1, 1, "android CLI", "ok", existing);
    return;
  }

  const body = [
    "The Google Android CLI agent is not installed.",
    "",
    "What it is:",
    "  An official Google CLI that lets AI agents drive the Android",
    "  toolchain (build, install, run, SDK) without shelling out to",
    "  adb/gradle directly.",
    "",
    "Why gor-mobile needs it:",
    "  Slash-commands call through to this CLI; missing it forces a",
    "  degraded gradle fallback.",
    "",
    "Install page: https://developer.android.com/tools/agents"
  ].join("\n");
  note(body, "Android CLI missing");

  if (ctx.opts.yes) {
    log.warn("Skipping Android CLI install (--yes). Install manually and re-run 'gor-mobile init'.");
    return;
  }

  const open = await confirmStep("Open the install page in your browser now?", false);
  if (!open) {
    log.warn("Install manually, then re-run 'gor-mobile init'.");
    return;
  }

  const url = "https://developer.android.com/tools/agents";
  if (ctx.opts.dryRun) {
    dryLog(`open "${url}"`);
    return;
  }
  const opener = has("open") ? "open" : has("xdg-open") ? "xdg-open" : null;
  if (!opener) {
    log.info(`Couldn't auto-open a browser — visit ${url} manually.`);
    return;
  }
  await execa(opener, [url], { reject: false });
}

async function step3Rules(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 3, "Rules pack"))) return;

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

  const s = spinner();
  if (ctx.opts.dryRun) {
    dryLog(`clone/pull ${ctx.rulesUrl} → ${GOR_MOBILE_RULES_DIR}`);
  } else if (existsSync(join(GOR_MOBILE_RULES_DIR, ".git"))) {
    s.start("Rules pack already present — pulling latest");
    try {
      await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], { reject: false });
      s.stop(`Rules pack updated at ${GOR_MOBILE_RULES_DIR}`);
    } catch {
      s.stop("Rules pack up-to-date");
    }
  } else {
    s.start(`Cloning rules pack from ${ctx.rulesUrl}`);
    try {
      s.message("Resolving deltas…");
      await cloneOrPull(ctx.rulesUrl, DEFAULT_RULES_REF);
      const m = readManifest();
      s.stop(`Rules pack v${m?.version ?? "?"} cloned`);
      ctx.rulesVersion = m?.version ?? "?";
    } catch (err) {
      s.stop(`Clone failed — falling back to bundled rules`, 1);
      log.warn(`git clone failed: ${(err as Error).message}`);
      fallbackToBundled(join(gorMobileRoot(), "rules-default"));
      const m = readManifest();
      ctx.rulesVersion = m?.version ?? "bundled";
    }
  }

  if (!ctx.opts.dryRun) {
    saveConfig(ctx.rulesUrl, DEFAULT_RULES_REF);
  }
  const m = readManifest();
  if (m?.version) ctx.rulesVersion = m.version;
}

async function step4Hooks(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 4, "SessionStart + UserPromptSubmit hooks"))) return;

  if (ctx.opts.dryRun) {
    dryLog(`copy templates/{session-start,user-prompt-submit}-hook.sh → ~/.gor-mobile/templates/`);
    dryLog(`merge managed hooks into ${CLAUDE_SETTINGS}`);
    ctx.counts.hooks = 2;
    return;
  }

  const s = spinner();
  s.start("Merging hooks into settings.json");
  copyHookTemplates();
  s.message("Upserting SessionStart");
  installSessionStartHook();
  s.message("Upserting UserPromptSubmit");
  installUserPromptSubmitHook();
  s.stop("Hooks merged into settings.json");
  ctx.counts.hooks = 2;
}

async function step5Skills(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 5, "Skills → ~/.claude/skills/gor-mobile-*/"))) return;

  if (ctx.opts.dryRun) {
    const { readdirSync } = await import("node:fs");
    const src = join(gorMobileRoot(), "templates", "skills");
    const names = existsSync(src)
      ? readdirSync(src).filter((n) => !n.startsWith("."))
      : [];
    for (let i = 0; i < names.length; i++) {
      dryLog(`install skill ${names[i]} (sed + overlay)`);
    }
    ctx.counts.skills = names.length;
    return;
  }

  cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  const res = installSkills();
  const total = res.installed.length;
  for (let i = 0; i < total; i++) {
    const name = res.installed[i]!;
    const hasPrefixIssue = res.missingPrefix.some((p) => p.includes(`gor-mobile-${name}/`));
    progressItem(
      i + 1,
      total,
      `gor-mobile-${name}`,
      hasPrefixIssue ? "warn" : "ok"
    );
  }
  if (res.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite issues in ${res.missingPrefix.length} skill(s)`);
  }
  ctx.counts.skills = total;
}

async function step6Agents(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 6, "Agents → ~/.claude/agents/"))) return;

  if (ctx.opts.dryRun) {
    const { readdirSync } = await import("node:fs");
    const src = join(gorMobileRoot(), "templates", "agents");
    const files = existsSync(src)
      ? readdirSync(src).filter((f) => f.endsWith(".md"))
      : [];
    for (let i = 0; i < files.length; i++) {
      dryLog(`install agent ${files[i]}`);
    }
    ctx.counts.agents = files.length;
    return;
  }

  cleanupLegacyAgents();
  const files = installAgents();
  const total = files.length;
  for (let i = 0; i < total; i++) {
    const name = files[i]!;
    const label = name.replace(/\.md$/, "");
    const model = /reviewer/.test(label) && /deep/.test(label) ? "Opus" : "Sonnet";
    progressItem(i + 1, total, label, "ok", model);
  }
  ctx.counts.agents = total;
}

async function step7Mcp(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 7, "MCP registration"))) return;

  if (ctx.opts.dryRun) {
    dryLog(`register google-dev-knowledge in ~/.claude/mcp.json`);
    ctx.counts.mcp = 1;
    return;
  }

  const s = spinner();
  s.start("Registering google-dev-knowledge MCP");
  const r = registerGoogleDevKnowledge();
  s.stop(r.already ? "google-dev-knowledge already registered" : "google-dev-knowledge registered");
  ctx.counts.mcp = 1;
}

async function step8ClaudeMd(ctx: RunCtx): Promise<void> {
  if (!(await maybeRunStep(ctx, 8, "CLAUDE.md managed section"))) return;

  if (ctx.opts.dryRun) {
    dryLog(`merge managed section into ~/.claude/CLAUDE.md`);
    return;
  }

  const s = spinner();
  s.start("Writing managed section to CLAUDE.md");
  writeClaudeMdSection(join(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  s.stop("Managed section written to ~/.claude/CLAUDE.md");
}

async function step9Summary(ctx: RunCtx): Promise<void> {
  if (ctx.opts.skipSanity) {
    sectionHeader(9, TOTAL_STEPS, "Summary");
    log.info("Skipped (--skip-sanity)");
    return;
  }
  if (!(await maybeRunStep(ctx, 9, "Summary"))) return;

  const skills = existsSync(CLAUDE_SKILLS_DIR)
    ? (await import("node:fs")).readdirSync(CLAUDE_SKILLS_DIR).filter((n) => n.startsWith("gor-mobile-"))
        .length
    : 0;
  const agents = existsSync(CLAUDE_AGENTS_DIR)
    ? (await import("node:fs")).readdirSync(CLAUDE_AGENTS_DIR).filter((n) => n.endsWith(".md"))
        .length
    : 0;

  progressItem(1, 4, "Skills", skills > 0 ? "ok" : "warn", String(skills));
  progressItem(2, 4, "Agents", agents > 0 ? "ok" : "warn", String(agents));
  progressItem(3, 4, "Hooks", ctx.counts.hooks === 2 ? "ok" : "warn", String(ctx.counts.hooks));
  progressItem(4, 4, "Rules pack", ctx.rulesVersion !== "?" ? "ok" : "warn", `v${ctx.rulesVersion}`);
}

export async function cmdInit(opts: InitOptions = {}): Promise<void> {
  if (opts.noTui || opts.tui === false) forceNoTui();

  const mode = await (async () => {
    if (opts.yes && !opts.advanced) return "quickstart" as const;
    if (opts.advanced) return "advanced" as const;
    return modeSelect({ yes: Boolean(opts.yes), advanced: Boolean(opts.advanced) });
  })();

  if (!opts.yes) {
    await welcome(false);
  } else {
    renderBanner();
  }

  if (opts.dryRun) {
    log.info("DRY RUN — no changes will be made");
  }

  const ctx: RunCtx = {
    mode,
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    counts: { skills: 0, agents: 0, hooks: 0, mcp: 0 },
    rulesVersion: "?"
  };

  try {
    await step1Deps(ctx);
    await step2Android(ctx);
    await step3Rules(ctx);
    await step4Hooks(ctx);
    await step5Skills(ctx);
    await step6Agents(ctx);
    await step7Mcp(ctx);
    await step8ClaudeMd(ctx);
    await step9Summary(ctx);
  } catch (err) {
    if (isCancel(err as unknown)) {
      cancel("Cancelled");
      process.exit(130);
    }
    log.err(`init failed: ${(err as Error).message}`);
    process.exit(1);
  }

  finalOutro({
    skills: ctx.counts.skills,
    agents: ctx.counts.agents,
    hooks: ctx.counts.hooks,
    mcp: ctx.counts.mcp,
    rulesVersion: ctx.rulesVersion
  });

  void GOR_MOBILE_VERSION;
}
