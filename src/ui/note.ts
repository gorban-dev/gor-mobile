import { note as clackNote } from "@clack/prompts";
import pc from "picocolors";
import { isTuiOn } from "./tui-mode.js";

export function note(body: string, title?: string): void {
  if (isTuiOn()) {
    clackNote(body, title);
    return;
  }
  if (title) {
    console.log("");
    console.log(pc.bold(title));
  }
  for (const line of body.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("");
}
