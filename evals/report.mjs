#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { caseRates, pairedDelta, verdict } from "./lib/stats.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { base: { type: "string" }, cand: { type: "string" }, noise: { type: "string", default: "0.05" } }
});
const file = positionals[0];
const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const { base, cand } = values;
const noise = Number(values.noise);
const pct = (x) => `${(x * 100).toFixed(1)}`;
const fmt = (d) => `${pct(d.mean)} [${pct(d.lo)}, ${pct(d.hi)}] n=${d.n}`;

const out = [`# Eval report: ${base} → ${cand}`, "", `noise threshold ${pct(noise)} п.п.`, ""];
for (const harness of [...new Set(rows.map((r) => r.harness))]) {
  const hr = rows.filter((r) => r.harness === harness);
  const train = pairedDelta(caseRates(hr.filter((r) => r.split === "train")), base, cand);
  const test = pairedDelta(caseRates(hr.filter((r) => r.split === "test")), base, cand);
  out.push(`## ${harness}: ${verdict({ train, test, noise })}`, "", `- train Δ ${fmt(train)}`, `- test Δ ${fmt(test)}`);
  const errors = hr.filter((r) => r.error).length;
  if (errors) out.push(`- прогонов с ошибкой: ${errors} (в pass-rate считаются провалом)`);
  const cost = (v) => hr.filter((r) => r.variant === v).reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const tokens = (v) => hr.filter((r) => r.variant === v).reduce((s, r) => s + (r.tokens ?? 0), 0);
  out.push(`- стоимость ${base}/${cand}: $${cost(base).toFixed(2)} / $${cost(cand).toFixed(2)}; токены ${tokens(base)} / ${tokens(cand)}`, "");
  out.push("| case | split | " + base + " | " + cand + " |", "|---|---|---:|---:|");
  const rates = caseRates(hr);
  for (const [k, cell] of rates) {
    const c = k.split("|")[1];
    const split = hr.find((r) => r.case === c)?.split ?? "";
    const cellFmt = (v) => (v in cell ? pct(cell[v]) : "—");
    out.push(`| ${c} | ${split} | ${cellFmt(base)} | ${cellFmt(cand)} |`);
  }
  out.push("");
}
const md = out.join("\n");
writeFileSync(join(dirname(file), "report.md"), md);
console.log(md);