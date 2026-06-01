import { select, isCancel, cancel } from "@clack/prompts";
import { isTuiOn } from "./tui-mode.js";
import { note } from "./note.js";
import type { StatusLineVariant } from "../helpers/settings-statusline.js";

export type StatusLineChoice = StatusLineVariant | "skip";

const CLASSIC_PREVIEW = [
  "Context  ━━━━━━─────────  42%  of 200k",
  "5h limit ━━━────────────  18%  resets 14:30  ▽ off-peak",
  "7d limit ━━━━━━━━━──────  61%  resets Jun 04 09:00",
  "(colored in a real terminal)"
].join("\n");

const CAT_PREVIEW = [
  "                          /\\_/\\",
  "                         ( o.o )",
  "Sonnet 4.6 (200k) ▬▬▬▬▬▬▬▬▬▬▬──────────────  42%",
  "5h ▬────── 18% 14:30 ▽ off-peak  |  7d ▬▬▬▬─── 61% Jun 04  |  ⏱ session 1h12m",
  "(face shifts ^.^ → o.o → >.< → @.@ → x_x as context fills)"
].join("\n");

export function showStatusLinePreviews(): void {
  note(CLASSIC_PREVIEW, "Classic — 3-line colored bars");
  note(CAT_PREVIEW, "Cat — ASCII cat, reacts to context usage");
}

// Returns "skip" non-interactively (--yes or no TUI). Otherwise shows previews
// then a 3-way select defaulting to Skip.
export async function statusLineSelect(yes: boolean): Promise<StatusLineChoice> {
  if (yes || !isTuiOn()) return "skip";
  showStatusLinePreviews();
  const pick = await select<StatusLineChoice>({
    message: "Status line (optional)",
    options: [
      { value: "command", label: "Classic", hint: "3-line colored bars" },
      { value: "cat", label: "Cat", hint: "ASCII cat that reacts to usage" },
      { value: "skip", label: "Skip", hint: "don't install a status line" }
    ],
    initialValue: "skip"
  });
  if (isCancel(pick)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return pick;
}