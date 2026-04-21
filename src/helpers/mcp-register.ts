import { existsSync } from "node:fs";
import { CLAUDE_MCP, MANAGED_TAG } from "../constants.js";
import type { McpConfig, McpServer } from "../types.js";
import { readJsonSafe, writeJson } from "./paths.js";

export function unregisterManaged(): void {
  if (!existsSync(CLAUDE_MCP)) return;
  const cfg = readJsonSafe<McpConfig>(CLAUDE_MCP, {});
  if (!cfg.mcpServers) return;
  const filtered: Record<string, McpServer> = {};
  for (const [name, server] of Object.entries(cfg.mcpServers)) {
    if ((server._managed_by ?? "") !== MANAGED_TAG) {
      filtered[name] = server;
    }
  }
  cfg.mcpServers = filtered;
  writeJson(CLAUDE_MCP, cfg);
}