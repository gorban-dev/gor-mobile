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
