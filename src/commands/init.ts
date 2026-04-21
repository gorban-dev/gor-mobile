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

const TOTAL_STEPS = 8;

interface RunCtx {
  mode: WizardMode;
  opts: InitOptions;
  rulesUrl: string;
  counts: {
    skills: number;
    agents: number;
    hooks: number;
  };
  rulesVersion: string;
}

function dryLog(msg: string): void {
  console.log(`    ${pc.dim("[dry-run]")} ${msg}`);
}

function runStep(stepNum: number, title: string): void {
  sectionHeader(stepNum, TOTAL_STEPS, title);
}

async function step1Deps(ctx: RunCtx): Promise<void> {
  runStep(1, "Base dependencies");
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
  runStep(2, "Google Android CLI");

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
  runStep(3, "Rules pack");

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

async function step4Hooks(ctx: RunCtx): Promise<void> {
  runStep(4, "SessionStart + UserPromptSubmit hooks");

  if (ctx.opts.dryRun) {
    progressItem(1, 4, "copy session-start-hook.sh", "skip", "dry-run");
    progressItem(2, 4, "copy user-prompt-submit-hook.sh", "skip", "dry-run");
    progressItem(3, 4, "merge SessionStart", "skip", "dry-run");
    progressItem(4, 4, "merge UserPromptSubmit", "skip", "dry-run");
    ctx.counts.hooks = 2;
    return;
  }

  copyHookTemplates();
  progressItem(1, 4, "copy session-start-hook.sh", "ok");
  progressItem(2, 4, "copy user-prompt-submit-hook.sh", "ok");
  installSessionStartHook();
  progressItem(3, 4, "merge SessionStart", "ok", CLAUDE_SETTINGS);
  installUserPromptSubmitHook();
  progressItem(4, 4, "merge UserPromptSubmit", "ok", CLAUDE_SETTINGS);
  ctx.counts.hooks = 2;
}

async function step5Skills(ctx: RunCtx): Promise<void> {
  runStep(5, "Skills → ~/.claude/skills/gor-mobile-*/");

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
  runStep(6, "Agents → ~/.claude/agents/");

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

async function step7ClaudeMd(ctx: RunCtx): Promise<void> {
  runStep(7, "CLAUDE.md managed section");

  if (ctx.opts.dryRun) {
    progressItem(1, 1, "write managed section", "skip", "dry-run");
    return;
  }

  writeClaudeMdSection(join(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  progressItem(1, 1, "write managed section", "ok", "~/.claude/CLAUDE.md");
}

async function step8Summary(ctx: RunCtx): Promise<void> {
  if (ctx.opts.skipSanity) {
    runStep(8, "Summary");
    log.info("Skipped (--skip-sanity)");
    return;
  }
  runStep(8, "Summary");

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

  // 1. Banner + what-will-happen.
  // 2. Mode select (QuickStart vs Advanced — the only behavioural
  //    difference is whether step 3 prompts to override the rules URL).
  // 3. Run all 8 steps in sequence, no per-step confirm.
  await welcome(Boolean(opts.yes));

  const mode: WizardMode = opts.advanced
    ? "advanced"
    : opts.yes
    ? "quickstart"
    : await modeSelect({ yes: Boolean(opts.yes), advanced: Boolean(opts.advanced) });

  if (opts.dryRun) {
    log.info("DRY RUN — no changes will be made");
  }

  const ctx: RunCtx = {
    mode,
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    counts: { skills: 0, agents: 0, hooks: 0 },
    rulesVersion: "?"
  };

  try {
    await step1Deps(ctx);
    await step2Android(ctx);
    await step3Rules(ctx);
    await step4Hooks(ctx);
    await step5Skills(ctx);
    await step6Agents(ctx);
    await step7ClaudeMd(ctx);
    await step8Summary(ctx);
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
    rulesVersion: ctx.rulesVersion
  });

  void GOR_MOBILE_VERSION;
}
