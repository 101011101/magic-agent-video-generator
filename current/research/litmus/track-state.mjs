// Rebuilds the state store of a finished litmus test from its frames (vision calls only, no generation).
// Order per scene: start frame, generated end frame, real last kept frame. Sources come from the run's context log.
// Usage: node current/research/litmus/track-state.mjs test-E
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { StateStore } from "../../prod/pipeline-v2/src/state.js";
import { renderState } from "../../prod/pipeline-v2/src/state-page.js";

const DIR = dirname(fileURLToPath(import.meta.url)), test = process.argv[2], out = join(DIR, test);
const log = JSON.parse(readFileSync(join(out, "result.json"), "utf8")), doc = log.doc;
rmSync(join(out, "state.json"), { force: true });
const store = new StateStore(out, Object.fromEntries(doc.assets.map((a) => [a.label, a])));
const typed = (st) => Object.fromEntries(st.visible.filter((l) => store.assets[l]).map((l) => [l, Object.fromEntries((st.assets || []).find((x) => x.label === l)?.attrs?.map((a) => [a.atom, a.value]) || [])]));
let prevLast = null;
for (const s of doc.scenes) {
  const id = `s${s.n}`;
  const startFile = s.link === "cut" ? `${id}-start.png` : prevLast?.file;
  let start = null;
  if (s.link === "cut" && existsSync(join(out, startFile))) {
    const ctx = log.context?.[id];
    const src = {};
    if (ctx?.base) { const r = store.records.find((x) => x.file === ctx.base.file || x.scene === ctx.base.scene && x.role === "last"); if (r) for (const l of s.start.visible) src[l] = r.id; }
    start = await store.add({ file: startFile, scene: s.n, role: "start", location: s.location, expected: typed(s.start), source: src });
  } else start = prevLast;
  const end = existsSync(join(out, `${id}-end.png`)) ? await store.add({ file: `${id}-end.png`, scene: s.n, role: "end", location: s.location, expected: typed(s.end),
    source: Object.fromEntries(s.end.visible.map((l) => [l, start?.id || null])) }) : null;
  if (existsSync(join(out, `${id}-last.png`))) prevLast = await store.add({ file: `${id}-last.png`, scene: s.n, role: "last", location: s.location, expected: typed(s.end),
    source: Object.fromEntries(s.end.visible.map((l) => [l, end?.id || null])) });
  console.log(`scene ${s.n}: ${store.records.length} records`);
}
writeFileSync(join(out, "state.html"), renderState(store, `Litmus ${test.replace("test-", "")}`));
const lin = store.lineage();
for (const [l, xs] of Object.entries(lin)) console.log(l, xs.map((x) => `${x.record}${x.stable ? "✓" : "✗"}`).join(" "));
