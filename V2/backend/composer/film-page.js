// The finished-product page: V2/results/<label>-film/index.html. The film first, then the cut in order (one row per
// shot: the clip, its two keyframes, the scene heading, the moment, what is said and shown), then the cost. Nothing about
// prompts or attempts: that is the run page (results.js). Usage: node V2/backend/composer/film-page.js <label>
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RESULTS, RUNS } from "../lib/env.js";
import { normalizeShots } from "./screenplay/screenplay.js";
import { State } from "./state/state.js";

const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function writeFilmPage(label) {
  const dir = join(RUNS, label), out = join(RESULTS, `${label}-film`), rel = (f) => `../../runs/${label}/${f}`;
  const L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), run = { name: label, path: (f) => join(dir, f), save() {}, log: L };
  L.script = normalizeShots(L.script);
  const state = new State({ log: L, run, script: L.script, elements: L.elements, bank: L.bank, features: L.features, voices: L.voices });
  const K = L.build || {}, P = K.painted || {}, M = K.made || {}, name = (id) => state.name(id);
  const scene = (n) => L.script.scenes.find((s) => s.n === n), shotOf = (c) => scene(c.scene).shots.find((h) => h.n === c.n);
  const film = K.film && existsSync(join(dir, K.film)) ? K.film : null;
  const total = L.script.scenes.reduce((n, s) => n + s.seconds, 0), made = state.clips.filter((c) => M[c.n]?.clip).length;
  mkdirSync(out, { recursive: true });
  const rows = state.clips.map((c) => {
    const h = shotOf(c), sc = scene(c.scene), m = M[c.n], a = P[c.start], b = P[c.end];
    const said = h.lines.map((l) => `<div class="line"><b>${esc(name(l.who))}</b> ${esc(l.text)}</div>`).join("");
    const caps = sc.captions.filter((x) => x.at >= h.start && x.at < h.start + h.seconds).map((x) => `<div class="cap">${esc(x.text.replace(/\n/g, " / "))}</div>`).join("");
    const vo = (h.vo || []).map((v) => `<div class="vo">narration: ${esc(v.text)}</div>`).join("");
    const status = m?.clip ? (m.card ? "title card" : `${m.sequence ? `part of sequence ${m.sequence} · ` : ""}${m.identity?.ok ? "clip ok" : `clip flagged · ${esc(m.identity?.note || "")}`}`) : m?.error ? `failed · ${esc(m.error)}` : "clip not made";
    return `<section class="shot"><div class="head"><b>shot ${c.n}</b><span>${h.start}–${h.start + h.seconds} s · ${esc(h.size)}</span><span class="mut">${sc.inside ? "INT." : "EXT."} ${esc(name(sc.place))}, ${esc(sc.time.toLowerCase())}</span><span class="${m?.clip && (m.card || m.identity?.ok) ? "ok" : "bad"}">${status}</span></div>
<p class="moment">${esc(h.moment)}</p>
<div class="row">${m?.clip ? `<video controls preload="metadata" src="${rel(m.clip)}"></video>` : `<div class="missing">not made</div>`}
<div class="frames"><div><div class="fl">first frame · ${esc(c.start)}</div>${a ? `<img src="${rel(a.file)}">` : `<div class="missing small">not painted</div>`}</div><div><div class="fl">last frame · ${esc(c.end)}</div>${b ? `<img src="${rel(b.file)}">` : `<div class="missing small">not painted</div>`}</div></div></div>
${said || caps || vo ? `<div class="text">${caps}${said}${vo}</div>` : ""}</section>`;
  });
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(L.story?.title || label)}</title><style>
body{margin:0;padding:28px 32px;background:#0b0b0b;color:#eaeaea;font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:1400px}
h1{font:700 22px ui-monospace,monospace;margin:0 0 4px}.sub{color:#8a8a8a;font:12px ui-monospace,monospace;margin:0 0 22px}
.film{margin:0 0 36px}.film video{width:100%;border-radius:8px;background:#000}.film .missing{padding:70px}
h2{font:700 12px ui-monospace,monospace;letter-spacing:.12em;color:#8ab4ff;margin:30px 0 12px}
.shot{border-top:1px solid #222;padding:18px 0 22px}.head{display:flex;gap:16px;align-items:baseline;font:12.5px ui-monospace,monospace;color:#bbb}.head b{font-size:15px;color:#fff}
.mut{color:#777}.ok{color:#7fd}.bad{color:#ff7a86}.moment{margin:6px 0 10px;color:#ddd;font-style:italic}
.row{display:grid;grid-template-columns:minmax(0,58%) minmax(0,42%);gap:14px;align-items:start}.row video{width:100%;border-radius:6px;background:#000}
.frames{display:grid;grid-template-columns:1fr 1fr;gap:8px}.frames img{width:100%;border-radius:4px;display:block}.fl{font:10.5px ui-monospace,monospace;color:#8ab4ff;margin:0 0 4px}
.missing{color:#666;font:12px ui-monospace,monospace;padding:46px;background:#000;border-radius:6px;text-align:center}.missing.small{padding:24px}
.text{margin:10px 0 0;font:12.5px ui-monospace,monospace}.line{color:#eee;margin:2px 0}.line b{color:#8ab4ff;margin-right:6px}.cap{color:#ffd37f}.vo{color:#9fd}
.cost{font:12px ui-monospace,monospace;color:#999;border-top:1px solid #222;padding-top:14px}
</style>
<h1>${esc(L.story?.title || label)}</h1><p class="sub">${esc(label)} · ${total} s · ${L.script.scenes.length} scenes · ${state.clips.length} shots · ${film ? "film stitched" : `${made} of ${state.clips.length} clips made, film not stitched yet`}</p>
<div class="film">${film ? `<video controls src="${rel(film)}"></video>` : `<div class="missing">the film is not stitched yet</div>`}</div>
<h2>THE CUT</h2>${rows.join("\n")}
<p class="cost">credits on this run: ${L.summary?.credits ?? 0} · ${(L.calls || []).filter((c) => c.credits).length} paid jobs · page written ${new Date().toISOString().slice(0, 16).replace("T", " ")}</p>`;
  writeFileSync(join(out, "index.html"), html);
  return join(out, "index.html");
}

if (process.argv[1] && process.argv[1].endsWith("film-page.js")) { const label = process.argv[2]; if (!label) { console.error("usage: node V2/backend/composer/film-page.js <label>"); process.exit(2); } console.log(writeFilmPage(label)); }
