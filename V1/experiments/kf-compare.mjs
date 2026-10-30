// One page showing what the pipeline sends, from the story to the keyframe prompts: the story (collapsed), the screenplay,
// then per keyframe the images that are sent (thumbnails, with what each is) and the prompt, chunk by chunk, each chunk
// labelled with where its text comes from; KF variants side by side. The painted still appears above its prompt once it
// exists. Clip prompts (what goes to the video model with the two stills) at the bottom, collapsed, chunked the same way.
// Usage: node cleaned/experiments/kf-compare.mjs --label vanderbilt6 --kf kf1,kf2   → runs/exp-<label>/compare/index.html
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { scriptText } from "../src/script.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt6"), kfs = opt("--kf", "kf1,kf2").split(",");
const dir = join(RUNS, `exp-${label}`), L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const MODS = Object.fromEntries(await Promise.all(kfs.map(async (k) => [k, (await import(`../src/kf/${k}.js`)).KF])));
const K = Object.fromEntries(kfs.map((k) => [k, L.kf?.[k]]));
for (const k of kfs) if (!K[k]?.plan) { console.error(`no plan for ${k} in ${label}`); process.exit(1); }
const stills = K[kfs[0]].plan.stills, clips = K[kfs[0]].plan.clips, els = L.elements, name = (id) => els.find((e) => e.id === id)?.name || id;
const CLIP_SOURCES = { FRAMES: "the two stills, pinned", MOMENT: "appended: shot.moment + scene.tone", BEATS: "shot.action + shot.lines (voice from the cast stage) + shot.sfx, seconds relative to the clip", PEOPLE: "count of people in the frames", SOUND: "scene.ambience + scene.music" };

