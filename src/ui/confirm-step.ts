import { confirm, isCancel, cancel } from "@clack/prompts";
import { isTuiOn } from "./tui-mode.js";

export async function confirmStep(message: string, fallback = true): Promise<boolean> {
  if (!isTuiOn()) return fallback;
  const res = await confirm({ message, initialValue: fallback });
  if (isCancel(res)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return res === true;
}

export async function textPrompt(
  message: string,
  initial: string,
  validate?: (v: string) => string | undefined
): Promise<string> {
  if (!isTuiOn()) return initial;
  const { text } = await import("@clack/prompts");
  const res = await text({ message, initialValue: initial, validate });
  if (isCancel(res)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return String(res);
}

/**
 * Masked single-line input. Returns "" when the user submits nothing or when
 * the TUI is off — callers treat that as "skipped", never as a key.
 */
export async function passwordPrompt(message: string): Promise<string> {
  if (!isTuiOn()) return "";
  const { password } = await import("@clack/prompts");
  const res = await password({ message });
  if (isCancel(res)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return String(res ?? "").trim();
}
