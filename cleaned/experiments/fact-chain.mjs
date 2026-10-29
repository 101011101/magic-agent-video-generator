// Paint one scene of a fact-film plan as a keyframe chain, from its state table: frame 1 from the place reference + the character
// references, every later frame from the previous frame (+ a reference for whoever enters). Title cards and captions are overlays
// for the edit, not frames, so keyframes that only add one are skipped. Magic Hour image editor, nano-banana-pro, 2k, 200 per frame.
// Usage: CLEANED_CAP=… node cleaned/experiments/fact-chain.mjs --label vanderbilt --scene 1
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";
import { Jobs } from "../src/jobs.js";
import { framing } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt"), k = Number(opt("--scene", 1));
const dir = join(RUNS, `exp-${label}`); mkdirSync(join(dir, "frames"), { recursive: true }); mkdirSync(join(dir, `page-s${k}`), { recursive: true });
const run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), byId = Object.fromEntries(L.elements.map((e) => [e.id, e]));
const rows = L.state_table.filter((r) => r.scene === k), kf = L.keyframes[k];
const isOverlay = (r) => /\b(title|caption)\b/i.test(r.source || "") && !/\b(stands?|holds?|walks?|sits?)\b/i.test(r.source || "");
// A keyframe whose only change is who is speaking is not a new picture: the line is folded into the previous frame's spoken
// lines for the audio stage (TTS + lip sync, or a dialogue clip).
// A dialogue line is its own keyframe only if the text makes something visible happen; "X addresses Y" is speech. The beat number
// is optional: the keyframe call quoted lines without it in vanderbilt2 and five speech frames were painted.
const isSpeech = (r) => /^\s*(\d+\.\s*)?[A-Z][A-Z .'-]+:\s*["“]/.test(r.source || "") && /\bspeaker\b|\baddress(es|ing)\b|\bsays\b|\basks\b|\banswers\b|\breplies\b/i.test(r.prompt.split("Change ONLY this: ")[1] || "");
const lineOf = (r) => { const m = (r.source || "").match(/^\s*(?:\d+\.\s*)?([A-Z][A-Z .'-]+):\s*["“]([^"”]+)["”]/); return m ? { who: m[1].trim(), text: m[2] } : null; };

const made = [], skipped = [];
let prevFile = null;
for (const r of rows) {
  if (r.frame > 1 && isOverlay(r)) { skipped.push({ frame: r.frame, source: r.source }); console.log(`  frame ${r.frame}: overlay (${r.source.slice(0, 60)}), skipped`); continue; }
  if (r.frame > 1 && isSpeech(r) && made.length) { const l = lineOf(r); (made.at(-1).spoken ??= []).push(l); skipped.push({ frame: r.frame, source: r.source, spoken: true }); console.log(`  frame ${r.frame}: speech only (${l?.who}: "${l?.text.slice(0, 50)}…"), folded into frame ${made.at(-1).frame}`); continue; }
  // Style is state (PRD §4b): a state table written before style_ref existed (or a style_ref set by hand in run.json) still gets the
  // reference as the last image of frame 1 when its plate is not the reference itself; the row is patched so the record matches
  // what was sent. Later frames inherit the treatment through the previous frame.
  if (r.frame === 1 && L.style_ref && r.inputs[0]?.role === "place reference" && r.inputs[0].file !== L.style_ref && !r.inputs.some((i) => i.role === "style reference")) {
    r.inputs.push({ role: "style reference", id: Object.keys(L.bank).find((x) => L.bank[x].file === L.style_ref), file: L.style_ref });
    const line = `Image ${r.inputs.length} matches the colour treatment, grain and contrast every frame must have.`, at = " Put this moment into image 1";
    r.prompt = r.prompt.includes(at) ? r.prompt.replace(at, ` ${line}${at}`) : `${line}\n${r.prompt}`;
  }
  const inputs = r.inputs.map((i) => (i.role === "previous frame" ? prevFile : i.file)).filter(Boolean);
  if (r.frame > 1 && !prevFile) throw new Error("no previous frame");
  const file = `frames/s${k}-f${r.frame}.png`;
  console.log(`frame ${r.frame} ← ${inputs.join(", ")}`);
  await jobs.image(`chain-s${k}-f${r.frame}`, file, r.prompt, inputs);
  const fr = prevFile ? framing(run.path(file), run.path(prevFile)) : null;
  if (fr) console.log(`  framing vs previous: ssim ${fr.ssim}, corner shift ${fr.corner_shift}`);
  made.push({ frame: r.frame, file, inputs, prompt: r.prompt, source: r.source, framing: fr });
  prevFile = file;
}
(L.chain ??= {})[k] = { frames: made, skipped, credits: made.length * 200 }; run.save();

// Page: inputs, each frame with its prompt.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const jpg = (f) => { const out = `page-s${k}/${f.replace(/\//g, "-").replace(/\.(png|jpg)$/, ".jpg")}`; if (!existsSync(run.path(out))) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(f), "-vf", "scale='min(1400,iw)':-1", "-q:v", "5", run.path(out)]); return out.split("/")[1]; };
const refs = [...new Set(rows.flatMap((r) => r.inputs.filter((i) => i.file).map((i) => i.file)))];
const refHtml = refs.map((f) => { const id = Object.keys(L.bank).find((x) => L.bank[x].file === f), b = L.bank[id] || {}; return `<div><p class="mut">${esc(byId[id]?.name || id)} · ${b.source === "commons" ? `Commons: <a href="${b.page}">${esc(b.title)}</a>` : b.source}</p><img src="${jpg(f)}" alt="${esc(id)}"></div>`; }).join("");
const frameHtml = made.map((m) => `<section class="card"><h2>Frame ${m.frame}${m.framing ? ` <span class="mut">SSIM to previous ${m.framing.ssim}, corner shift ${m.framing.corner_shift}</span>` : ""}</h2><p class="mut">inputs: ${m.inputs.map(esc).join(", ")} · from: ${esc(m.source)}</p><img src="${jpg(m.file)}" alt="frame ${m.frame}">${m.spoken?.length ? `<p class="mut">spoken over this frame (audio stage): ${m.spoken.map((l) => `<strong>${esc(l.who)}</strong>: “${esc(l.text)}”`).join(" · ")}</p>` : ""}<details><summary>prompt as sent</summary><pre>${esc(m.prompt)}</pre></details></section>`).join("");
const sc = L.screenplay.scenes[k - 1];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(L.story.title)} S${k}</title>
<style>:root{--bg:#f4f5f2;--panel:#fff;--fg:#1c211e;--mut:#5f6863;--line:#dbe0dc;--mono:ui-monospace,Menlo,monospace}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e}}:root[data-theme="dark"]{--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1150px;margin:0 auto;padding:16px;display:grid;gap:16px}h1{font-size:22px;margin:0}h2{font-size:17px;margin:0}.mut{color:var(--mut);font-size:13px;font-weight:400}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:10px}img{width:100%;border-radius:6px;border:1px solid var(--line);display:block}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
pre{margin:0;padding:10px;background:var(--bg);border:1px solid var(--line);border-radius:6px;font:12.5px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}details summary{cursor:pointer;color:var(--mut);font-size:13px}a{color:inherit}</style></head><body><main>
<h1>${esc(L.story.title)}: scene ${k} keyframes</h1>
<p class="mut">${esc(`${sc.inside ? "INT." : "EXT."} ${sc.place} — ${sc.time}`)} · ${made.length} frames at 200 credits, ${skipped.length} overlay keyframe${skipped.length === 1 ? "" : "s"} skipped (${skipped.map((s) => esc(s.source.slice(0, 50))).join("; ") || "none"}). Each frame is an edit of the one before; frame 1 is made from the place reference and the portraits.</p>
<section class="card"><h2>References the state manager gave the editor</h2><div class="row">${refHtml}</div></section>
${frameHtml}
<section class="card"><h2>Scene as written</h2><pre>${esc(sc.beats.map((b, i) => `${i + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n"))}</pre></section>
</main></body></html>`;
writeFileSync(join(dir, `page-s${k}`, "index.html"), html);
console.log(`done: ${made.length} frames, ${jobs.spent()} credits in this run so far · page-s${k}/index.html`);
