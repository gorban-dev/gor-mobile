import { existsSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { cancel, isCancel, select } from "@clack/prompts";
import {
  GOR_MOBILE_TEMPLATES_DIR,
  GOR_MOBILE_VERSION,
  PROJECT_MARKER_NAME
} from "../constants.js";
import { provisionProjectAndroidSkill } from "../helpers/android-cli.js";
import { androidCliPath } from "../helpers/deps.js";
import { astIndexPath } from "../helpers/ast-index.js";
import { applyEnabledPlugins, SUPERPOWERS_KEY } from "../helpers/enabled-plugins.js";
import { installAgents, installSkills } from "../helpers/install-assets.js";
import {
  detectPlatform,
  ensureGitignoreFallback,
  ensureLocalExclude,
  findGitRoot,
  gitInit,
  readProjectMarker,
  writeProjectMarker,
  type ProjectMarker,
  type ProjectPlatform
} from "../helpers/project.js";
import { readManifest } from "../helpers/rules-pack.js";
import {
  CLEAR_CONTEXT_ON_PLAN_ACCEPT,
  enableClearContextOnPlanAccept,
  installAstIndexGuardHook,
  installSessionStartHook,
  installUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { projectClaudeSpec } from "../targets.js";
import { confirmStep } from "../ui/confirm-step.js";
import { log } from "../ui/log.js";
import { note } from "../ui/note.js";
import { forceNoTui, isTuiOn } from "../ui/tui-mode.js";

export interface InitOptions {
  dryRun?: boolean;
  yes?: boolean;
  noTui?: boolean;
  tui?: boolean;
  platform?: string;
  /** comma-separated extra plugins to enable in settings.local.json. */
  plugins?: string;
  /** current date, injected for testability (YYYY-MM-DD). */
  now?: string;
}

// Local-ignore entries so nothing gor-mobile writes shows up in git.
const EXCLUDE_ENTRIES = [".claude/", ".gor-mobile/", PROJECT_MARKER_NAME];

function machineReady(): { ok: boolean; reason?: string } {
  if (!existsSync(join(GOR_MOBILE_TEMPLATES_DIR, "session-start-hook.sh"))) {
    return { ok: false, reason: "hook scripts not found in ~/.gor-mobile/templates" };
  }
  if (!readManifest()) {
    return { ok: false, reason: "rules pack not installed in ~/.gor-mobile/rules" };
  }
  return { ok: true };
}

function parsePlatformFlag(raw: string | undefined): ProjectPlatform | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "android" || t === "ios") return t;
  throw new Error(`unknown --platform '${raw}' (expected android or ios)`);
}

async function resolvePlatform(
  root: string,
  opts: InitOptions,
  marker: ProjectMarker
): Promise<ProjectPlatform> {
  const fromFlag = parsePlatformFlag(opts.platform);
  if (fromFlag) return fromFlag;
  if (marker.platform) return marker.platform;
  const detected = detectPlatform(root);
  if (detected) return detected;

  // Greenfield: no build markers → ask (never guess).
  if (opts.yes || !isTuiOn()) {
    log.info("No build markers found — defaulting platform to android (override with --platform).");
    return "android";
  }
  const pick = await select<ProjectPlatform>({
    message: "What platform is this project?",
    options: [
      { value: "android", label: "Android", hint: "Kotlin / Jetpack" },
      { value: "ios", label: "iOS", hint: "Swift (early support)" }
    ],
    initialValue: "android"
  });
  if (isCancel(pick)) {
    cancel("Cancelled");
    process.exit(130);
  }
  return pick;
}

async function ensureGit(root: string, opts: InitOptions): Promise<"git" | "gitignore" | "none"> {
  if (findGitRoot(root)) return "git";
  if (opts.dryRun) return "none";

  const doInit = opts.yes
    ? true
    : await confirmStep("This folder is not a git repo. Run 'git init' now? (needed for local-only install)", true);
  if (doInit && (await gitInit(root))) {
    log.ok("git init");
    return "git";
  }
  return "gitignore";
}

async function writeExcludes(root: string, mode: "git" | "gitignore" | "none"): Promise<void> {
  if (mode === "none") return;
  if (mode === "git") {
    const res = await ensureLocalExclude(root, EXCLUDE_ENTRIES);
    if (res && res.added.length > 0) log.ok(`Local ignore updated (${res.file})`);
    else log.info("Local ignore already covers gor-mobile files");
    return;
  }
  const res = ensureGitignoreFallback(root, EXCLUDE_ENTRIES);
  if (res.added.length > 0) {
    log.warn(`No git repo — wrote ${res.added.join(", ")} to .gitignore (will be committed).`);
  }
}

