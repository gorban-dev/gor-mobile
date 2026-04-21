import { spinner as clackSpinner } from "@clack/prompts";
import { isTuiOn } from "./tui-mode.js";

export interface Spinner {
  start(message: string): void;
  message(message: string): void;
  stop(message: string, code?: number): void;
}

export function spinner(): Spinner {
  if (!isTuiOn()) {
    return {
      start(m) {
        console.log(`  ▸ ${m}`);
      },
      message(m) {
        console.log(`    … ${m}`);
      },
      stop(m) {
        console.log(`  ✓ ${m}`);
      }
    };
  }
  const s = clackSpinner();
  return {
    start(m) {
      s.start(m);
    },
    message(m) {
      s.message(m);
    },
    stop(m, code) {
      s.stop(m, code);
    }
  };
}
