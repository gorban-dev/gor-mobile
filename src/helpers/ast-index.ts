import { which } from "./deps.js";

export const AST_INDEX_REPO_URL =
  "https://github.com/defendend/Claude-ast-index-search";

export const AST_INDEX_INSTALL_SNIPPET =
  "brew tap defendend/ast-index && brew install ast-index";

export function astIndexPath(): string | null {
  return which("ast-index");
}