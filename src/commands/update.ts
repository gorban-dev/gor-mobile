import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { GOR_MOBILE_RULES_DIR } from "../constants.js";
import { runAndroidUpdate } from "../helpers/android-cli.js";
import { androidCliPath, has } from "../helpers/deps.js";
import { log } from "../ui/log.js";
import { cmdRepair } from "./repair.js";

export async function cmdUpdate(): Promise<void> {
  log.step("Updating rules pack");
  if (existsSync(join(GOR_MOBILE_RULES_DIR, ".git"))) {
    const res = await execa(
      "git",
      ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"],
      { reject: false, stdio: "inherit" }
    );
    if (res.exitCode === 0) log.ok("Rules pack updated");
    else log.warn("git pull failed");
  } else {
    log.warn("Rules pack is not a git repo — skipping pull");
  }

  if (has("brew")) {
    const list = await execa("brew", ["list", "gor-mobile"], { reject: false });
    if (list.exitCode === 0) {
      log.step("Checking for brew update");
      await execa("brew", ["update"], { reject: false });
      const info = await execa("brew", ["info", "--json=v2", "gor-mobile"], { reject: false });
      const versions = await execa("brew", ["list", "--versions", "gor-mobile"], { reject: false });
      try {
        const parsed = JSON.parse(info.stdout);
        const latest = parsed?.formulae?.[0]?.versions?.stable;
        const current = versions.stdout.split(/\s+/)[1];
        if (latest && latest !== current) {
          log.info(`New CLI version available (${current} → ${latest}) — run: brew upgrade gor-mobile`);
        } else if (current) {
          log.ok(`CLI up-to-date (${current})`);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  if (androidCliPath()) {
    log.step("Updating Android CLI");
    const res = await runAndroidUpdate();
    if (res.ok) log.ok("Android CLI updated");
    else if (res.error) log.warn(`android update: ${res.error}`);
  }

  log.step("Repairing managed files");
  await cmdRepair();
}
