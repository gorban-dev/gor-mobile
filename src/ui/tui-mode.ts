/**
 * TUI mode is off when NO_TUI=1, or when stdin/stdout is not a TTY,
 * or when --yes is passed (non-interactive).
 *
 * Callers query `isTuiOn()` before reaching for @clack prompts and fall back
 * to plain log output + defaults.
 */
let forcedOff = false;

export function forceNoTui(): void {
  forcedOff = true;
}

export function isTuiOn(): boolean {
  if (forcedOff) return false;
  if (process.env.NO_TUI === "1") return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  return true;
}
