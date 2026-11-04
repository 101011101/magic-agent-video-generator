// The latest agent vs MCP comparison as a page to filter: who won each item, by what margin, how it was decided, and
// the two outputs side by side. Reads a compare.json (bench/mcp/compare.mjs) and judges nothing. Media paths are relative,
// so the page works from bench/v1/serve.mjs (http://localhost:4748/compare-wins/) and opened straight from disk.
// Usage: node V2/bench/v1/wins-view.mjs [--from compare-now] [--out compare-wins]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url)), RES = join(HERE, "results");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg("--from", "compare-now"), OUT = join(RES, arg("--out", "compare-wins"));
const NAMES = { A: "Single images", B: "Image edits", C: "Faces and characters", D: "Short video", E: "Editing the user's video", F: "Sound", G: "Composed pieces", H: "Ads and reels", I: "Longer stories (film)", J: "Conversation" };

const c = JSON.parse(readFileSync(join(RES, FROM, "compare.json"), "utf8"));
const count = (w) => c.rows.filter((r) => r.verdict.winner === w).length;
if (count("agent") !== c.total.wins || count("mcp") !== c.total.losses || count("tie") !== c.total.ties) throw new Error("the rows do not add up to the comparison's own totals");

// a later run of an item than the one compared, so the page can say the comparison does not hold it
const newer = {};
for (const d of readdirSync(RES)) {
  if (/^(mcp|compare|latest$)/.test(d) || c.agent.includes(d) || !statSync(join(RES, d)).isDirectory()) continue;
  for (const r of c.rows) {
    const f = join(RES, d, `${r.id}.json`); if (!existsSync(f)) continue;
    let started; try { started = JSON.parse(readFileSync(f, "utf8")).started; } catch { continue; }
    if (started > r.agent.started && (!newer[r.id] || started > newer[r.id].started)) {
      const g = JSON.parse(readFileSync(join(RES, d, `${r.id}.grade.json`), "utf8"));
      newer[r.id] = { from: d, started, score: g.score, pass: g.pass };
    }
  }
}

// signed download links in a reply are long and expire
const reply = (x) => String(x || "").replace(/\[([^\]]*)\]\(https?:[^)]*\)/g, "[$1]").replace(/https?:\/\/\S+/g, "[link]").replace(/\*\*/g, "");
const step = (s) => ({ tool: s.tool, model: s.model, resolution: s.resolution, credits: s.credits, state: s.state, seconds: s.seconds, inputs: (s.inputs || []).map((i) => i?.name ?? i), produces: s.produces, prompt: s.params?.prompt_or_change || s.params?.prompt || null, why: s.why, error: s.error });
const side = (x) => ({ pass: x.pass, score: x.score, spent: x.spent, seconds: x.seconds, outputs: x.outputs, questions: x.questions, calls: x.calls, models: x.models, denied: (x.denied || []).length, reply: reply(x.reply), summary: x.summary, faults: x.faults, tags: x.tags, kind: x.kind, steps: (x.steps || []).map(step) });

const thumb = (name) => {
  const f = join(HERE, "fixtures", name);
  if (!/\.(png|jpe?g|webp)$/i.test(name) || !existsSync(f)) return { name, src: null };
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "scale=160:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "6", "-"], { maxBuffer: 1 << 24 });
  return { name, src: `data:image/jpeg;base64,${b.toString("base64")}` };
};
const thumbs = {};
const data = {
  at: c.at,
  agentFrom: c.agent, mcpFrom: c.mcp,
  names: Object.fromEntries(Object.entries(NAMES).filter(([k]) => c.groups[k])),
  rows: c.rows.map((r) => ({
    id: r.id, group: r.group, title: r.title, tests: r.tests, prompt: r.prompt,
    materials: r.materials.map((m) => (thumbs[m] ??= thumb(m))),
    // the judge saw the two sides in a fixed order per item (compare.mjs): odd item numbers show the MCP as A
    judgeA: parseInt(r.id.replace(/\D/g, ""), 10) % 2 === 1 ? "mcp" : "agent",
    verdict: r.verdict, newer: newer[r.id] || null,
    agent: side(r.agent), mcp: side(r.mcp),
  })),
};

mkdirSync(OUT, { recursive: true });
const json = JSON.stringify(data).replace(/</g, "\\u003c");
const html = readFileSync(join(HERE, "wins-view.template.html"), "utf8").replace("/*DATA*/", () => json);
writeFileSync(join(OUT, "index.html"), html);
console.log(`${data.rows.length} items · agent ${c.total.wins} · mcp ${c.total.losses} · ties ${c.total.ties} · ${Object.keys(newer).length} with a later run (${Object.keys(newer).join(", ")}) · ${Math.round(html.length / 1024)} KB → ${OUT}/index.html`);
