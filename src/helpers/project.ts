import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { execa } from "execa";
import {
  HOME,
  LEGACY_PROJECT_MARKER_NAME,
  PROJECT_MARKER_FILE,
  PROJECT_STATE_DIR
} from "../constants.js";
import { ensureParentDir, readJsonSafe, writeJson } from "./paths.js";

export type ProjectPlatform = "android" | "ios";

export interface ProjectMarker {
  platform?: ProjectPlatform;
  version?: string;
  installed_at?: string;
  /** enabledPlugins keys in settings.local.json that init wrote (for uninstall). */
  managed_plugins?: string[];
  /** top-level settings.local.json keys that init turned on (for uninstall). */
  managed_settings?: string[];
  /** MCP server names in .mcp.json that init wrote (for uninstall). */
  managed_mcp?: string[];
  /** Session-start retention sweep threshold for .gor-mobile plan artifacts
   *  (plans/specs/state), in days. 0 disables the sweep. Default 30. */
  artifact_ttl_days?: number;
  [key: string]: unknown;
}

export function projectMarkerPath(root: string): string {
  return join(root, PROJECT_STATE_DIR, PROJECT_MARKER_FILE);
}

export function legacyProjectMarkerPath(root: string): string {
  return join(root, LEGACY_PROJECT_MARKER_NAME);
}

/** Marker in either location — current `.gor-mobile/marker.json` or the
 *  pre-0.3.5 repo-root file. */
export function hasProjectMarker(root: string): boolean {
  return existsSync(projectMarkerPath(root)) || existsSync(legacyProjectMarkerPath(root));
}

/** Walk up from `from` to the first dir carrying an install marker. */
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = from;
  while (true) {
    if (hasProjectMarker(dir)) return dir;
    if (dir === HOME) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readProjectMarker(root: string): ProjectMarker {
  const current = projectMarkerPath(root);
  const path = existsSync(current) ? current : legacyProjectMarkerPath(root);
  return readJsonSafe<ProjectMarker>(path, {});
}

export function writeProjectMarker(root: string, marker: ProjectMarker): void {
  writeJson(projectMarkerPath(root), marker);
}

/**
 * Move a pre-0.3.5 root marker into `.gor-mobile/marker.json`. Content wins
 * from whichever file the caller already read, so a half-migrated repo (both
 * files present) keeps the current one and just drops the stray root copy.
 */
export function migrateProjectMarker(root: string): boolean {
  const legacy = legacyProjectMarkerPath(root);
  if (!existsSync(legacy)) return false;
  if (!existsSync(projectMarkerPath(root))) {
    writeJson(projectMarkerPath(root), readJsonSafe<ProjectMarker>(legacy, {}));
  }
  rmSync(legacy, { force: true });
  return true;
}

/** Platform from build markers at the repo root. null = greenfield / unknown. */
export function detectPlatform(root: string): ProjectPlatform | null {
  const androidMarkers = [
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "gradlew"
  ];
  if (androidMarkers.some((m) => existsSync(join(root, m)))) return "android";
  try {
    const entries = readdirSync(root);
    if (
      entries.some((e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace")) ||
      entries.includes("Podfile") ||
      entries.includes("Package.swift")
    ) {
      return "ios";
    }
  } catch {
    // unreadable dir — treat as unknown
  }
  return null;
}

export type DirShape = "platform" | "empty" | "foreign";

/** Entries that do not mean "there is already a project here". */
const NEUTRAL_ENTRIES = new Set([
  ".git",
  ".gitignore",
  ".DS_Store",
  ".claude",
  ".idea",
  PROJECT_STATE_DIR,
  LEGACY_PROJECT_MARKER_NAME,
  "README.md",
  "LICENSE"
]);

const FOREIGN_MARKERS = [
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "Gemfile",
  "composer.json"
];

/**
 * Split what detectPlatform lumps into `null`: a deliberate greenfield folder
 * versus somebody's Node/Rust/Go repo that gor-mobile has no business in.
 */
export function classifyDir(root: string): { shape: DirShape; evidence: string[] } {
  if (detectPlatform(root)) return { shape: "platform", evidence: [] };
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return { shape: "empty", evidence: [] };
  }
  const meaningful = entries.filter((e) => !NEUTRAL_ENTRIES.has(e));
  if (meaningful.length === 0) return { shape: "empty", evidence: [] };
  const found = meaningful.filter(
    (e) => FOREIGN_MARKERS.includes(e) || e.endsWith(".csproj")
  );
  return {
    shape: "foreign",
    evidence:
      found.length > 0
        ? found
        : [`${meaningful.length} files, no Android/iOS markers`]
  };
}

/** Nearest enclosing git worktree root (dir containing .git). */
export function findGitRoot(from: string): string | null {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function gitInit(root: string): Promise<boolean> {
  const res = await execa("git", ["init"], { cwd: root, reject: false });
  return res.exitCode === 0;
}

export interface ExcludeResult {
  file: string;
  added: string[];
}

/** Absolute path to $GIT_DIR/info/exclude, resolving worktrees/submodules. */
async function gitInfoExcludePath(root: string): Promise<string | null> {
  let gitDir = join(root, ".git");
  if (!existsSync(gitDir)) return null;
  if (!statSync(gitDir).isDirectory()) {
    const res = await execa(
      "git",
      ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { reject: false }
    );
    if (res.exitCode !== 0) return null;
    gitDir = res.stdout.trim();
  }
  return join(gitDir, "info", "exclude");
}

/**
 * Append missing entries to the repo's local ignore ($GIT_DIR/info/exclude) —
 * local mode: nothing gor-mobile writes shows up in `git status` or diffs.
 * Resolves the real git dir via `git rev-parse` so worktrees/submodules work.
 */
export async function ensureLocalExclude(
  root: string,
  entries: string[]
): Promise<ExcludeResult | null> {
  const file = await gitInfoExcludePath(root);
  if (!file) return null;
  ensureParentDir(file);
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = new Set(current.split("\n").map((l) => l.trim()));
  const added = entries.filter((e) => !lines.has(e));
  if (added.length > 0) {
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    appendFileSync(file, `${prefix}${added.map((e) => `${e}\n`).join("")}`);
  }
  return { file, added };
}

/** Strip gor-mobile's entries from $GIT_DIR/info/exclude (uninstall path). */
export async function removeLocalExclude(
  root: string,
  entries: string[]
): Promise<ExcludeResult | null> {
  const file = await gitInfoExcludePath(root);
  if (!file || !existsSync(file)) return null;
  const drop = new Set(entries);
  const kept: string[] = [];
  const removed: string[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (drop.has(line.trim())) removed.push(line.trim());
    else kept.push(line);
  }
  if (removed.length > 0) {
    writeFileSync(file, kept.join("\n"));
  }
  return { file, added: removed };
}

/** Fallback when the user declines `git init`: a committed .gitignore. */
export function ensureGitignoreFallback(
  root: string,
  entries: string[]
): ExcludeResult {
  const file = join(root, ".gitignore");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = new Set(current.split("\n").map((l) => l.trim()));
  const added = entries.filter((e) => !lines.has(e));
  if (added.length > 0) {
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    writeFileSync(file, `${current}${prefix}${added.map((e) => `${e}\n`).join("")}`);
  }
  return { file, added };
}
