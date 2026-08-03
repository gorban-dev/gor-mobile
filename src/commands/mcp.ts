import { CODEX_CONFIG_TOML, DEV_KNOWLEDGE_MCP_NAME, GOR_MOBILE_VERSION } from "../constants.js";
import { codexMcpState, installCodexDevKnowledgeMcp } from "../helpers/codex-mcp.js";
import {
  captureDevKnowledgeKey,
  KEY_SOURCE_LABEL,
  offerDevKnowledgeLinks,
  persistDevKnowledgeKey,
  printDevKnowledgeGuide,
  resolveDevKnowledgeKey
} from "../helpers/dev-knowledge.js";
import {
  approveProjectMcpServers,
  projectMcpState,
  registerProjectMcp
} from "../helpers/mcp-register.js";
import { findProjectRoot, readProjectMarker, writeProjectMarker } from "../helpers/project.js";
import { agentHomeExists, projectClaudeSpec } from "../targets.js";
import { confirmStep } from "../ui/confirm-step.js";
import { log } from "../ui/log.js";
import { forceNoTui, isTuiOn } from "../ui/tui-mode.js";

export interface McpOptions {
  noTui?: boolean;
  tui?: boolean;
}

export async function cmdMcp(opts: McpOptions = {}): Promise<void> {
  if (opts.noTui || opts.tui === false) forceNoTui();

  log.step(`Documentation sources — ${DEV_KNOWLEDGE_MCP_NAME}`);

  // Project half: register + approve, idempotently.
  const root = findProjectRoot();
  if (root) {
    const spec = projectClaudeSpec(root);
    const marker = readProjectMarker(root);
    const res = registerProjectMcp(root, marker.managed_mcp ?? []);
    if (res.written) {
      approveProjectMcpServers(spec.hooksFile, [DEV_KNOWLEDGE_MCP_NAME]);
      writeProjectMarker(root, {
        ...marker,
        version: GOR_MOBILE_VERSION,
        managed_mcp: [...new Set([...(marker.managed_mcp ?? []), DEV_KNOWLEDGE_MCP_NAME])]
      });
    }
    const st = projectMcpState(root, spec.hooksFile);
    log.ok(`${res.path} — server ${st.present ? "present" : "missing"}, approval ${st.approved ? "set" : "missing"}`);
    if (st.approved) {
      log.muted("Approval applies once you have trusted this repo in Claude Code.");
    }
  } else {
    log.info("Not inside a gor-mobile repo — skipped the project half (run 'gor-mobile init').");
  }

  // Machine half: the key, then the Codex table.
  const resolved = resolveDevKnowledgeKey();
  let key = resolved.key;
  if (key) {
    log.ok(`API key found (${KEY_SOURCE_LABEL[resolved.source]})`);
    if (isTuiOn() && (await confirmStep("Replace the stored API key?", false))) {
      const next = await captureDevKnowledgeKey();
      if (next) {
        key = next;
        log.ok("API key replaced");
      }
    }
    persistDevKnowledgeKey(key);
  } else {
    printDevKnowledgeGuide();
    const entered = await captureDevKnowledgeKey();
    if (entered) {
      key = entered;
      persistDevKnowledgeKey(entered);
      log.ok("API key stored in ~/.claude/settings.json env");
    } else {
      log.warn("No API key — the server stays configured but will not connect");
    }
  }

  if (agentHomeExists("codex")) {
    const st = codexMcpState();
    if (st.foreign) {
      log.info(`${CODEX_CONFIG_TOML} has an unmanaged entry — left as is`);
    } else {
      installCodexDevKnowledgeMcp(key, { force: st.managed });
      log.ok(`${CODEX_CONFIG_TOML} — ${key ? "http_headers" : "env_http_headers"}`);
    }
  }

  if (!key) await offerDevKnowledgeLinks();
}
