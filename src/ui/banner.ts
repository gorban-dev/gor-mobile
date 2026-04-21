import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { GOR_MOBILE_VERSION, gorMobileRoot } from "../constants.js";

export function renderBanner(): void {
  const path = join(gorMobileRoot(), "templates", "banner.txt");
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    const trimmed = raw.replace(/\n+$/, "");
    const colored = trimmed
      .split("\n")
      .map((line) => pc.magenta(line))
      .join("\n");
    console.log("");
    console.log(colored);
  } else {
    console.log("");
    console.log(pc.bold(pc.magenta("GOR-MOBILE")));
  }
  const subtitle = `Android-aware overlay installer for Claude Code  ·  v${GOR_MOBILE_VERSION}`;
  console.log(pc.dim(subtitle));
  console.log("");
}
