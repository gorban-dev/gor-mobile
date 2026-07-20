import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { astIndexPath } from "./ast-index.js";

export interface AstIndexDelta {
  changed: number;
  deleted: number;
}

/**
 * Incremental refresh of the project's ast-index database. Returns null when
 * there is nothing to do (no CLI, repo not initialized by the upstream plugin,
 * or unparseable output) — callers treat null as "stay quiet".
 */
export async function runAstIndexUpdate(
  root: string
): Promise<AstIndexDelta | null> {
  if (!astIndexPath()) return null;
  if (!existsSync(join(root, ".claude", "rules", "ast-index.md"))) return null;
  // Bounded like the bash twin (templates/session-start-hook.sh's watchdog,
  // default 10s): a wedged indexer must not hang `doctor`/`update` forever.
  // `reject: false` means a timeout resolves (not throws) with `exitCode`
  // left undefined, so the existing check below already treats it as a
  // silent failure.
  const res = await execa("ast-index", ["update"], {
    cwd: root,
    reject: false,
    timeout: 10_000,
  });
  if (res.exitCode !== 0) return null;
  // The "Found N new/changed files, M deleted files" line lands on stderr on
  // the real CLI (progress-style logging), while the terse "Checking for
  // changes...", "Updated: ...", "Index is up to date." lines are on
  // stdout — confirmed against the installed binary. Search both streams so
  // this does not silently go dark depending on which one carries it.
  const combined = `${res.stdout}\n${res.stderr}`;
  const m = /Found (\d+) new\/changed files, (\d+) deleted files/.exec(combined);
  if (!m?.[1] || !m[2]) return null;
  return { changed: Number(m[1]), deleted: Number(m[2]) };
}