export async function cmdInit(opts: InitOptions = {}): Promise<void> {
  if (opts.noTui || opts.tui === false) forceNoTui();

  // A real init needs the machine set up; a dry-run only describes the plan, so
  // it works anywhere and just warns when setup is missing.
  const ready = machineReady();
  if (!ready.ok && !opts.dryRun) {
    log.err(`Machine not set up: ${ready.reason}.`);
    log.info("Run 'gor-mobile setup' once per machine, then re-run 'gor-mobile init' here.");
    process.exit(1);
  }

  const root = process.cwd();
  const spec = projectClaudeSpec(root);
  const marker = readProjectMarker(root);
  const reinit = existsSync(join(root, PROJECT_MARKER_NAME));

  console.log("");
  console.log(pc.bold(pc.magenta(`gor-mobile init`)) + pc.dim(`  ·  ${root}`));
  if (reinit) log.info("Existing install found — refreshing (idempotent re-init).");
  if (opts.dryRun) log.info("DRY RUN — no changes will be made");

  const platform = await resolvePlatform(root, opts, marker);
  log.info(`Platform: ${platform}`);

  if (opts.dryRun) {
    if (!ready.ok) {
      log.warn(`Machine not set up (${ready.reason}) — run 'gor-mobile setup' before a real init.`);
    }
    console.log("");
    for (const line of [
      `install skills → ${spec.skillsDir}`,
      `install agents → ${spec.agentsDir}`,
      `merge SessionStart + UserPromptSubmit + PreToolUse → ${spec.hooksFile}`,
      `disable ${SUPERPOWERS_KEY} in ${spec.hooksFile}` +
        (opts.plugins ? ` (+enable ${opts.plugins})` : ""),
      `enable ${CLEAR_CONTEXT_ON_PLAN_ACCEPT} in ${spec.hooksFile}`,
      "android init → copy stock skill into .claude/skills, drop Claude-home copy",
      `write ${PROJECT_MARKER_NAME} (platform=${platform})`,
      `git exclude += ${EXCLUDE_ENTRIES.join(", ")}`
    ]) {
      console.log(`    ${pc.dim("[dry-run]")} ${line}`);
    }
    return;
  }

  const gitMode = await ensureGit(root, opts);

  // Hooks → settings.local.json (never committed by Claude Code).
  installSessionStartHook(spec);
  installUserPromptSubmitHook(spec);
  installAstIndexGuardHook(spec);
  log.ok(`Hooks → ${spec.hooksFile}`);

  const skills = installSkills(spec);
  log.ok(`${skills.installed.length} gor-mobile-* skills → ${spec.skillsDir}`);
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite issues in ${skills.missingPrefix.length} skill(s)`);
  }

  const agents = installAgents(spec);
  log.ok(`${agents.length} review agents → ${spec.agentsDir}`);

  const extraPlugins = (opts.plugins ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const managedPlugins = applyEnabledPlugins(spec.hooksFile, extraPlugins, [SUPERPOWERS_KEY]);
  log.ok(
    extraPlugins.length > 0
      ? `Plugins: disabled superpowers, enabled ${extraPlugins.join(", ")}`
      : "Disabled duplicate superpowers plugin for this repo"
  );

  const clearContextEnabled = enableClearContextOnPlanAccept(spec.hooksFile);
  const managedSettings = clearContextEnabled
    ? [...new Set([...(marker.managed_settings ?? []), CLEAR_CONTEXT_ON_PLAN_ACCEPT])]
    : (marker.managed_settings ?? []);
  if (clearContextEnabled) {
    log.ok(`Enabled ${CLEAR_CONTEXT_ON_PLAN_ACCEPT} (plan-approval "clear context" option)`);
  }

  const android = await provisionProjectAndroidSkill(spec.skillsDir);
  if (android.installed) log.ok(`android-cli skill → ${spec.skillsDir}/android-cli/`);
  else if (!android.ran) log.warn("android CLI not on PATH — skipped android-cli skill (run 'gor-mobile setup')");
  else log.warn(`android-cli skill not placed: ${android.error ?? "stock skill missing"}`);

  if (platform === "android") noteAstIndex(root);

  const nextMarker: ProjectMarker = {
    ...marker,
    platform,
    version: GOR_MOBILE_VERSION,
    installed_at: opts.now ?? marker.installed_at ?? new Date().toISOString().slice(0, 10),
    managed_plugins: managedPlugins,
    managed_settings: managedSettings
  };
  writeProjectMarker(root, nextMarker);
  log.ok(`Wrote ${PROJECT_MARKER_NAME}`);

  await writeExcludes(root, gitMode);

  outro(root, platform);
}

function noteAstIndex(root: string): void {
  if (!astIndexPath()) return;
  if (existsSync(join(root, ".claude", "rules", "ast-index.md"))) return;
  note(
    [
      "ast-index CLI detected but this repo is not indexed yet. To enable the",
      "structural-search guard, run once inside Claude Code:",
      "  /ast-index:initialize-android",
      "It writes .claude/rules/ast-index.md and builds the index."
    ].join("\n"),
    "ast-index (optional)"
  );
}

function outro(root: string, platform: ProjectPlatform): void {
  console.log("");
  console.log(`  ${pc.green("✓")} ${pc.bold("gor-mobile initialized for this repo")}`);
  console.log("");
  console.log(pc.bold("  Next steps:"));
  const steps =
    detectPlatform(root) === null
      ? [
          "Open Claude Code in this folder: claude",
          `Ask it to scaffold your ${platform} project — the brainstorming skill drives 'android' CLI.`
        ]
      : [
          "Open Claude Code in this folder: claude",
          "The SessionStart hook loads the gor-mobile workflow automatically."
        ];
  for (const s of steps) console.log(`    ${pc.cyan(s)}`);
  console.log("");
}
