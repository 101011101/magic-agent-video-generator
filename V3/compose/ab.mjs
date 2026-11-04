// A side-by-side page for two V3 runs of the same sequence. Usage: node V3/compose/ab.mjs --a <label> --b <label> --names "A: case 1 (words only)|B: case 3 (premade still)" --out V3/runs/<dir>/ab.html [--judge <label whose judge/judge.json compares them>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { V3 } from "./paths.mjs";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const A = opt("--a"), B = opt("--b"), [nameA, nameB] = (opt("--names") || `${A}|${B}`).split("|"), out = resolve(opt("--out")), J = opt("--judge", B);
const outDir = dirname(out), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const load = (l) => { const d = join(V3, "runs", l), r = JSON.parse(readFileSync(join(d, "compose.json"), "utf8")); const best = r.attempts.find((a) => a.key === r.outputs?.chosen) || r.attempts.at(-1); return { l, d, r, best, rel: (f) => relative(outDir, join(d, f)) }; };
const a = load(A), b = load(B), judge = existsSync(join(V3, "runs", J, "judge/judge.json")) ? JSON.parse(readFileSync(join(V3, "runs", J, "judge/judge.json"), "utf8")) : null;
const badge = (v) => `<span class="b ${v === "yes" || v === true ? "ok" : v === "partly" || v === "unclear" ? "mid" : "bad"}">${esc(v === true ? "yes" : v === false ? "no" : v)}</span>`;
const side = (x, name, extra = "") => `<div class="col"><h2>${esc(name)}</h2>${extra}
<video controls preload="metadata" src="${esc(x.rel(x.r.outputs.clip))}"></video>
<p class="mut">${esc(x.best.key)} · ${x.best.model} ${x.best.start_frame ? "image-to-video from the still" : "text-to-video"} · ${x.best.seconds} s · audio ${x.best.audio ? "on" : "off"} · ${x.r.credits} credits in all (${x.r.attempts.length} attempt${x.r.attempts.length === 1 ? "" : "s"}) · own review ${badge(x.best.review?.pass ? "yes" : "no")}</p>
<div class="frames">${[x.best.frames.first, ...x.best.frames.beats, x.best.frames.last].map((f, i) => `<figure><img src="${esc(x.rel(f))}" loading="lazy"><figcaption>${i === 0 ? "first" : i === x.best.frames.beats.length + 1 ? "last" : `beat ${i} · ${x.best.frames.times[i - 1]} s`}</figcaption></figure>`).join("")}</div>
${x.best.transcript ? `<p class="mut">heard: ${x.best.transcript.map((g) => `[${g.from}–${g.to} s] ${esc(g.text)}`).join(" ")}</p>` : ""}
<details><summary>review</summary><table>${x.best.review.beats.map((q) => `<tr><td>beat ${q.beat}</td><td>${badge(q.subject_present)} ${badge(q.action_seen)}</td><td class="mut">${esc(q.evidence)}</td></tr>`).join("")}${(x.best.review.identity || []).map((q) => `<tr><td>identity</td><td>${badge(q.same_as_reference)}</td><td class="mut">${esc(q.carried)}: ${esc(q.evidence)}</td></tr>`).join("")}</table><p class="mut">failures: ${esc(x.best.review.failures.join("; ") || "none")}</p></details>
<details><summary>prompt sent (${x.best.prompt.length} chars)</summary><pre>${esc(x.best.prompt)}</pre></details></div>`;
const allRefs = b.r.reference ? [{ name: b.r.reference.name || "reference", file: b.r.reference.file, from: b.r.reference.from, seen: (b.r.reference.seen?.people || []).map((p) => `${p.who}: ${p.look}`).join(" · ") }, ...(b.r.extra_refs || []).map((x) => ({ name: x.name, file: x.file, from: x.from, seen: x.seen?.summary || "" }))] : [];
const mode = b.r.attempts?.[0]?.references ? `sent as ${allRefs.length} named references (@${allRefs.map((x) => x.name).join(" @")}) to ${esc(b.r.attempts[0].model)}` : b.r.seed?.no_edit ? "used directly as the start frame" : "the seed still was edited from";
const refBlock = allRefs.length ? `<div class="ref"><b>The reference${allRefs.length > 1 ? "s" : ""} · ${mode}</b><div class="frames" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${allRefs.map((x) => `<figure><img src="${esc(b.rel(x.file))}"><figcaption>@${esc(x.name)} · ${esc(x.from)}<br>${esc(x.seen)}</figcaption></figure>`).join("")}</div>${b.r.seed_attempts?.length ? `<p>seed stills made from it:</p><div class="frames">${b.r.seed_attempts.map((s) => `<figure><img src="${esc(b.rel(s.file))}"><figcaption>${esc(s.key)} · ${s.pass ? "PASS" : "FAIL"}</figcaption></figure>`).join("")}</div>` : ""}</div>` : "";
const other = judge ? Object.keys(judge.scores).find((k) => k !== J) : null, pair = judge ? Object.values(judge.pairs)[0] : null;
const html = `<!doctype html><meta charset="utf-8"><title>A/B · ${esc(A)} vs ${esc(B)}</title>
<style>:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--ok:#1d7a3d;--bad:#b3261e;--mid:#9a6b00;--card:#fff}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--card:#1d1a15;color-scheme:dark}}:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--card:#1d1a15;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1400px;margin-inline:auto}
h1{font-size:21px;margin:0 0 6px}h2{font-size:17px;margin:0 0 8px}.mut{color:var(--mut)}.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:900px){.two{grid-template-columns:1fr}}
.col{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;min-width:0}video{width:100%;border-radius:8px;background:#000}
.frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin-top:8px}figure{margin:0}figure img{width:100%;border-radius:5px;border:1px solid var(--line)}figcaption{font-size:11px;color:var(--mut)}
.ref{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:14px 0}.ref img{max-width:520px;width:100%;border-radius:6px;display:block;margin-top:6px}
.b{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11.5px;font-weight:600;color:#fff;margin-right:3px}.b.ok{background:var(--ok)}.b.bad{background:var(--bad)}.b.mid{background:var(--mid)}
table{border-collapse:collapse;width:100%;font-size:13px}td{border-bottom:1px solid var(--line);padding:4px 6px;vertical-align:top}pre{white-space:pre-wrap;font-size:12px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px}
.verdict{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:14px 0}</style>
<h1>Clip 1 A/B · ${esc(nameA)} vs ${esc(nameB)}</h1>
<p class="mut">${esc(a.r.brief)}</p>
${judge ? `<div class="verdict"><b>Judge:</b> ${esc(nameA)} <b>${judge.scores[other]?.score}</b> · ${esc(nameB)} <b>${judge.scores[J]?.score}</b> · pairwise winner <b>${pair.winner_side === J ? esc(nameB) : esc(nameA)}</b> (${esc(pair.strength)}; ${pair.first === J ? "B" : "A"} was shown first) · ${esc(pair.why)}
<table>${judge.scores[J].must_haves.map((m, i) => `<tr><td>${esc(m.item)}</td><td>A ${badge(judge.scores[other].must_haves[i]?.met)}</td><td>B ${badge(m.met)}</td></tr>`).join("")}</table></div>` : ""}
${refBlock}
<div class="two">${side(a, nameA)}${side(b, nameB)}</div>`;
writeFileSync(out, html); console.log(`wrote ${out}`);
