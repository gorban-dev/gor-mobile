import { Command } from "commander";
import { GOR_MOBILE_VERSION } from "./constants.js";
import { cmdSetup } from "./commands/setup.js";
import { cmdInit } from "./commands/init.js";
import { cmdMigrate } from "./commands/migrate.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdRepair } from "./commands/repair.js";
import { cmdUninstall } from "./commands/uninstall.js";
import {
  rulesDiff,
  rulesList,
  rulesUpdate,
  rulesUse,
  rulesValidate
} from "./commands/rules.js";
import { cmdDocs } from "./commands/docs.js";
import { cmdSelfUpdate } from "./commands/self-update.js";
import { cmdAndroid } from "./commands/android.js";
import { cmdAndroidSkills } from "./commands/android-skills.js";
import { cmdUpdate } from "./commands/update.js";
import { legacyGate } from "./helpers/legacy.js";

const program = new Command();

// Refuse to run on top of a v0.2.x global install for the state-changing
// commands (init/doctor/repair/update); warn on everything else. setup/migrate
// carry their own legacy handling; version/uninstall must work to fix it.
const LEGACY_BLOCK = new Set(["init", "doctor", "repair", "update"]);
const LEGACY_EXEMPT = new Set(["version", "migrate", "uninstall", "setup"]);

program
  .name("gor-mobile")
  .description("Android-aware Claude Code / Codex workflow — machine setup + per-project install")
  .version(`gor-mobile ${GOR_MOBILE_VERSION}`, "-v, --version", "print version");

program.hook("preAction", (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  if (LEGACY_EXEMPT.has(name)) return;
  const block = LEGACY_BLOCK.has(name);
  if (legacyGate({ block }) && block) process.exit(1);
});

program
  .command("version")
  .description("Print version")
  .action(() => {
    console.log(`gor-mobile ${GOR_MOBILE_VERSION}`);
  });

program
  .command("setup")
  .description("Machine setup (once): android CLI, ast-index, rules pack, hook scripts, Codex")
  .option("--dry-run", "print planned actions; no filesystem changes")
  .option("-y, --yes", "assume yes to all prompts (non-interactive)")
  .option("--no-tui", "force plain-text prompts")
  .option("--advanced", "confirm each step and allow URL override")
  .option("--rules <url>", "custom rules-pack git URL")
  .option("--skip-android-update", "do not auto-update the Android CLI")
  .option("--target <targets>", "user-level agents to set up (codex)")
  .action(async (opts) => {
    await cmdSetup(opts);
  });

program
  .command("init")
  .description("Install the gor-mobile workflow into the current repo (per-project)")
  .option("--dry-run", "print planned actions; no filesystem changes")
  .option("-y, --yes", "assume yes to all prompts (non-interactive)")
  .option("--no-tui", "force plain-text prompts")
  .option("--platform <platform>", "android or ios (skip detection/prompt)")
  .option("--plugins <list>", "comma-separated extra plugins to enable (figma,swagger-android,…)")
  .action(async (opts) => {
    await cmdInit(opts);
  });

program
  .command("migrate")
  .description("Remove a legacy v0.2.x global install (keeps the rules pack)")
  .option("-y, --yes", "skip confirmation")
  .action(async (opts) => {
    await cmdMigrate(opts);
  });

program
  .command("doctor")
  .description("Check machine setup, the current project, and Codex")
  .option("-v, --verbose", "dump hook payload + skill frontmatter")
  .action(async (opts) => {
    await cmdDoctor(opts);
  });

program
  .command("repair")
  .description("Refresh managed files: machine hook scripts, this project, and Codex")
  .option("--skip-android-update", "do not auto-update the Android CLI")
  .action(async (opts) => {
    await cmdRepair(opts);
  });

program
  .command("android-skills")
  .description("Browse + install/remove optional Google Android CLI skills")
  .action(async () => {
    await cmdAndroidSkills();
  });

program
  .command("update")
  .description("Pull latest rules, then repair managed files (also updates the Android CLI)")
  .action(async () => {
    await cmdUpdate();
  });

program
  .command("self-update")
  .description("Update the CLI itself (curl-install path)")
  .action(async () => {
    await cmdSelfUpdate();
  });

program
  .command("uninstall")
  .description("Remove gor-mobile — from this repo (--project) or the whole machine (--machine)")
  .option("-y, --yes", "skip confirmation")
  .option("--project", "remove only this repo's .claude footprint + .gor-mobile.json")
  .option("--machine", "remove user agent homes + ~/.gor-mobile (templates, rules)")
  .action(async (opts) => {
    await cmdUninstall(opts);
  });

const rules = program
  .command("rules")
  .description("Manage the architecture rules pack");
rules
  .command("list")
  .alias("ls")
  .description("Show installed pack + source + version")
  .action(async () => {
    await rulesList();
  });
rules
  .command("use <url>")
  .description("Switch to a pack (git URL or local dir)")
  .action(async (url: string) => {
    await rulesUse(url);
  });
rules
  .command("update")
  .alias("up")
  .description("git pull the current pack")
  .action(async () => {
    await rulesUpdate();
  });
rules
  .command("diff")
  .description("Show diff vs upstream")
  .action(async () => {
    await rulesDiff();
  });
rules
  .command("validate")
  .description("Check manifest.json and compatibility")
  .action(async () => {
    await rulesValidate();
  });

program
  .command("docs")
  .argument("<query...>")
  .description("Search Android docs")
  .action(async (query: string[]) => {
    await cmdDocs(query);
  });

program
  .command("android")
  .description("Wrapper around Google's `android` CLI")
  .allowUnknownOption(true)
  .helpOption(false)
  .argument("[args...]", "arguments passed through to android CLI")
  .action(async (args: string[]) => {
    await cmdAndroid(args ?? []);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
