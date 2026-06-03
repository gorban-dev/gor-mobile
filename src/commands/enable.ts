import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "../ui/log.js";

export function cmdEnable(): void {
  const marker = join(process.cwd(), ".gor-mobile.json");
  if (existsSync(marker)) {
    log.ok(`Already enabled — ${marker} exists`);
    return;
  }
  writeFileSync(marker, "{}\n");
  log.ok(`gor-mobile enabled for this repo → ${marker}`);
  log.info("Commit this file so the whole team's sessions activate gor-mobile here.");
}
