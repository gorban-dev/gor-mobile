import { cancel, isCancel, multiselect } from "@clack/prompts";
import {
  TARGETS,
  detectInstalledTargets,
  parseTargetFlag,
  targetSpecs,
  type TargetId,
  type TargetSpec
} from "../targets.js";
import { isTuiOn } from "./tui-mode.js";
import { log } from "./log.js";

export interface TargetResolveOptions {
  target?: string;
  yes?: boolean;
}

/**
 * Decide which agents (Claude Code / Codex) this run installs into:
 *  - explicit `--target claude,codex` always wins;
 *  - non-interactive (`--yes` / no TTY) → auto-detect installed homes, default
 *    to claude when none are present;
 *  - interactive → a multiselect pre-checking the detected homes.
 */
export async function resolveTargets(
  opts: TargetResolveOptions
): Promise<TargetSpec[]> {
  if (opts.target) {
    return targetSpecs(parseTargetFlag(opts.target));
  }

  const detected = detectInstalledTargets();
  const fallback: TargetId[] = detected.length > 0 ? detected : ["claude"];

  if (opts.yes || !isTuiOn()) {
    if (detected.length > 0) {
      log.info(`Targets auto-detected: ${detected.join(", ")}`);
    } else {
      log.info("No agent homes detected — defaulting to claude");
    }
    return targetSpecs(fallback);
  }

  const picked = await multiselect({
    message: "Which agents should gor-mobile install into?",
    options: [
      { value: "claude" as TargetId, label: TARGETS.claude.label, hint: TARGETS.claude.home },
      { value: "codex" as TargetId, label: TARGETS.codex.label, hint: TARGETS.codex.home }
    ],
    initialValues: fallback,
    required: true
  });
  if (isCancel(picked)) {
    cancel("Cancelled");
    process.exit(130);
  }
  return targetSpecs(picked as TargetId[]);
}
