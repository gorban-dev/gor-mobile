export function caseRates(rows) {
  const acc = new Map();
  for (const r of rows) {
    const k = `${r.harness}|${r.case}`;
    const cell = acc.get(k) ?? {};
    const v = (cell[r.variant] ??= { pass: 0, n: 0 });
    v.pass += r.pass ? 1 : 0;
    v.n += 1;
    acc.set(k, cell);
  }
  const out = new Map();
  for (const [k, cell] of acc) {
    out.set(k, Object.fromEntries(Object.entries(cell).map(([v, s]) => [v, s.pass / s.n])));
  }
  return out;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function pairedDelta(rates, a, b, { seed = 1, iters = 2000 } = {}) {
  const d = [...rates.values()].filter((c) => a in c && b in c).map((c) => c[b] - c[a]);
  if (d.length === 0) return { mean: 0, lo: 0, hi: 0, n: 0 };
  const rnd = mulberry32(seed);
  const boots = Array.from({ length: iters }, () => mean(d.map(() => d[Math.floor(rnd() * d.length)]))).sort((x, y) => x - y);
  return { mean: mean(d), lo: boots[Math.floor(iters * 0.025)], hi: boots[Math.floor(iters * 0.975)], n: d.length };
}

// Spec protocol: both splits up → keep; any regression beyond noise → revert;
// train up with flat test → revert (overfit); otherwise noise.
export function verdict({ train, test, noise }) {
  const up = (x) => x.lo > 0 && x.mean >= noise;
  const down = (x) => x.hi < 0 && -x.mean >= noise;
  if (down(train) || down(test)) return "revert";
  if (up(train) && up(test)) return "keep";
  if (up(train)) return "revert";
  return "noise";
}