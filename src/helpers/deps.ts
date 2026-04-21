import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

export function which(cmd: string): string | null {
  const PATH = process.env.PATH ?? "";
  for (const dir of PATH.split(delimiter)) {
    if (!dir) continue;
    const full = join(dir, cmd);
    try {
      accessSync(full, constants.X_OK);
      return full;
    } catch {
      // next
    }
  }
  return null;
}

export function has(cmd: string): boolean {
  return which(cmd) !== null;
}

export function androidCliPath(): string | null {
  return which("android");
}
