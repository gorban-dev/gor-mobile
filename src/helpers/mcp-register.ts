import { existsSync } from "node:fs";
import { CLAUDE_MCP, MANAGED_TAG } from "../constants.js";
import type { McpConfig, McpServer } from "../types.js";
import { readJsonSafe, writeJson } from "./paths.js";

function ensureMcpFile(): McpConfig {
  if (!existsSync(CLAUDE_MCP)) {
    writeJson(CLAUDE_MCP, { mcpServers: {} });
  }
  return readJsonSafe<McpConfig>(CLAUDE_MCP, { mcpServers: {} });
}

export function hasEntry(name: string): boolean {
  const cfg = readJsonSafe<McpConfig>(CLAUDE_MCP, {});
  return Boolean(cfg.mcpServers && cfg.mcpServers[name]);
}

export function registerGoogleDevKnowledge(): { already: boolean } {
  const cfg = ensureMcpFile();
  if (cfg.mcpServers?.["google-dev-knowledge"]) {
    return { already: true };
  }
  cfg.mcpServers = cfg.mcpServers ?? {};
  const server: McpServer = {
    _managed_by: MANAGED_TAG,
    command: "npx",
    args: ["-y", "@anthropic/mcp-google-dev-knowledge@latest"]
  };
  cfg.mcpServers["google-dev-knowledge"] = server;
  writeJson(CLAUDE_MCP, cfg);
  return { already: false };
}

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
