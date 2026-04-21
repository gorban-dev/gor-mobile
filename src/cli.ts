import { Command } from "commander";
import { GOR_MOBILE_VERSION } from "./constants.js";

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

function notImplemented(name: string) {
  return () => {
    console.log(`${name}: not implemented yet`);
    process.exit(0);
  };
}

program
  .command("init")
  .description("Run the install wizard (Android CLI, hooks, skills, MCP)")
  .option("--dry-run", "print planned actions; no filesystem changes")
  .option("-y, --yes", "assume yes to all prompts (non-interactive)")
  .option("--skip-sanity", "skip final summary step")
  .option("--no-tui", "force plain-text prompts")
  .option("--advanced", "confirm each step and allow URL override")
  .option("--rules <url>", "custom rules-pack git URL")
  .action(notImplemented("init"));

program
  .command("doctor")
  .description("Check environment (deps, hooks, MCP)")
  .option("-v, --verbose", "dump hook payload + skill frontmatter")
  .action(notImplemented("doctor"));

program
  .command("repair")
  .description("Restore managed files in ~/.claude/")
  .action(notImplemented("repair"));

program
  .command("update")
  .description("Pull latest rules + repair managed files")
  .action(notImplemented("update"));

program
  .command("self-update")
  .description("Update the CLI itself (curl-install path)")
  .action(notImplemented("self-update"));

program
  .command("uninstall")
  .description("Remove everything gor-mobile installed")
  .option("-y, --yes", "skip confirmation")
  .action(notImplemented("uninstall"));

const rules = program
  .command("rules")
  .description("Manage the architecture rules pack");
rules
  .command("list")
  .description("Show installed pack + source + version")
  .action(notImplemented("rules list"));
rules
  .command("use <url>")
  .description("Switch to a pack (git URL or local dir)")
  .action(notImplemented("rules use"));
rules
  .command("update")
  .description("git pull the current pack")
  .action(notImplemented("rules update"));
rules
  .command("diff")
  .description("Show diff vs upstream")
  .action(notImplemented("rules diff"));
rules
  .command("validate")
  .description("Check manifest.json and compatibility")
  .action(notImplemented("rules validate"));

program
  .command("docs <query...>")
  .description("Search Android docs")
  .action(notImplemented("docs"));

program
  .command("android")
  .description("Wrapper around Google's `android` CLI")
  .allowUnknownOption(true)
  .action(notImplemented("android"));

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