// A prompt as chunks: the first line of each blank-line-separated block is its label.
const chunks = (prompt, sources) => prompt.split(/\n\n+/).map((b) => { const [head, ...rest] = b.split("\n"); const key = head.replace(/\s*\(.*$/, ""); return `<div class="chunk"><div class="chead"><span class="clabel">${esc(head)}</span><span class="csrc">${esc(sources[key] || sources[head] || "")}</span></div><pre>${esc(rest.join("\n"))}</pre></div>`; }).join("");
// What each image reference is, with a thumbnail when the file exists.
const image = (ref, i, k) => {
  const [kind, id] = ref.split(":"), file = kind === "env" ? K[k].painted?.[id]?.file : L.bank[id]?.file;
  const what = kind === "plate" ? `plate · ${name(id)}` : kind === "env" ? `previous still · ${id}` : `portrait · ${name(id)}`;
  return `<div class="img"><div class="ilabel">image ${i + 1} · ${esc(what)}</div>${file && existsSync(join(dir, file)) ? `<img src="../${esc(file)}">` : `<div class="missing">${kind === "env" ? "not painted yet" : "missing"}</div>`}<div class="ifile">${esc(file || ref)}</div></div>`;
};
const cell = (k, s) => {
  const p = K[k].plan.stills.find((x) => x.id === s.id), painted = K[k].painted?.[s.id];
  return `<div class="cell"><div class="tag">${k.toUpperCase()} <span class="tagname">${esc(MODS[k].name)}</span></div>${painted && existsSync(join(dir, painted.file)) ? `<img class="still" src="../${painted.file}">${painted.bad ? `<div class="bad">check failed</div>` : ""}` : ""}${chunks(p?.prompt || "", MODS[k].sources || {})}</div>`;
};
const html = `<!doctype html><meta charset="utf-8"><title>${esc(label)} · sent</title>
<style>
body{font:14px/1.45 -apple-system,system-ui,sans-serif;margin:0;padding:24px 28px;background:#fafafa;color:#111;max-width:1500px}
h1{font-size:18px;margin:0 0 6px}h2{font:700 12px ui-monospace,monospace;letter-spacing:.1em;color:#666;margin:34px 0 10px}
.note{color:#666;font-size:12.5px;margin:0 0 18px}
pre{white-space:pre-wrap;margin:0;font:12.5px/1.5 ui-monospace,monospace}
details{margin:6px 0}summary{font:600 13px ui-monospace,monospace;color:#444;cursor:pointer}
.script{background:#fff;border:1px solid #e3e3e3;border-radius:6px;padding:14px}
.still-sec{margin:0 0 40px;border-top:2px solid #ddd;padding-top:14px}
.head{font:600 13px ui-monospace,monospace;color:#444;margin:0 0 10px;display:flex;gap:18px;flex-wrap:wrap}.head b{color:#111;font-size:14px}
.images{display:flex;gap:10px;margin:0 0 14px;flex-wrap:wrap}
.img{width:170px}.img img{width:170px;height:96px;object-fit:cover;border-radius:4px;border:1px solid #ddd;display:block}
.ilabel{font:600 11px ui-monospace,monospace;color:#0a58ca;margin:0 0 4px}.ifile{font:10.5px ui-monospace,monospace;color:#888;margin-top:3px;word-break:break-all}
.missing{width:170px;height:96px;border:1px dashed #bbb;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px}
.grid{display:grid;grid-template-columns:repeat(${kfs.length},1fr);gap:16px}
.cell{background:#fff;border:1px solid #e3e3e3;border-radius:6px;padding:12px}
.tag{font:700 12px ui-monospace,monospace;letter-spacing:.08em;color:#0a58ca;margin:0 0 10px}.tagname{font-weight:400;color:#888;letter-spacing:0}
.chunk{border-left:3px solid #d8e2f3;padding:4px 0 4px 10px;margin:0 0 10px}
.chead{display:flex;justify-content:space-between;gap:12px;margin:0 0 3px}
.clabel{font:700 11px ui-monospace,monospace;letter-spacing:.06em;color:#0a58ca}.csrc{font:11px ui-monospace,monospace;color:#999;text-align:right}
img.still{width:100%;border-radius:4px;margin:0 0 10px}.bad{font:700 12px ui-monospace,monospace;color:#b00020;margin:6px 0}
.clip{background:#fff;border:1px solid #e3e3e3;border-radius:6px;padding:12px;margin:10px 0}
</style>
<h1>${esc(L.script?.title || label)}</h1>
<p class="note">story → screenplay → keyframe prompts. Each prompt chunk is labelled with where its text comes from. Nothing below is written by a model after the screenplay.</p>
<h2>STORY</h2><details><summary>${esc(L.story?.title || "story")}</summary><div class="script"><pre>${esc(L.story?.story || "")}</pre></div></details>
<h2>SCREENPLAY · one call · shared by every variant</h2><div class="script"><pre>${esc(scriptText(L.script, els))}</pre></div>
<h2>KEYFRAMES · what is sent per still</h2>
${stills.map((s) => `<section class="still-sec"><div class="head"><b>${esc(s.id)}</b><span>${esc(s.uses.join(", "))}</span><span>shot ${s.shot} · ${esc(s.size)}</span></div><div class="images">${s.images.map((r, i) => image(r, i, kfs[0])).join("")}</div><div class="grid">${kfs.map((k) => cell(k, s)).join("")}</div></section>`).join("")}
<h2>CLIPS · what is sent to the video model with the two stills · same prompt in every variant</h2>
${clips.map((c) => { const made = kfs.filter((k) => K[k].made?.[c.n]?.clip && existsSync(join(dir, K[k].made[c.n].clip))); return `<div class="clip"><div class="head"><b>clip ${c.n}</b><span>${c.seconds} s</span><span>${esc(c.start)} → ${esc(c.end)}</span></div>${made.length ? `<div class="grid">${made.map((k) => { const m = K[k].made[c.n]; return `<div class="cell"><div class="tag">${k.toUpperCase()}</div><video controls src="../${esc(m.clip)}" style="width:100%;border-radius:4px"></video><div class="ifile">first frame vs start still ${m.qa?.first_vs_start} · last frame vs end still ${m.qa?.last_vs_end}${m.identity ? ` · identity ${m.identity.ok ? "ok" : "FAIL"} (${m.identity.frames} frames checked${m.identity.note ? `: ${esc(m.identity.note)}` : ""})` : ""}${m.tries > 1 ? ` · try ${m.tries}` : ""}${m.heard ? ` · heard: ${esc(m.heard)}` : ""}</div></div>`; }).join("")}</div>` : ""}<details${made.length ? "" : ""}><summary>prompt</summary>${chunks(c.prompt, CLIP_SOURCES)}</details></div>`; }).join("")}`;
mkdirSync(join(dir, "compare"), { recursive: true });
writeFileSync(join(dir, "compare", "index.html"), html);
console.log(`${join(dir, "compare", "index.html")}: ${stills.length} stills × ${kfs.length} variants`);
