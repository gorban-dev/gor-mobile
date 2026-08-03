import { execa } from "execa";
import { which } from "./deps.js";

/**
 * Open `url` in the user's default browser. Returns false when no opener is
 * on PATH (headless box, hermetic test PATH) so callers can fall back to
 * printing the URL instead of pretending it worked.
 */
export function openUrl(url: string): boolean {
  let cmd: string;
  let args: string[];
  if (process.platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (process.platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  // cmd.exe is not resolvable through the PATH walk in deps.ts (no extension
  // handling), so the availability check is POSIX-only.
  if (process.platform !== "win32" && !which(cmd)) return false;
  try {
    const child = execa(cmd, args, {
      detached: true,
      stdio: "ignore",
      reject: false
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
