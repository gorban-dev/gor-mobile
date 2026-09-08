import { existsSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import type { TargetSpec } from "../targets.js";
import type { ProjectMarker } from "./project.js";
import { removeWorkflowSizeGuideline, WORKFLOW_SIZE_GUIDELINE } from "./settings-merge.js";

export const LEGACY_RUNNER_AGENT = "gor-mobile-runner.md";

export interface LegacyWorkflowsCleanup {
  /** workflow filenames removed from <home>/workflows */
  workflows: string[];
  runnerRemoved: boolean;
  guidelineRemoved: boolean;
}

// 0.4.0–0.4.5 installed .claude/workflows/gor-*.js, a runner agent and
// workflowSizeGuideline into every Claude project. Only what the marker says
// we wrote is removed: a user-authored workflow sharing a shipped name, or a
// guideline the user set themselves, is left alone.
export function removeLegacyWorkflows(spec: TargetSpec, marker: ProjectMarker): LegacyWorkflowsCleanup {
  const result: LegacyWorkflowsCleanup = { workflows: [], runnerRemoved: false, guidelineRemoved: false };
  const wfDir = join(spec.home, "workflows");
  const owned = marker.managed_workflows ?? [];
  if (owned.length > 0 && existsSync(wfDir)) {
    for (const entry of readdirSync(wfDir)) {
      if (!owned.includes(entry)) continue;
      rmSync(join(wfDir, entry), { force: true });
      result.workflows.push(entry);
    }
    if (readdirSync(wfDir).length === 0) rmdirSync(wfDir);
  }
  const runner = join(spec.agentsDir, LEGACY_RUNNER_AGENT);
  if (existsSync(runner)) {
    rmSync(runner, { force: true });
    result.runnerRemoved = true;
  }
  if ((marker.managed_settings ?? []).includes(WORKFLOW_SIZE_GUIDELINE)) {
    removeWorkflowSizeGuideline(spec.hooksFile);
    result.guidelineRemoved = true;
  }
  return result;
}

export function describeLegacyCleanup(c: LegacyWorkflowsCleanup): string | null {
  const items = [
    ...c.workflows,
    ...(c.runnerRemoved ? [LEGACY_RUNNER_AGENT] : []),
    ...(c.guidelineRemoved ? [WORKFLOW_SIZE_GUIDELINE] : [])
  ];
  return items.length > 0 ? `Removed 0.4.x workflow leftovers: ${items.join(", ")}` : null;
}