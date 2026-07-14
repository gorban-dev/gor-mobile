import pc from "picocolors";
import { confirm, isCancel } from "@clack/prompts";
import { legacyClaudeFootprint } from "../helpers/legacy.js";
import { teardownUserTarget } from "../helpers/teardown.js";
import { statusLineState } from "../helpers/settings-statusline.js";
import { codexStatusLineState } from "../helpers/codex-statusline.js";
import { detectGorMobileTargets, targetSpecs, type TargetId } from "../targets.js";
import { log } from "../ui/log.js";

interface MigrateOptions {
  yes?: boolean;
}

/**
 * One-shot teardown of a v0.1.x–v0.2.x global install. The behavioral break is
 * in Claude (now per-project), so the legacy CLAUDE footprint is the trigger;
 * when it is present the old global installer also co-installed Codex, so any
 * gor-mobile footprint on either user home is swept. Keeps ~/.gor-mobile (the
 * rules pack the new model still reads) and the CLI itself. Idempotent.
 */
export async function cmdMigrate(opts: MigrateOptions = {}): Promise<void> {
  const legacy = legacyClaudeFootprint();
  if (legacy.length === 0) {
    log.ok("Nothing to migrate — no legacy v0.2.x install found in ~/.claude.");
    log.info("On a fresh machine: run 'gor-mobile setup', then 'gor-mobile init' in each mobile repo.");
    return;
  }

  // Claude is the behavioral break, so tear it down whenever legacy findings
  // exist even if only the managed CLAUDE.md section remains (idempotent).
  // Codex is added only when it still carries a co-installed footprint.
  const ids = new Set<TargetId>(["claude", ...detectGorMobileTargets()]);
  const targets = targetSpecs([...ids]);

  console.error("");
  console.error(pc.bold("gor-mobile migrate — legacy v0.2.x global install found:"));
  for (const f of legacy) console.error(`  · ${f.label} → ${f.path}`);
  for (const t of targets) {
    console.error(pc.dim(`  will clear: ${t.label} (${t.home}) — hooks, skills, agents, managed section`));
  }
  console.error(pc.dim("  keeps:  ~/.gor-mobile (rules pack) and the gor-mobile CLI"));
  console.error("");

  if (!opts.yes) {
    const proceed = await confirm({
      message: "Remove the legacy global install now?",
      initialValue: true
    });
    if (isCancel(proceed) || proceed !== true) {
      log.info("Aborted — nothing changed.");
      return;
    }
  }

  // Status line may have been set deliberately — keep it unless asked. With
  // --yes we never remove it silently.
  let removeStatusLines = false;
  const slManaged = statusLineState().managed || codexStatusLineState().managed;
  if (slManaged && !opts.yes) {
    const drop = await confirm({
      message: "Also remove the gor-mobile status line?",
      initialValue: false
    });
    removeStatusLines = !isCancel(drop) && drop === true;
  }

  for (const target of targets) {
    teardownUserTarget(target, { keepStatusLine: !removeStatusLines });
  }

  console.error("");
  log.ok("Legacy global install removed.");
  log.info("Next:");
  log.info("  1. gor-mobile setup          # once per machine");
  log.info("  2. gor-mobile init           # in each mobile repo");
}
