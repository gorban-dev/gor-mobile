import { existsSync, rmSync } from "node:fs";
import {
  DEFAULT_RULES_REF,
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_RULES_DIR
} from "../constants.js";
import {
  cloneOrPull,
  copyFromLocal,
  diffAgainstUpstream,
  gitBranchAndRev,
  pullCurrent,
  readConfig,
  readManifest,
  saveConfig,
  validateManifest
} from "../helpers/rules-pack.js";
import { log } from "../ui/log.js";

export async function rulesList(): Promise<void> {
  if (!existsSync(GOR_MOBILE_RULES_DIR)) {
    log.warn("No rules pack installed. Run: gor-mobile rules use <url>");
    return;
  }
  const m = readManifest();
  const cfg = existsSync(GOR_MOBILE_CONFIG) ? readConfig() : {};
  const { branch, rev } = await gitBranchAndRev();
  console.log("Installed pack:");
  console.log(`  name:    ${m?.name ?? "?"}`);
  console.log(`  version: ${m?.version ?? "?"}`);
  console.log(`  stack:   ${m?.stack ?? "?"}`);
  console.log(`  source:  ${cfg.rules_source ?? "(unknown)"}`);
  console.log(`  path:    ${GOR_MOBILE_RULES_DIR}`);
  if (branch && rev) {
    console.log(`  git:     ${branch} @ ${rev}`);
  }
}

export async function rulesUse(target: string): Promise<void> {
  if (!target) {
    log.err("Usage: gor-mobile rules use <url|path>");
    process.exitCode = 1;
    return;
  }

  const backup = `${GOR_MOBILE_RULES_DIR}.bak`;
  if (existsSync(GOR_MOBILE_RULES_DIR)) {
    log.info(`Backing up existing pack to ${backup}`);
    if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
    const { renameSync } = await import("node:fs");
    renameSync(GOR_MOBILE_RULES_DIR, backup);
  }

  try {
    if (existsSync(target)) {
      log.info(`Copying local pack from ${target}`);
      copyFromLocal(target);
    } else {
      log.info(`Cloning ${target}`);
      await cloneOrPull(target, DEFAULT_RULES_REF);
    }
  } catch (err) {
    log.err(`Install failed — restoring backup: ${(err as Error).message}`);
    if (existsSync(GOR_MOBILE_RULES_DIR)) {
      rmSync(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
    }
    if (existsSync(backup)) {
      const { renameSync } = await import("node:fs");
      renameSync(backup, GOR_MOBILE_RULES_DIR);
    }
    process.exitCode = 1;
    return;
  }

  saveConfig(target);
  log.ok(`Rules pack installed at ${GOR_MOBILE_RULES_DIR}`);
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });

  const res = validateManifest();
  if (!res.ok) {
    for (const e of res.errors) log.err(e);
  } else {
    log.ok(
      `manifest.json valid (v${res.manifest?.version}, stack=${res.manifest?.stack}, compat=${res.manifest?.compatible_with ?? "?"})`
    );
  }
}

export async function rulesUpdate(): Promise<void> {
  try {
    await pullCurrent();
    log.ok("Rules pack updated");
  } catch (err) {
    log.err((err as Error).message);
    process.exitCode = 1;
  }
}

export async function rulesDiff(): Promise<void> {
  try {
    const out = await diffAgainstUpstream();
    if (out) console.log(out);
    else console.log("(no diff)");
  } catch (err) {
    log.err((err as Error).message);
    process.exitCode = 1;
  }
}

export async function rulesValidate(): Promise<void> {
  const res = validateManifest();
  if (!res.ok) {
    for (const e of res.errors) log.err(e);
    process.exitCode = 1;
    return;
  }
  log.ok(
    `manifest.json valid (v${res.manifest?.version}, stack=${res.manifest?.stack}, compat=${res.manifest?.compatible_with ?? "?"})`
  );
}
