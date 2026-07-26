import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";

const LEGACY_SUFFIX = ".progress.md";

export interface StateMigration {
  migrated: string[];
  skipped: string[];
}

/**
 * v0.3.x layout migration: flat `.gor-mobile/state/<plan>.progress.md`
 * checkpoints move into per-plan workspaces
 * (`.gor-mobile/state/<plan>/progress.md` — same dir the SDD scripts use for
 * briefs, reports, and review packages). Also drops the self-ignoring
 * .gitignore so workspace files never enter `git status` or snapshot trees.
 * A flat file whose target already exists is left in place (never overwrite
 * a live checkpoint) and reported as skipped.
 */
export function migrateStateLayout(root: string): StateMigration {
  const stateDir = join(root, ".gor-mobile", "state");
  const res: StateMigration = { migrated: [], skipped: [] };
  if (!existsSync(stateDir)) return res;
  writeFileSync(join(stateDir, ".gitignore"), "*\n");
  for (const name of readdirSync(stateDir)) {
    if (!name.endsWith(LEGACY_SUFFIX)) continue;
    const slug = name.slice(0, -LEGACY_SUFFIX.length);
    if (!slug) continue;
    const target = join(stateDir, slug, "progress.md");
    if (existsSync(target)) {
      res.skipped.push(name);
      continue;
    }
    mkdirSync(join(stateDir, slug), { recursive: true });
    renameSync(join(stateDir, name), target);
    res.migrated.push(name);
  }
  return res;
}

export interface ArtifactInventory {
  plans: number;
  specs: number;
  workspaces: number;
  legacyCheckpoints: number;
  oldestDays: number | null;
}

function listMd(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(dir, f));
}

/** Counts + max age of the plan artifacts the session-start sweep governs. */
export function artifactInventory(root: string): ArtifactInventory {
  const gm = join(root, ".gor-mobile");
  const plans = listMd(join(gm, "plans"));
  const specs = listMd(join(gm, "specs"));
  const stateDir = join(gm, "state");
  const workspaces: string[] = [];
  const legacy: string[] = [];
  if (existsSync(stateDir)) {
    for (const name of readdirSync(stateDir)) {
      const p = join(stateDir, name);
      if (statSync(p).isDirectory()) {
        const cp = join(p, "progress.md");
        workspaces.push(existsSync(cp) ? cp : p);
      } else if (name.endsWith(LEGACY_SUFFIX)) {
        legacy.push(p);
      }
    }
  }
  let oldest: number | null = null;
  for (const f of [...plans, ...specs, ...workspaces, ...legacy]) {
    const age = Date.now() - statSync(f).mtimeMs;
    if (oldest === null || age > oldest) oldest = age;
  }
  return {
    plans: plans.length,
    specs: specs.length,
    workspaces: workspaces.length,
    legacyCheckpoints: legacy.length,
    oldestDays: oldest === null ? null : Math.floor(oldest / 86_400_000)
  };
}
