// Bench v1 grader: reads a results folder from run.mjs and grades each item in three layers.
// 1. deterministic: something was made (a placeholder is not), the right kind of file, size, length, sound present;
// 2. a vision judge: the user's attachments and the output (frames for a clip) against the item's must-haves, its exact
//    text, visible faults, usable as-is, a 1-5 score; sound is transcribed and judged as text;
// 3. the conversation: asked when it had to and not when it need not, refused when it should, said when it was beyond
//    the free tier, did not keep asking.
// Each failure gets a reason tag, so the report can count them. Writes <id>.grade.json and grades.json.
// Usage: node V2/bench/v1/grade.mjs --dir V2/bench/v1/results/<stamp> [--only A01a] [--no-judge]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { duration, size, hasAudio, peakDb } from "../../backend/lib/media.js";
import { key } from "../../backend/lib/env.js";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = arg("--dir"); if (!DIR) throw new Error("--dir <results folder>");
const only = (arg("--only", "") || "").split(",").filter(Boolean), JUDGE = !process.argv.includes("--no-judge");
const FR = join(DIR, "frames"); mkdirSync(FR, { recursive: true });
const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|webm)$/i, AUD = /\.(mp3|wav|m4a|aac)$/i, TXT = /\.(txt|md)$/i;
const ratio = (a) => ({ "1:1": 1, "4:5": 0.8, "9:16": 9 / 16, "16:9": 16 / 9 }[a]);

async function transcribe(file) {
  const wav = join(FR, `a-${Math.random().toString(36).slice(2)}.wav`); execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-t", "120", wav]);
  const form = new FormData(); form.append("model", "gpt-4o-transcribe"); form.append("file", new Blob([readFileSync(wav)]), "a.wav");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }); const j = await r.json(); return j.text ?? null;
}
const framesOf = (file, tag, n = 4) => { const d = duration(file); return Array.from({ length: n }, (_, k) => { const at = Math.max(0, Math.min(d - 0.1, (d * (k + 0.5)) / n)); const out = join(FR, `${tag}-${k}.jpg`); execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at), "-i", file, "-frames:v", "1", "-vf", "scale=768:-2", "-q:v", "4", out]); return { file: out, at: Math.round(at * 10) / 10 }; }); };

function deliverables(rec) {
  const t = [...rec.turns].reverse().find((x) => x.ran) ; if (!t) return { turn: null, files: [] };
  const plan = t.plan; const consumed = new Set(plan.steps.flatMap((s) => s.inputs));
  let sinks = t.ran.map((s, i) => ({ ...s, produces: plan.steps[i].produces, inputs: plan.steps[i].inputs })).filter((s) => !consumed.has(s.produces));
  // a check node is not a deliverable: what it looked at is
  sinks = sinks.flatMap((s) => (s.tool === "check" ? t.ran.map((x, i) => ({ ...x, produces: plan.steps[i].produces })).filter((x) => s.inputs.includes(x.produces)) : [s]));
  const sess = join(V2, rec.sessionDir);
  return { turn: t, files: sinks.map((s) => ({ ...s, path: s.output && !s.output.startsWith("../../") ? join(sess, s.output) : s.output ? join(sess, s.output) : null })) };
}

