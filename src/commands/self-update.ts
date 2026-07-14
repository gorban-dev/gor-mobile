import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { gorMobileRoot } from "../constants.js";
import { has } from "../helpers/deps.js";
import { legacyClaudeFootprint } from "../helpers/legacy.js";
import { log } from "../ui/log.js";

// v0.3.0 moved the Claude workflow per-project; a leftover global install must
// be migrated. Point at the path after any update so the notice is seen once.
function noteMigration(): void {
  if (legacyClaudeFootprint().length === 0) return;
  log.warn("A legacy v0.2.x global install remains in ~/.claude.");
  log.info("Migrate it: gor-mobile migrate → gor-mobile setup → gor-mobile init (per repo). See CHANGELOG 0.3.0.");
}

export async function cmdSelfUpdate(): Promise<void> {
  const root = gorMobileRoot();
  if (existsSync(join(root, ".git"))) {
    log.step(`git pull in ${root}`);
    await execa("git", ["-C", root, "pull", "--ff-only"], { stdio: "inherit" });
    log.step("npm install");
    await execa("npm", ["install", "--production=false"], { cwd: root, stdio: "inherit" });
    log.step("npm run build");
    await execa("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    log.ok("CLI updated");
    noteMigration();
    return;
  }

  if (has("brew")) {
    const res = await execa("brew", ["list", "gor-mobile"], { reject: false });
    if (res.exitCode === 0) {
      log.info("Brew-managed install — use: brew upgrade gor-mobile");
      noteMigration();
      return;
    }
  }

  log.warn("Unable to self-update: not a git repo and not a brew install.");
  log.info(
    "Reinstall via: curl -fsSL https://raw.githubusercontent.com/gorban-dev/gor-mobile/main/install.sh | bash"
  );
}
