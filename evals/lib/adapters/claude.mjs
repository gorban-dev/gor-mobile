import { ev, GUARD_MARK } from "../events.mjs";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

export function parseClaude(lines) {
  const events = [];
  const meta = { harness: "claude" };
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.type === "system" && m.subtype === "init") meta.model = m.model;
    if (m.type === "assistant") {
      for (const c of m.message?.content ?? []) {
        if (c.type === "text") events.push(ev("text", { text: c.text }));
        if (c.type !== "tool_use") continue;
        const i = c.input ?? {};
        if (c.name === "Skill") events.push(ev("skill", { name: i.skill }));
        else if (c.name === "Read") events.push(ev("read", { path: i.file_path }));
        else if (WRITE_TOOLS.has(c.name)) events.push(ev("write", { path: i.file_path ?? i.notebook_path }));
        else if (c.name === "Bash") events.push(ev("bash", { command: i.command }));
        else events.push(ev("tool", { name: c.name, command: JSON.stringify(i) }));
      }
    }
    if (m.type === "user") {
      for (const c of m.message?.content ?? []) {
        if (c.type === "tool_result" && c.is_error && JSON.stringify(c.content).includes(GUARD_MARK)) {
          events.push(ev("deny"));
        }
      }
    }
    if (m.type === "result") {
      Object.assign(meta, { cost_usd: m.total_cost_usd, turns: m.num_turns, outcome: m.subtype, final_text: m.result });
    }
  }
  return { events, meta };
}