async function grade(rec) {
  const it = rec.item, tags = [], det = [], conv = []; const add = (arr, name, pass, got, tag) => { arr.push({ name, pass: !!pass, got }); if (!pass && tag) tags.push(tag); };
  if (rec.error) return { id: it.id, pass: false, score: 0, tags: ["runner-error"], error: rec.error };
  const T0 = rec.turns[0] || {}, last = rec.turns.at(-1) || {};
  // conversation
  const askedFirst = (T0.dialog || []).length > 0 || !!T0.stillAsking;
  if (it.expect.asks === "required") add(conv, `asks first (${it.expect.asks_about})`, askedFirst, T0.firstQuestions, "didnt-ask");
  if (it.expect.asks === "never") add(conv, "asks nothing", !askedFirst, T0.firstQuestions, "asked-unneeded");
  for (const t of rec.turns) if (t.stillAsking && it.spec.kind !== "none") add(conv, "stops asking within 3 rounds", false, t.stillAsking, "kept-asking");   // when nothing should be made (waiting for a yes), still asking is the outcome
  const made = rec.turns.some((t) => (t.ran || []).some((s) => s.state === "done" && !s.simulated));
  if (it.expect.refuse) add(conv, "refuses", !made && rec.turns.every((t) => !t.ran), rec.turns.map((t) => t.plan?.refuse || t.agent), "not-refused");
  else if (rec.turns.some((t) => t.plan?.refuse)) add(conv, "does not refuse", false, rec.turns.map((t) => t.plan?.refuse), "refused-wrongly");
  if (it.expect.beyond_free === "yes") add(conv, "says it is beyond the free tier", rec.turns.some((t) => t.plan?.tier_move || /free (tier|plan)|paid|upgrade/i.test(t.agent || "")), rec.turns.map((t) => t.plan?.tier_move), "beyond-free-unsaid");
  if (rec.turns.some((t) => t.notRun)) tags.push("film-planned");
  // what was made
  const { files } = deliverables(rec); const wants = it.spec.kind !== "none" && !it.expect.refuse && !(it.spec.kind === "text" && !rec.turns.some((t) => t.ran));
  const failed = rec.turns.flatMap((t) => (t.ran || []).filter((s) => s.state === "failed"));
  for (const s of failed) tags.push(`step-failed:${s.tool}`);
  for (const s of rec.turns.flatMap((t) => t.ran || []).filter((s) => s.simulated)) tags.push(`not-wired:${s.tool}`);
  const real = files.filter((f) => f.path && existsSync(f.path) && !f.simulated && !/\.svg$/i.test(f.path) && statSync(f.path).size > 500);
  const media = { images: [], videos: [], audio: [], text: [] };
  for (const f of real) (IMG.test(f.path) ? media.images : VID.test(f.path) ? media.videos : AUD.test(f.path) ? media.audio : TXT.test(f.path) ? media.text : []).push(f);
  let judge = null;
  if (wants) {
    add(det, "something was made", real.length > 0, files.map((f) => `${f.tool}:${f.state}${f.simulated ? " (placeholder)" : ""}`), real.length ? null : (rec.turns.some((t) => t.notRun) ? "not-made:film" : failed.length ? "not-made:failed" : files.some((f) => f.simulated) ? "not-made:not-wired" : !rec.turns.some((t) => t.plan) ? "not-made:no-plan" : "not-made"));
    if (real.length) {
      const kindOk = { image: media.images.length > 0, images: media.images.length > 0, video: media.videos.length > 0, audio: media.audio.length > 0 || media.videos.some((v) => hasAudio(v.path)), text: media.text.length > 0 }[it.spec.kind] ?? true;
      add(det, `a ${it.spec.kind} was made`, kindOk, real.map((f) => extname(f.path)), "wrong-kind");
      if (it.spec.outputs > 1) add(det, `${it.spec.outputs} outputs`, real.length >= it.spec.outputs, real.length, "too-few-outputs");
      const visual = [...media.images, ...media.videos];
      if (ratio(it.spec.aspect) && visual.length) { const bad = visual.filter((f) => { const [w, h] = size(f.path); return Math.abs(w / h / ratio(it.spec.aspect) - 1) > 0.04; }); add(det, `aspect ${it.spec.aspect}`, !bad.length, visual.map((f) => size(f.path).join("x")), "wrong-aspect"); }
      const timed = [...media.videos, ...media.audio];
      if (it.spec.seconds && timed.length) { const d = duration(timed[0].path); add(det, `about ${it.spec.seconds} s`, Math.abs(d - it.spec.seconds) <= Math.max(1.5, it.spec.seconds * 0.2), Math.round(d * 10) / 10, "wrong-length"); }
      if (it.spec.audio === "required") { const a = [...media.videos, ...media.audio].find((f) => hasAudio(f.path)); add(det, "sound present and audible", a && (peakDb(a.path) ?? -99) > -45, a ? peakDb(a.path) : "no audio track", "no-audio"); }
    }
    // the judge
    if (JUDGE && real.length) {
      const pics = [], legend = [];
      const atts = [...new Set(rec.turns.flatMap((t) => t.materials))].map((m) => join(V2, "bench/v1/fixtures", m));
      for (const a of atts.slice(0, 3)) { if (IMG.test(a)) { pics.push(a); legend.push(`image ${pics.length}: the user's attachment ${a.split("/").pop()}`); } else if (VID.test(a)) { const f = framesOf(a, `${it.id}-in`, 1)[0]; pics.push(f.file); legend.push(`image ${pics.length}: a frame of the user's attached clip ${a.split("/").pop()}`); } }
      for (const f of media.images.slice(0, 5)) { pics.push(f.path); legend.push(`image ${pics.length}: OUTPUT from ${f.tool} (${f.produces})`); }
      for (const [k, v] of media.videos.slice(0, 2).entries()) for (const fr of framesOf(v.path, `${it.id}-o${k}`, 4)) { pics.push(fr.file); legend.push(`image ${pics.length}: OUTPUT clip ${v.produces}, frame at ${fr.at} s of ${Math.round(duration(v.path) * 10) / 10} s`); }
      const sound = []; for (const f of [...media.audio, ...media.videos.filter((v) => hasAudio(v.path))].slice(0, 2)) { const tr = await transcribe(f.path).catch(() => null); sound.push(`${f.produces}: ${Math.round(duration(f.path))} s, peak ${peakDb(f.path)} dB, speech heard: ${tr ? `"${tr.slice(0, 400)}"` : "none"}`); }
      const texts = media.text.map((f) => `${f.produces}: """${readFileSync(f.path, "utf8").slice(0, 1500)}"""`);
      const dialog = rec.turns.map((t, k) => `USER (message ${k + 1}): ${t.text}${t.materials.length ? ` [attached ${t.materials.join(", ")}]` : ""}${t.dialog.map((d) => `\nAGENT asked: ${d.agent}\nUSER answered: ${d.user}`).join("")}`).join("\n");
      judge = await jsonCall({ name: "bench-v1-judge", effort: "medium", images: pics.slice(0, 12), schema: S.obj({
        must_haves: S.arr(S.obj({ item: S.str, met: S.enum(["yes", "no", "cannot_tell"]), why: S.str })),
        exact_text: S.arr(S.obj({ text: S.str, seen: S.enum(["exact", "wrong", "missing"]), read_as: S.str })),
        faults: S.arr(S.obj({ what: S.str, severity: S.enum(["minor", "major"]) })),
        usable_as_is: S.bool, score: S.int, summary: S.str }),
        prompt: `You are grading the OUTPUT of an AI media agent for one benchmark item, strictly and fairly, as a demanding client would. Look at the images; do not assume anything you cannot see or read below.

THE CONVERSATION:
${dialog}

THE IMAGES, in order:
${legend.join("\n")}
${sound.length ? `\nSOUND (transcribed; you cannot hear it):\n${sound.join("\n")}` : ""}${texts.length ? `\nTEXT OUTPUTS:\n${texts.join("\n")}` : ""}

MUST-HAVES for this item (judge each; "cannot_tell" only if it truly cannot be judged from what you have, e.g. the mood of music):
${it.must_haves.map((m) => `- ${m}`).join("\n")}
EXACT TEXT that must appear in the output: ${it.spec.exact_text.length ? it.spec.exact_text.map((x) => `"${x}"`).join(", ") : "none"} (report each: exact, wrong = present but misspelled or altered, missing; read_as = what you actually read)
FAULTS: list visible problems: garbled or misspelled text, extra or missing fingers or limbs, warped faces or objects, a face that changed when it should not, things the user did not ask for, edits that changed what should stay, obvious AI artefacts, a clip that does not move or morphs. major = a client would reject it for this.
usable_as_is: would the user post or use this without asking for a redo?
score: 1 unusable, 2 poor, 3 acceptable with fixes, 4 good, 5 excellent.
summary: one plain sentence on what came out and its main problem, if any.` });
      const mh = judge.must_haves.filter((m) => m.met !== "cannot_tell"), met = mh.filter((m) => m.met === "yes").length;
      add(det, "must-haves met", !mh.length || met / mh.length >= 0.8, `${met}/${mh.length}`, "must-have-missed");
      if (judge.exact_text.some((x) => x.seen !== "exact")) tags.push("text-wrong");
      if (judge.faults.some((f) => f.severity === "major")) tags.push("major-fault");
      if (!judge.usable_as_is) tags.push("not-usable");
    }
  }
  // the reply itself, when the right outcome is words, not a file: a refusal, "there is no speech", "approve the spend first"
  let reply = null;
  if (JUDGE && (!wants || (it.spec.kind === "text" && !real.length))) {
    const dialog = rec.turns.map((t, k) => `USER (message ${k + 1}): ${t.text}${t.materials.length ? ` [attached ${t.materials.join(", ")}]` : ""}${t.dialog.map((d) => `\nAGENT asked: ${d.agent}\nUSER answered: ${d.user}`).join("")}\nAGENT: ${t.agent || "(no reply)"}${t.plan ? `\n[the agent's plan: ${t.plan.refuse ? `refused: ${t.plan.refuse}` : t.plan.steps.map((s) => s.tool).join(" → ")}${t.ran ? `; ran: ${t.ran.map((s) => `${s.tool} ${s.state}`).join(", ")}` : t.notRun ? "; not run" : ""}]` : ""}`).join("\n");
    reply = await jsonCall({ name: "bench-v1-reply", effort: "low", schema: S.obj({ must_haves: S.arr(S.obj({ item: S.str, met: S.enum(["yes", "no"]), why: S.str })), summary: S.str }), prompt: `Grade an AI media agent's handling of this conversation against each must-have, strictly, from the transcript only.\n\n${dialog}\n\nMUST-HAVES:\n${it.must_haves.map((m) => `- ${m}`).join("\n")}\nsummary: one plain sentence.` });
    const met = reply.must_haves.filter((m) => m.met === "yes").length; add(conv, "reply meets its must-haves", met / Math.max(1, reply.must_haves.length) >= 0.75, `${met}/${reply.must_haves.length}`, "reply-missed");
  }
  const all = [...det, ...conv], dpass = det.length ? det.filter((c) => c.pass).length / det.length : 1, cpass = conv.length ? conv.filter((c) => c.pass).length / conv.length : 1;
  let score; if (!wants) score = Math.round(100 * cpass);
  else if (!real.length) score = 0;
  else if (judge) { const mh = judge.must_haves.filter((m) => m.met !== "cannot_tell"); score = Math.round(100 * (0.35 * (mh.length ? mh.filter((m) => m.met === "yes").length / mh.length : 1) + 0.25 * ((judge.score - 1) / 4) + 0.15 * (judge.usable_as_is ? 1 : 0) + 0.15 * dpass + 0.1 * cpass) * (judge.faults.some((f) => f.severity === "major") ? 0.8 : 1)); }
  else score = Math.round(100 * (0.6 * dpass + 0.4 * cpass));
  const pass = all.every((c) => c.pass) && (!wants || (real.length > 0 && (!judge || (judge.usable_as_is && !judge.faults.some((f) => f.severity === "major")))));
  return { id: it.id, group: it.group, case: it.case, case_name: it.case_name, title: it.title, tests: it.tests, pass, score, tags: [...new Set(tags)], checks: all, judge, reply, spent: rec.spent, seconds: rec.seconds,
    outputs: real.map((f) => f.path.replace(V2 + "/", "")), tools: rec.turns.map((t) => (t.plan ? t.plan.steps.map((s) => s.tool).join("→") : t.stillAsking ? "still asking" : "no plan")) };
}

const recs = readdirSync(DIR).filter((f) => /^[A-J]\d\d[a-z]\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8"))).filter((r) => !only.length || only.includes(r.id));
const out = []; const q = [...recs];
await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const r = q.shift(); try { const g = await grade(r); writeFileSync(join(DIR, `${r.id}.grade.json`), JSON.stringify(g, null, 2)); out.push(g); console.log(`${r.id.padEnd(6)} ${g.pass ? "PASS" : "fail"} ${String(g.score).padStart(3)} ${g.tags.join(" ")}`); } catch (e) { console.log(`${r.id} GRADE ERROR ${e.message}`); out.push({ id: r.id, pass: false, score: 0, tags: ["grade-error"], error: e.message }); } } }));
const prev = existsSync(join(DIR, "grades.json")) ? JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8")) : []; const merged = [...prev.filter((g) => !out.some((o) => o.id === g.id)), ...out].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(DIR, "grades.json"), JSON.stringify(merged, null, 2));
console.log(`\n${merged.filter((g) => g.pass).length}/${merged.length} pass · mean score ${Math.round(merged.reduce((a, g) => a + g.score, 0) / merged.length)}`);
