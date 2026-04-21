import { existsSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import {
  DEFAULT_RULES_REF,
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_CONFIG_DIR,
  GOR_MOBILE_RULES_DIR
} from "../constants.js";
import type { GorMobileConfig, RulesManifest } from "../types.js";
import { ensureDir, readJsonSafe, writeJson } from "./paths.js";

export function manifestPath(): string {
  return join(GOR_MOBILE_RULES_DIR, "manifest.json");
}

export function readManifest(): RulesManifest | null {
  if (!existsSync(manifestPath())) return null;
  try {
    return readJsonSafe<RulesManifest>(manifestPath(), {});
  } catch {
    return null;
  }
}

export function readConfig(): GorMobileConfig {
  return readJsonSafe<GorMobileConfig>(GOR_MOBILE_CONFIG, {});
}

export function saveConfig(source: string, ref = DEFAULT_RULES_REF): void {
  ensureDir(GOR_MOBILE_CONFIG_DIR);
  const current = readConfig();
  writeJson(GOR_MOBILE_CONFIG, {
    ...current,
    rules_source: source,
    rules_ref: ref,
    preset: current.preset ?? "balanced"
  });
}

export async function cloneOrPull(url: string, ref = DEFAULT_RULES_REF): Promise<void> {
  if (existsSync(join(GOR_MOBILE_RULES_DIR, ".git"))) {
    await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
      reject: false
    });
    return;
  }
  if (existsSync(GOR_MOBILE_RULES_DIR)) {
    rmSync(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  ensureDir(join(GOR_MOBILE_RULES_DIR, ".."));
  await execa("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    ref,
    url,
    GOR_MOBILE_RULES_DIR
  ]);
}

export function copyFromLocal(source: string): void {
  if (existsSync(GOR_MOBILE_RULES_DIR)) {
    rmSync(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync(source, GOR_MOBILE_RULES_DIR, { recursive: true });
}

export function fallbackToBundled(bundledRoot: string): void {
  if (existsSync(GOR_MOBILE_RULES_DIR)) {
    rmSync(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync(bundledRoot, GOR_MOBILE_RULES_DIR, { recursive: true });
}

export async function pullCurrent(): Promise<void> {
  if (!existsSync(join(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout — cannot pull");
  }
  await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
    stdio: "inherit"
  });
}

export async function diffAgainstUpstream(): Promise<string> {
  if (!existsSync(join(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout");
  }
  await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "fetch", "origin"], {
    reject: false
  });
  const { stdout } = await execa(
    "git",
    ["-C", GOR_MOBILE_RULES_DIR, "diff", "HEAD", "origin/HEAD", "--stat"],
    { reject: false }
  );
  return stdout;
}

export function validateManifest(): { ok: boolean; errors: string[]; manifest?: RulesManifest } {
  const errors: string[] = [];
  const m = readManifest();
  if (!m) {
    errors.push("manifest.json missing or unreadable");
    return { ok: false, errors };
  }
  if (!m.version) errors.push("manifest.version missing");
  if (!m.stack) errors.push("manifest.stack missing");
  if (m.sections) {
    for (const rel of Object.values(m.sections)) {
      if (!existsSync(join(GOR_MOBILE_RULES_DIR, rel))) {
        errors.push(`missing rule file: ${rel}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, manifest: m };
}

export async function gitBranchAndRev(): Promise<{ branch?: string; rev?: string }> {
  if (!existsSync(join(GOR_MOBILE_RULES_DIR, ".git"))) return {};
  const branch = await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--abbrev-ref", "HEAD"], { reject: false });
  const rev = await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--short", "HEAD"], { reject: false });
  return { branch: branch.stdout.trim(), rev: rev.stdout.trim() };
}
