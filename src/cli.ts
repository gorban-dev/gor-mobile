import { Command } from "commander";
import { GOR_MOBILE_VERSION } from "./constants.js";
import { cmdInit } from "./commands/init.js";
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

const program = new Command();

program
  .name("gor-mobile")
  .description("Android-aware overlay installer for Claude Code")
  .version(`gor-mobile ${GOR_MOBILE_VERSION}`, "-v, --version", "print version");

program
  .command("version")
  .description("Print version")
  .action(() => {
    console.log(`gor-mobile ${GOR_MOBILE_VERSION}`);
  });

program
  .command("init")
  .description("Run the install wizard (Android CLI, hooks, skills, MCP)")
  .option("--dry-run", "print planned actions; no filesystem changes")
  .option("-y, --yes", "assume yes to all prompts (non-interactive)")
  .option("--skip-sanity", "skip final summary step")
  .option("--no-tui", "force plain-text prompts")
  .option("--advanced", "confirm each step and allow URL override")
  .option("--rules <url>", "custom rules-pack git URL")
  .action(async (opts) => {
    await cmdInit(opts);
  });

program
  .command("doctor")
  .description("Check environment (deps, hooks, MCP)")
  .option("-v, --verbose", "dump hook payload + skill frontmatter")
  .action(async (opts) => {
    await cmdDoctor(opts);
  });

program
  .command("repair")
  .description("Restore managed files in ~/.claude/")
  .action(async () => {
    await cmdRepair();
  });

program
  .command("android-skills")
  .description("Browse + install/remove optional Google Android CLI skills")
  .action(async () => {
    await cmdAndroidSkills();
  });

program
  .command("update")
  .description("Pull latest rules, `android update`, then repair managed files")
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
  .description("Remove everything gor-mobile installed")
  .option("-y, --yes", "skip confirmation")
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
