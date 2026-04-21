import { select, isCancel, cancel } from "@clack/prompts";
import { isTuiOn } from "./tui-mode.js";

export type WizardMode = "quickstart" | "advanced";

export async function modeSelect(defaults: {
  yes: boolean;
  advanced: boolean;
}): Promise<WizardMode> {
  if (defaults.advanced) return "advanced";
  if (defaults.yes) return "quickstart";
  if (!isTuiOn()) return "quickstart";

  const pick = await select<WizardMode>({
    message: "Setup mode",
    options: [
      {
        value: "quickstart",
        label: "QuickStart",
        hint: "Install everything with defaults"
      },
      {
        value: "advanced",
        label: "Advanced",
        hint: "Override rules URL, confirm each step"
      }
    ],
    initialValue: "quickstart"
  });
  if (isCancel(pick)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return pick;
}
