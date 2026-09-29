import { ev, GUARD_MARK } from "../events.mjs";

// Codex has no Skill tool: it reads skills/<name>/SKILL.md with whatever
// command it picks (cat, sed -n, nl, rg), so match the path, not the utility.
const SKILL_RE = /skills\/(gor-mobile-[a-z0-9-]+)\/SKILL\.md/g;

export function unwrapShell(cmd) {
  const m = /^\S*sh -lc '([\s\S]*)'$/.exec(cmd);
  return m ? m[1].replace(/'\\''/g, "'") : cmd;
}

export function parseCodex(lines) {
  const events = [];
  const meta = { harness: "codex", input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.type === "turn.completed") {
      for (const k of ["input_tokens", "cached_input_tokens", "output_tokens"]) meta[k] += m.usage?.[k] ?? 0;
    }
    if (m.type !== "item.completed") continue;
    const it = m.item ?? {};
    if (it.type === "agent_message") {
      events.push(ev("text", { text: it.text }));
      meta.final_text = it.text;
    } else if (it.type === "command_execution") {
      const command = unwrapShell(it.command ?? "");
      for (const s of command.matchAll(SKILL_RE)) events.push(ev("skill", { name: s[1] }));
      events.push(ev("bash", { command }));
      if (String(it.aggregated_output ?? "").includes(GUARD_MARK)) events.push(ev("deny"));
    } else if (it.type === "file_change") {
      for (const ch of it.changes ?? []) events.push(ev("write", { path: ch.path }));
    }
  }
  return { events, meta };
}