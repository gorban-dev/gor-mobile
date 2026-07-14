import { existsSync, readdirSync, rmdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { confirm, isCancel, select } from "@clack/prompts";
import {
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_CONFIG_DIR,
  GOR_MOBILE_HOME,
  PROJECT_MARKER_NAME
} from "../constants.js";
import { uninstallAndroidCli } from "../helpers/android-cli.js";
import { androidCliPath } from "../helpers/deps.js";
import { removeEnabledPlugins, SUPERPOWERS_KEY } from "../helpers/enabled-plugins.js";
import { findProjectRoot, readProjectMarker, removeLocalExclude } from "../helpers/project.js";
import {
  removeAstIndexGuardHook,
  removeSessionStartHook,
  removeUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { teardownUserTarget } from "../helpers/teardown.js";
import {
  detectInstalledTargets,
  projectClaudeSpec,
  targetSpecs
} from "../targets.js";
import { isTuiOn } from "../ui/tui-mode.js";
import { log } from "../ui/log.js";

interface UninstallOptions {
  yes?: boolean;
  project?: boolean;
  machine?: boolean;
}

type UninstallMode = "project" | "machine";

const EXCLUDE_ENTRIES = [".claude/", ".gor-mobile/", PROJECT_MARKER_NAME];

async function resolveMode(opts: UninstallOptions): Promise<UninstallMode | null> {
  if (opts.machine) return "machine";
  if (opts.project) return "project";
  if (opts.yes || !isTuiOn()) return "machine"; // back-compat: full removal
  const pick = await select<UninstallMode>({
    message: "What do you want to remove?",
    options: [
      { value: "project", label: "This repo", hint: ".claude footprint + .gor-mobile.json" },
      { value: "machine", label: "The whole machine", hint: "user homes + ~/.gor-mobile + rules" }
    ]
  });
  if (isCancel(pick)) return null;
  return pick;
}

/** Tidy up a now-empty directory; ignore failures (not empty / missing). */
function rmdirIfEmpty(dir: string): void {
  try {
    if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
  } catch {
    // non-empty or vanished — leave it
  }
}

async function uninstallProject(opts: UninstallOptions): Promise<void> {
  const root = findProjectRoot() ?? process.cwd();
  if (!existsSync(join(root, PROJECT_MARKER_NAME))) {
    log.info(`No gor-mobile project install here (${PROJECT_MARKER_NAME} not found in ${root}).`);
    return;
  }

  if (!opts.yes) {
    const proceed = await confirm({
      message: `Remove the gor-mobile footprint from this repo (${root})?`,
      initialValue: false
    });
    if (isCancel(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }

  const spec = projectClaudeSpec(root);
  const marker = readProjectMarker(root);

  removeSessionStartHook(spec);
  removeUserPromptSubmitHook(spec);
  removeAstIndexGuardHook(spec);
  removeEnabledPlugins(spec.hooksFile, marker.managed_plugins ?? [SUPERPOWERS_KEY]);
  log.ok(`Hooks + plugin overrides removed (${spec.hooksFile})`);

  if (existsSync(spec.skillsDir)) {
    for (const entry of readdirSync(spec.skillsDir)) {
      if (entry.startsWith("gor-mobile-") || entry === "android-cli") {
        rmSync(join(spec.skillsDir, entry), { recursive: true, force: true });
      }
    }
    rmdirIfEmpty(spec.skillsDir);
  }
  log.ok(`Skills removed (${spec.skillsDir})`);

  if (existsSync(spec.agentsDir)) {
    for (const entry of readdirSync(spec.agentsDir)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync(join(spec.agentsDir, entry), { force: true });
      }
    }
    rmdirIfEmpty(spec.agentsDir);
  }
  log.ok(`Agents removed (${spec.agentsDir})`);

  rmSync(join(root, PROJECT_MARKER_NAME), { force: true });
  log.ok(`Removed ${PROJECT_MARKER_NAME}`);

  const excl = await removeLocalExclude(root, EXCLUDE_ENTRIES);
  if (excl && excl.added.length > 0) log.ok(`Local ignore cleaned (${excl.file})`);

  log.ok("gor-mobile removed from this repo. Run 'gor-mobile uninstall --machine' to remove the machine-level install too.");
}

async function uninstallMachine(opts: UninstallOptions): Promise<void> {
  if (!opts.yes) {
    const proceed = await confirm({
      message:
        "Remove gor-mobile from all user agent homes plus templates, rules pack, and config?",
      initialValue: false
    });
    if (isCancel(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }

  const detected = detectInstalledTargets();
  const targets = targetSpecs(detected.length > 0 ? detected : ["claude"]);
  for (const target of targets) {
    teardownUserTarget(target);
  }

  log.step(`Removing ${GOR_MOBILE_HOME} (templates, rules)`);
  if (existsSync(GOR_MOBILE_HOME)) {
    rmSync(GOR_MOBILE_HOME, { recursive: true, force: true });
  }

  log.step(`Removing ${GOR_MOBILE_CONFIG}`);
  if (existsSync(GOR_MOBILE_CONFIG)) rmSync(GOR_MOBILE_CONFIG);
  rmdirIfEmpty(GOR_MOBILE_CONFIG_DIR);

  log.ok("gor-mobile artifacts removed");

  const cli = androidCliPath();
  if (cli && !opts.yes) {
    const removeAndroid = await confirm({
      message:
        "Also uninstall the Android CLI (launcher + ~/.android/cli cache + android-cli skill)?",
      initialValue: false
    });
    if (!isCancel(removeAndroid) && removeAndroid === true) {
      log.step("Removing Android CLI");
      const res = await uninstallAndroidCli();
      for (const p of res.removed) log.ok(`removed ${p}`);
      for (const e of res.errors) log.warn(e);
      if (res.errors.length === 0) log.ok("Android CLI removed");
    }
  }

  log.info("Per-repo footprints (.claude, .gor-mobile.json) stay put — run 'gor-mobile uninstall --project' inside each.");
}

export async function cmdUninstall(opts: UninstallOptions = {}): Promise<void> {
  const mode = await resolveMode(opts);
  if (!mode) {
    log.info("Aborted");
    return;
  }
  if (mode === "project") await uninstallProject(opts);
  else await uninstallMachine(opts);
}
