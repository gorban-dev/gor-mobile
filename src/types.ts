export interface HookCommand {
  type: "command";
  command: string;
}

export interface HookEntry {
  _managed_by?: string;
  matcher: string;
  hooks: HookCommand[];
}

export interface StatusLineEntry {
  type: "command";
  command: string;
  _managed_by?: string;
}

export interface ManagedSettings {
  hooks?: Record<string, HookEntry[]>;
  statusLine?: StatusLineEntry;
  [key: string]: unknown;
}

export interface McpServer {
  _managed_by?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface McpConfig {
  mcpServers?: Record<string, McpServer>;
  [key: string]: unknown;
}

export interface RulesManifest {
  name?: string;
  version?: string;
  stack?: string;
  compatible_with?: string;
  sections?: Record<string, string>;
  [key: string]: unknown;
}

export interface GorMobileConfig {
  rules_source?: string;
  rules_ref?: string;
  preset?: string;
}
