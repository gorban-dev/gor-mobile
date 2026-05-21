import { existsSync } from "node:fs";
import { join } from "node:path";
import { cancel, isCancel, multiselect, spinner } from "@clack/prompts";
import { CLAUDE_SKILLS_DIR } from "../constants.js";
import {
  addAndroidSkill,
  listAndroidSkills,
  removeAndroidSkill
} from "../helpers/android-cli.js";
import { androidCliPath } from "../helpers/deps.js";
import { log } from "../ui/log.js";
import { isTuiOn } from "../ui/tui-mode.js";

function isInstalled(name: string): boolean {
  return existsSync(join(CLAUDE_SKILLS_DIR, name, "SKILL.md"));
}

export async function cmdAndroidSkills(): Promise<void> {
  if (!androidCliPath()) {
    log.err(
      "android CLI not on PATH. Run 'gor-mobile init' or 'gor-mobile repair' — android CLI is required after v0.1.0."
    );
    process.exit(1);
  }

  const sp = spinner();
  sp.start("Fetching available Android skills");
  const listed = await listAndroidSkills();
  sp.stop(listed.ok ? `Fetched ${listed.names.length} skills` : "Failed to fetch skills");

  if (!listed.ok) {
    log.err(`android skills list failed: ${listed.error ?? "unknown error"}`);
    process.exit(1);
  }
  if (listed.names.length === 0) {
    log.warn("No skills returned by `android skills list`.");
    return;
  }

  const options = listed.names.map((name) => ({
    value: name,
    label: isInstalled(name) ? `${name} (installed)` : name
  }));
  const preselected = listed.names.filter(isInstalled);

  if (!isTuiOn()) {
    log.info("Available skills:");
    for (const o of options) log.info(`  ${o.label}`);
    log.info("Run this command in a TTY to select/deselect interactively.");
    return;
  }

  const picked = await multiselect({
    message:
      "Select Android skills to keep installed (space to toggle, enter to confirm):",
    options,
    initialValues: preselected,
    required: false
  });
  if (isCancel(picked)) {
    cancel("Cancelled");
    return;
  }

  const chosen = new Set(picked as string[]);
  const current = new Set(preselected);

  const toAdd = [...chosen].filter((n) => !current.has(n));
  const toRemove = [...current].filter((n) => !chosen.has(n));

  if (toAdd.length === 0 && toRemove.length === 0) {
    log.ok("No changes.");
    return;
  }

  for (const name of toAdd) {
    const s = spinner();
    s.start(`Installing ${name}`);
    const r = await addAndroidSkill(name);
    if (r.ok) s.stop(`Installed ${name}`);
    else s.stop(`Failed to install ${name}${r.error ? `: ${r.error}` : ""}`);
  }
  for (const name of toRemove) {
    const s = spinner();
    s.start(`Removing ${name}`);
    const r = await removeAndroidSkill(name);
    if (r.ok) s.stop(`Removed ${name}`);
    else s.stop(`Failed to remove ${name}${r.error ? `: ${r.error}` : ""}`);
  }

  log.ok("Done. Re-open Claude Code sessions to pick up skill changes.");
}