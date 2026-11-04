// One HTML page per V3 run: the pipeline as it ran, step by step, with every intermediate (story record, route, prompt
// with its slots marked, the generation call, frames, the review table, the judge against the MCP), then the two clips.
// Usage: node V3/compose/page.mjs v3-flower-1  → V3/runs/<label>/index.html
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { V2 } from "../../V2/backend/lib/env.js";
import { V3 } from "./paths.mjs";

const label = process.argv[2] || "v3-flower-1", dir = join(V3, "runs", label);
const rec = JSON.parse(readFileSync(join(dir, "compose.json"), "utf8"));
const judge = existsSync(join(dir, "judge/judge.json")) ? JSON.parse(readFileSync(join(dir, "judge/judge.json"), "utf8")) : null;
// the MCP's record for the same brief, if one exists: any bench/v1/results/mcp-*/<id>.json whose first turn is this brief
import { readdirSync } from "node:fs";
let mcp = null, mcpArgs = null, mcpClip = null;
for (const d of readdirSync(join(V2, "bench/v1/results")).filter((x) => x.startsWith("mcp-"))) for (const f of readdirSync(join(V2, "bench/v1/results", d)).filter((x) => x.endsWith(".json") && x !== "run.json")) {
  try { const r = JSON.parse(readFileSync(join(V2, "bench/v1/results", d, f), "utf8")); if (r.turns?.[0]?.text === rec.brief) { const c = r.turns[0].calls.find((c) => c.name === "create_video_from_text" && c.output); if (c) { mcp = r; mcpArgs = typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments; const ran = r.turns[0].ran?.find((x) => x.output); if (ran) mcpClip = relative(dir, join(V2, r.sessionDir, ran.output)); } } } catch {}
}
if (judge?.films?.mcp) mcpClip = relative(dir, judge.films.mcp);
const mcpCalls = mcp ? mcp.turns[0].calls.filter((c) => /^(edit_image|generate_image|create_video_from_text|create_video_from_image|place_person_in_scene)$/.test(c.name)).map((c) => ({ name: c.name, args: typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments, output: c.output })) : [];
const mcpMaterials = mcp ? mcp.turns[0].materials || [] : [];
const ourEdit = rec.tools.find((t) => t.tool === "image-edit"), ourVid = rec.tools.find((t) => /video/.test(t.tool) && t.credits);
const short = (v) => esc(String(v ?? "").replace(/\?X-Goog.*$/, "").replace(/^.*\//, ""));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = (v) => `<span class="b ${v === "yes" || v === true || v === "PASS" ? "ok" : v === "partly" || v === "unclear" ? "mid" : "bad"}">${esc(v === true ? "yes" : v === false ? "no" : v)}</span>`;
const pre = (s) => `<pre>${esc(s)}</pre>`;
const json = (o) => `<details><summary>raw</summary><pre>${esc(JSON.stringify(o, null, 1))}</pre></details>`;

// mark the slots of an operational prompt: beats by their "N–M seconds:" openers; the fixed slots by position
function slots(p) {
  const parts = p.split(/(?=\b\d+\s*[–-]\s*\d+ seconds?:)/);
  const head = parts[0], beats = parts.slice(1);
  const headSent = head.match(/[^.]+\.\s*/g) || [head];
  const names = ["FORMAT", "LOOK", "CONTINUITY"];
  let out = headSent.map((s, i) => `<span class="slot"><i>${names[i] || "LOOK"}</i>${esc(s)}</span>`).join("");
  beats.forEach((b, i) => {
    const last = i === beats.length - 1;
    let body = b;
    let tail = "";
    if (last) { const m = body.match(/(Hold [^.]*\.\s*)([\s\S]*)$/); if (m) { tail = m[0]; body = body.slice(0, body.indexOf(m[0])); } }
    body = body.replace(/('[^']+')/g, `<mark title="EXACT WORDS">$1</mark>`);
    out += `<span class="slot beat"><i>BEAT ${i + 1}</i>${body}</span>`;
    if (tail) { const [, hold, rest] = tail.match(/(Hold [^.]*\.\s*)([\s\S]*)$/); const sents = rest.match(/[^.]+\.\s*/g) || [rest]; const neg = sents.pop() || ""; out += `<span class="slot"><i>HOLD</i>${esc(hold)}</span>${sents.length ? `<span class="slot"><i>GRADE</i>${esc(sents.join(""))}</span>` : ""}<span class="slot"><i>NEGATIVES</i>${esc(neg)}</span>`; }
  });
  return `<p class="op">${out}</p>`;
}

const story = rec.story, st = (n) => rec.steps.find((s) => s.name === n);
const att = rec.attempts || [], best = rec.outputs ? att.find((a) => a.key === rec.outputs.chosen) : null;
const img = (f, t) => `<figure><img src="${esc(f)}" loading="lazy"><figcaption>${esc(t)}</figcaption></figure>`;
const html = `<!doctype html><meta charset="utf-8"><title>V3 case 1 · ${esc(label)}</title>
<style>
:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--ok:#1d7a3d;--bad:#b3261e;--mid:#9a6b00;--acc:#2f5d8a;--card:#fff}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--acc:#8ab4e8;--card:#1d1a15;color-scheme:dark}}
:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--acc:#8ab4e8;--card:#1d1a15;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:28px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1100px;margin-inline:auto}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:34px 0 10px;padding-top:14px;border-top:1px solid var(--line)}h3{font-size:14px;margin:16px 0 6px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.mut{color:var(--mut)}pre{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:12.5px;max-height:420px;overflow:auto}
.b{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;color:#fff}.b.ok{background:var(--ok)}.b.bad{background:var(--bad)}.b.mid{background:var(--mid)}
table{border-collapse:collapse;width:100%;font-size:13.5px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600}
.pipe{display:grid;gap:10px}.step{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.step>b{display:block;margin-bottom:4px}.step .n{color:var(--acc);font-weight:700;margin-right:8px}
.op{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;line-height:1.75}.slot{display:inline}.slot i{display:inline-block;font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.05em;color:#fff;background:var(--acc);border-radius:4px;padding:0 5px;margin:0 6px 0 2px;vertical-align:middle}.slot.beat i{background:#7a4a8a}mark{background:#ffe9a8;color:#1d1a16;padding:0 2px;border-radius:3px}
.frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}figure{margin:0}figure img{width:100%;border-radius:6px;border:1px solid var(--line)}figcaption{font-size:11.5px;color:var(--mut);margin-top:2px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.two{grid-template-columns:1fr}}video{width:100%;border-radius:8px;background:#000}
.kv td:first-child{color:var(--mut);width:180px}details summary{cursor:pointer;color:var(--acc)}
</style>
<h1>${esc(rec.pipeline)} · ${esc(label)}</h1>
<p class="mut">${esc(rec.at)} · ltx-2.5, no references, one prose prompt from a story and the guide · ${rec.credits ?? 0} credits · ${rec.llm.length} LLM calls (${esc(rec.llm_model)}) · docs: V3/docs/02-case-1-text-only.md</p>
<p><b>Brief.</b> ${esc(rec.brief)}</p>
${rec.outputs ? `<h2>The clip</h2><div class="two"><div><h3>V3 · ${esc(rec.outputs.chosen)} · ${best.seconds} s · audio ${best.audio ? "on" : "off"} · <a href="${esc(rec.outputs.clip)}">file</a></h3><video controls preload="metadata" src="${esc(rec.outputs.clip)}"></video></div>${att.length > 1 ? att.filter((a) => a.key !== rec.outputs.chosen && a.review).map((a) => `<div><h3>the other attempt · ${esc(a.key)} (not chosen) · <a href="${esc(a.file)}">file</a></h3><video controls preload="metadata" src="${esc(a.file)}"></video></div>`).join("") : ""}</div>` : ""}

${mcp || rec.reference ? `<h2>Inputs, and who chose them</h2>
<table><tr><th></th><th>V3</th><th>MCP</th></tr>
<tr><td>the reference</td><td>${rec.reference ? `<b>supplied by hand</b> on the command line (${esc(rec.reference.from)}): a frame of clip 1 picked by a person; the state manager that would pick it is not built yet. A VLM then described it (people, objects, place, light) and those words became the fixed descriptors.` : "none"}</td><td>${mcp ? (mcpMaterials.length ? `<b>supplied by us</b>: the same frame, attached to the message as <code>${esc(mcpMaterials.join(", "))}</code> (uploaded to the account by the harness; the message says "the customer in the attached frame"). The MCP selected nothing from clip 1; it cannot read a video. It used the attachment where its tools take a file path.` : "nothing attached") : "not run"}</td></tr>
<tr><td>the still (seed / first frame)</td><td>${ourEdit ? `<b>chosen in code</b>: image editor, ${esc(ourEdit.model)} ${esc(ourEdit.resolution)} ${esc(ourEdit.aspect_ratio)}, input = the reference. Prompt written by an LLM from the story's first-frame sentence. Checked by a VLM against the reference (same person, same bouquet, new people, scene); two attempts, the second used.` : "none (text only)"}</td><td>${mcpCalls.filter((c) => /image/.test(c.name) && !/video/.test(c.name)).map((c) => `<b>chosen by the chat model</b>: <code>${esc(c.name)}</code>, ${esc(c.args.model)} ${esc(c.args.resolution)} ${esc(c.args.aspect_ratio || "")}, input = <code>${short(c.args.assets?.image_file_paths?.[0] || c.args.assets?.image_file_path || "")}</code> (the attachment). No check: the first still was accepted and animated.`).join("<br>") || "no still: it went straight to video"}</td></tr>
<tr><td>the video call</td><td>${ourVid ? `<b>chosen in code</b>: ${esc(ourVid.tool)} on ${esc(ourVid.model)} ${esc(ourVid.resolution)}, ${ourVid.seconds} s, audio ${ourVid.audio ? "on" : "off"}${ourVid.start ? `, start frame = <code>${esc(ourVid.start)}</code>` : ", no references"}. ltx-2.5 is fixed for the free tier in V3; the story decided audio.` : "—"}</td><td>${mcpCalls.filter((c) => /video/.test(c.name)).map((c) => `<b>chosen by the chat model</b>: <code>${esc(c.name)}</code> on ${esc(c.args.model)} ${esc(c.args.resolution)}, ${c.args.end_seconds} s, audio ${c.args.audio ? "on" : "off"}${c.args.assets?.image_file_path ? `, start frame = its own still (<code>${short(c.args.assets.image_file_path)}</code>)` : c.args.references ? `, references ${c.args.references.map((r) => "@" + r.name).join(" ")}` : ", no references"}. It gave no reason for the model; its reply was the download link only.`).join("<br>") || "—"}</td></tr>
<tr><td>credits · time</td><td>${rec.credits} · ${rec.tools.filter((t) => t.wall_seconds).reduce((n, t) => n + t.wall_seconds, 0)} s of generation</td><td>${mcp ? `${mcp.spent} · ${mcp.seconds} s end to end` : "—"}</td></tr></table>
${mcpCalls.length ? `<details><summary>the MCP's prompts, call by call</summary>${mcpCalls.map((c) => `<h3>${esc(c.name)} · ${esc(c.args.model)}</h3>${c.name.startsWith("create_video") ? slots(c.args.style?.prompt || "") : pre(c.args.style?.prompt || "")}`).join("")}</details>` : ""}
${ourEdit ? `<details><summary>our prompts, call by call</summary><h3>image-edit · ${esc(ourEdit.model)}</h3>${pre(ourEdit.prompt)}<h3>${esc(ourVid?.tool)} · ${esc(ourVid?.model)}</h3>${slots(ourVid?.prompt || "")}</details>` : ""}` : ""}
${judge ? (() => { const other = Object.keys(judge.scores).find((k) => k !== label) || "mcp", pk = Object.keys(judge.pairs)[0], pr = judge.pairs[pk], isMcp = other === "mcp"; return `<h2>Result against ${isMcp ? "the MCP" : esc(other)} (same judge, same frames)</h2>
<table class="kv"><tr><td>V3 case 1 score</td><td><b>${judge.scores[label].score}</b> / 100 · ${esc(judge.scores[label].summary)}</td></tr>
<tr><td>${isMcp ? "MCP" : esc(other)} score (this judging)</td><td><b>${judge.scores[other].score}</b> / 100 · ${esc(judge.scores[other].summary)}</td></tr>
<tr><td>Pairwise</td><td><b>${esc(pr.winner_side)}</b> wins, ${esc(pr.strength)} (${esc(pr.first)} was shown first) · ${esc(pr.why)}</td></tr>
${judge.earlier ? `<tr><td>Earlier, same judge</td><td>keyref-1 70 · keyref2 44 · MCP 87–88 (the flower brief)</td></tr>` : ""}${judge.transcripts ? `<tr><td>sound, transcribed</td><td>V3: ${esc(judge.transcripts[label] || "—")}<br>${isMcp ? "MCP" : esc(other)}: ${esc(judge.transcripts[other] || "—")}</td></tr>` : ""}</table>
<h3>Must-haves</h3><table><tr><th>must-have</th><th>V3</th><th>${isMcp ? "MCP" : esc(other)}</th></tr>${judge.scores[label].must_haves.map((m, i) => `<tr><td>${esc(m.item)}</td><td>${badge(m.met)} <span class="mut">${esc(m.why)}</span></td><td>${badge(judge.scores[other].must_haves[i]?.met)} <span class="mut">${esc(judge.scores[other].must_haves[i]?.why)}</span></td></tr>`).join("")}</table>
<div class="two"><div><h3>V3 clip</h3><video controls preload="metadata" src="${esc(rec.outputs.clip)}"></video></div><div><h3>${isMcp ? `MCP clip${mcpArgs ? ` (${esc(mcpArgs.model)}, ${mcp.spent ?? mcpArgs.end_seconds * 24} credits)` : ""}` : esc(other)} · <a href="${esc(isMcp ? mcpClip : relative(dir, judge.films[other]))}">file</a></h3><video controls preload="metadata" src="${esc(isMcp ? mcpClip : relative(dir, judge.films[other]))}"></video></div></div>
<h3>The judge's frames</h3><div class="two"><div class="frames">${judge.frames[label].map((f, i) => img(f, `V3 · ${2 * i + 1} s`)).join("")}</div><div class="frames">${judge.frames[other].map((f, i) => img(f, `${isMcp ? "MCP" : esc(other)} · ${2 * i + 1} s`)).join("")}</div></div>`; })() : `<p class="mut">Not judged yet.</p>`}

<h2>The pipeline as it ran</h2>
<div class="pipe">
<div class="step"><b><span class="n">1</span>Story <span class="mut">(LLM: v3-story-v1)</span></b>
<p>${esc(story.prose)}</p>
<table class="kv"><tr><td>kind</td><td>${esc(story.kind)}${story.research_why ? ` · research ${story.needs_research ? "needed" : "not needed"}: ${esc(story.research_why)}` : ""}</td></tr>
<tr><td>people</td><td>${esc(story.people.join("; "))}</td></tr><tr><td>place · time · mood</td><td>${esc(story.place)} · ${esc(story.time)} · ${esc(story.mood)}</td></tr>
<tr><td>exact words</td><td>${story.exact_words.map((w) => `<mark>${esc(w)}</mark>`).join(" ") || "none"}</td></tr>
<tr><td>seconds · aspect · sound</td><td>${story.seconds} s${story.seconds_why ? ` (${esc(story.seconds_why)})` : ""} · ${esc(story.aspect)} · ${esc(story.sound)} (${esc(story.sound_why)})</td></tr>
<tr><td>progression</td><td><ol style="margin:0;padding-left:18px">${story.progression.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></td></tr>
<tr><td>specific · first frame</td><td>${(story.specific || story.carried || []).length ? esc((story.specific || story.carried).join(", ")) : "none"} · ${story.first_frame ? esc(story.first_frame) : "none"}</td></tr></table>${json(story)}</div>

${rec.reference ? `<div class="step"><b><span class="n">0</span>Reference <span class="mut">(supplied by hand; the state manager assumed perfect · VLM: v3-ref-seen-v1)</span></b>
${rec.extra_refs?.length ? `<div class="frames">${[{ name: rec.reference.name || "reference", file: rec.reference.file, from: rec.reference.from }, ...rec.extra_refs].map((x) => img(x.file, `@${x.name} · ${x.from}`)).join("")}</div><p class="mut">${rec.attempts?.[0]?.references ? `all ${1 + rec.extra_refs.length} sent as named references to ${esc(rec.attempts[0].model)}` : "the first is the start frame; the others are extra editor inputs"}</p>` : ""}
<div class="two"><div>${rec.extra_refs?.length ? "" : img(rec.reference.file, `the reference frame · ${esc(rec.reference.from)}`)}</div><div><table class="kv">${(rec.reference.seen?.people || []).map((x) => `<tr><td>person</td><td>${esc(x.who)}: ${esc(x.look)}</td></tr>`).join("")}${(rec.reference.seen?.objects || []).map((x) => `<tr><td>object</td><td>${esc(x.what)}: ${esc(x.look)}</td></tr>`).join("")}<tr><td>place · light</td><td>${esc(rec.reference.seen?.place)} · ${esc(rec.reference.seen?.light)}</td></tr></table></div></div></div>` : ""}
<div class="step"><b><span class="n">2</span>Route <span class="mut">(code)</span></b> ${esc(st("route").route)} <span class="mut">· ${esc(st("route").why)}</span></div>
${rec.seed_attempts ? `<div class="step"><b><span class="n">2b</span>Seed still <span class="mut">(image editor ${esc(rec.tools.find((t) => t.tool === "image-edit")?.model)} from the reference · VLM check: v3-seed-check-v1)</span></b>
<div class="frames">${rec.seed_attempts.map((a) => `<figure><img src="${esc(a.file)}" loading="lazy"><figcaption>${esc(a.key)} · ${a.credits} credits · ${a.check ? `same person ${esc(a.check.same_person)}, same bouquet ${esc(a.check.same_bouquet)}, new people ${esc(a.check.new_people_as_described)}, scene ${esc(a.check.scene_as_described)} → ${a.pass ? "PASS" : "FAIL"}` : "dry"}</figcaption></figure>`).join("")}</div>
${rec.seed_attempts.map((a) => `<details><summary>edit prompt for ${esc(a.key)}${a.check ? ` · evidence: ${esc(a.check.evidence)}` : ""}</summary>${pre(a.prompt)}</details>`).join("")}</div>` : ""}

<div class="step"><b><span class="n">3</span>Operational prompt <span class="mut">(LLM: v3-prompt-v1 · sequence + guide.md)</span></b>
<p class="mut">${rec.prompt.prompt.length} characters (limit 2,000) · ${rec.prompt.beats.length} beats · ${rec.prompt.shots} shots · code check: length ${rec.prompt_attempts.at(-1).check.chars <= 2000 ? badge("yes") : badge("no")} exact words ${rec.prompt_attempts.at(-1).check.missing.length ? badge("no") : badge("yes")}${rec.prompt_attempts.length > 1 ? ` · rewritten once (first draft: ${rec.prompt_attempts[0].check.chars} chars, missing ${esc(rec.prompt_attempts[0].check.missing.join(", ") || "nothing")})` : ""}</p>
${slots(rec.prompt.prompt)}
<h3>beats as the writer listed them</h3><table><tr><th>#</th><th>range</th><th>shows</th></tr>${rec.prompt.beats.map((b, i) => `<tr><td>${i + 1}</td><td>${b.from}–${b.to} s</td><td>${esc(b.shows)}</td></tr>`).join("")}</table>
${mcpArgs ? `<details><summary>the MCP's prompt for the same brief, for comparison (${mcpArgs.style.prompt.length} chars · ${esc(mcpArgs.model)} · ${mcpArgs.end_seconds} s · audio ${mcpArgs.audio ? "on" : "off"})</summary>${slots(mcpArgs.style.prompt)}</details>` : `<p class="mut">The MCP has not been run on this brief.</p>`}
<details><summary>guide.md as given to the writer</summary>${pre(readFileSync(join(V3, "compose/guide.md"), "utf8"))}</details></div>

${att.map((a, i) => `<div class="step"><b><span class="n">${4 + i * 2}</span>Generation ${a.key} <span class="mut">(Magic Hour /v1/text-to-video)</span></b>
${a.skipped ? `<p class="mut">skipped: ${esc(a.skipped)}</p>` : ""}<table class="kv"><tr><td>call</td><td>${a.start_frame ? "image-to-video" : "text-to-video"} · model ${esc(a.model)} · ${a.seconds} s · ${esc(a.aspect)} · ${esc(a.resolution)} · audio ${a.audio ? "on" : "off"} · ${a.start_frame ? `start frame <code>${esc(a.start_frame)}</code>` : "references none"}</td></tr>
<tr><td>credits · time</td><td>${a.credits ?? "—"} credits${a.cached ? " (cached)" : ""} · ${a.wall_seconds ?? "—"} s wall · rendered ${a.rendered ?? "—"} s</td></tr>
${a.failures_named ? `<tr><td>failures folded in</td><td>${esc(a.failures_named.join("; "))}</td></tr><tr><td>prompt sent</td><td>${pre(a.prompt)}</td></tr>` : `<tr><td>prompt sent</td><td class="mut">the operational prompt above, unchanged</td></tr>`}</table>
${a.frames ? `<h3>frames: first, each beat's middle, last</h3><div class="frames">${img(a.frames.first, "first frame")}${a.frames.beats.map((f, k) => img(f, `beat ${k + 1} · ${a.frames.times[k]} s`)).join("")}${img(a.frames.last, "last frame")}</div>` : ""}</div>
${a.review ? `<div class="step"><b><span class="n">${5 + i * 2}</span>Review ${a.key} <span class="mut">(VLM: v3-review-v1 on ${2 + a.frames.beats.length} frames)</span></b> ${badge(a.review.pass ? "PASS" : "FAIL")}
<table><tr><th>beat</th><th>subject present</th><th>action seen</th><th>evidence</th></tr>${a.review.beats.map((b) => `<tr><td>${b.beat}</td><td>${badge(b.subject_present)}</td><td>${badge(b.action_seen)}</td><td class="mut">${esc(b.evidence)}</td></tr>`).join("")}</table>
<table class="kv"><tr><td>exact words</td><td>${a.review.exact_words.map((w) => `'${esc(w.text)}' reads “${esc(w.reads)}” ${badge(w.exact)}`).join("<br>") || "none required"}</td></tr>
${a.review.identity ? `<tr><td>identity vs the reference</td><td>${a.review.identity.map((i) => `${esc(i.carried)} ${badge(i.same_as_reference)} <span class="mut">${esc(i.evidence)}</span>`).join("<br>")}</td></tr>` : ""}<tr><td>same people and place</td><td>${badge(a.review.same_people_and_place)}</td></tr><tr><td>last frame holds</td><td>${badge(a.review.last_frame_holds)}</td></tr>
${a.transcript ? `<tr><td>lines asked vs heard</td><td>${a.review.lines.map((l) => `“${esc(l.text)}” → heard “${esc(l.heard)}” ${badge(l.match)} on time ${badge(l.on_time)}`).join("<br>") || "none asked"}<br><span class="mut">voices consistent: ${esc(a.review.voices_consistent)}</span></td></tr><tr><td>transcript (whisper-1)</td><td>${a.transcript.map((g) => `<span class="mut">[${g.from}–${g.to} s]</span> ${esc(g.text)}`).join(" ") || "<span class=mut>no speech</span>"}</td></tr>` : ""}
<tr><td>artifacts</td><td>${esc(a.review.artifacts.join("; ") || "none noted")}</td></tr><tr><td>failures</td><td>${esc(a.review.failures.join("; ") || "none")}</td></tr></table></div>` : ""}`).join("")}

${rec.outputs ? `<div class="step"><b><span class="n">${4 + att.length * 2}</span>Return to the loop</b> clip <code>${esc(rec.outputs.clip)}</code> · review ${badge(best.review.pass ? "PASS" : "FAIL")} · state record: ${esc(rec.outputs.state[0].people.join("; "))} at ${esc(rec.outputs.state[0].place)}, ${esc(rec.outputs.state[0].time)}; words seen: ${rec.outputs.state[0].words_seen.map((w) => `'${esc(w.text)}' → “${esc(w.reads)}”`).join(", ") || "none"}; last frame <code>${esc(rec.outputs.state[0].last_frame)}</code>${json(rec.outputs.state)}</div>` : `<div class="step"><b>Stopped</b> ${esc(rec.stopped)}</div>`}
</div>

<h2>Calls and cost</h2>
<table><tr><th>#</th><th>kind</th><th>what</th><th>credits</th></tr>${rec.llm.map((l, i) => `<tr><td>${i + 1}</td><td>LLM</td><td>${esc(l.name)} · ${esc(l.purpose)}</td><td>0</td></tr>`).join("")}${rec.tools.map((t, i) => `<tr><td>${rec.llm.length + i + 1}</td><td>${esc(t.tool)}</td><td>${esc(t.endpoint || t.op)}${t.model ? ` · ${esc(t.model)} ${t.seconds} s ${esc(t.resolution)} audio ${t.audio ? "on" : "off"}` : ""}${t.wall_seconds ? ` · ${t.wall_seconds} s` : ""}</td><td>${t.credits || 0}</td></tr>`).join("")}<tr><td></td><td></td><td><b>total</b></td><td><b>${rec.credits ?? 0}</b></td></tr></table>
<p class="mut">LLM usage: ${rec.llm_usage ? `${rec.llm_usage.calls} calls, ${rec.llm_usage.input_tokens} in / ${rec.llm_usage.output_tokens} out tokens` : "—"} ${mcp ? ` · the MCP's run for this brief: ${mcp.turns[0].calls.length} calls, ${mcp.spent} credits, ${mcp.seconds} s end to end, no machine review.` : ""}</p>
`;
writeFileSync(join(dir, "index.html"), html); console.log(`wrote ${join(dir, "index.html")}`);
