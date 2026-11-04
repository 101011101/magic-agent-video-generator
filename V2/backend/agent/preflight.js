// Pre-flight: the plan run on paper before any tool is called. Each material starts as its measured facts (facts.js);
// each step turns its inputs' properties into its output's (kind, aspect, seconds, sound, transparency, lettering) by the
// rules below, which say what the tool and the executor actually do, not what the prompt asks. The result's predicted
// properties are compared with the goal from the sheet. Nothing is called and nothing is blocked: the findings go on the
// plan (plan.preflight) and on each step, so a reader sees where the pipeline would end up wrong before paying for it.
import { kindOf } from "./facts.js";
import { VIDEOS } from "../lib/models.js";

const NEEDS = { "image-edit": ["picture"], "image-to-video": ["picture"], "talking-photo": ["picture", "sound"], "lip-sync": ["clip", "sound"], "face-swap-photo": ["picture", "picture"], "face-swap-video": ["clip", "picture"], "background-remove": ["picture"], "upscale-image": ["picture"], captions: ["clip"], trim: ["clip|sound"], crop: ["picture|clip"], filter: ["picture|clip"], "text-overlay": ["picture|clip"], voice: [], compose: ["picture"], place: ["picture|clip", "picture"], assemble: ["picture|clip|sound"] };
const grid = (model, s) => { const g = VIDEOS[model]?.grid || [5, 10]; return g.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a)); };
const range = (x) => { const m = String(x || "").match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/); return m ? Number(m[2]) - Number(m[1]) : null; };
const say = (t) => Math.max(1, Math.round((String(t || "").replace(/^[A-Z][\w .'-]{0,24}:\s+/gm, "").split(/\s+/).filter(Boolean).length / 2.6) * 10) / 10);   // speech at about 2.6 words a second

function predict(s, ins) {
  const P = s.params || {}, first = ins[0] || {}, pic = ins.find((x) => x.kind === "picture"), clip = ins.find((x) => x.kind === "clip"), snd = ins.find((x) => x.kind === "sound"), txt = ins.find((x) => x.kind === "text");
  const asp = P.aspect || null, sec = Number(P.seconds) || 0, keep = /sound:\s*keep/i.test(P.extra || "");
  switch (s.tool) {
    case "image": return { kind: "picture", aspect: asp || "1:1", lettering: !!P.lettering, alpha: false };
    case "image-edit": return { kind: "picture", aspect: asp || pic?.aspect, lettering: !!P.lettering || pic?.lettering, alpha: false };
    case "frame": return { kind: "picture", aspect: clip?.aspect };
    case "crop": case "upscale-image": case "text-overlay": case "place": case "face-swap-photo": case "face-swap-video": case "captions":
      return { ...first, aspect: (s.tool === "crop" && (asp || String(P.extra || "").match(/\b(\d{1,2}:\d{1,2})\b/)?.[1] || (s.produces.match(/(\d{1,2})x(\d{1,2})/) || []).slice(1).join(":") || null)) || first.aspect, lettering: first.lettering || s.tool === "text-overlay" };
    case "filter": return { ...first, alpha: /transparent/i.test(P.extra || "") || first.alpha };
    case "background-remove": return { ...first, alpha: true, lost: first.lettering ? "the AI cutter keeps the main object and drops lettering" : undefined };
    case "compose": return { kind: "picture", aspect: asp || "16:9", lettering: true };
    case "image-to-video": return { kind: "clip", aspect: asp || pic?.aspect, seconds: grid(s.model || "minimax-h3", sec || 5), sound: keep ? "present" : "none" };
    case "text-to-video": return { kind: "clip", aspect: asp || "16:9", seconds: grid(s.model || "minimax-h3", sec || 5), sound: keep ? "present" : "none" };
    case "music": return { kind: "sound", seconds: sec || 30, sound: "present" };
    case "write": return { kind: "text", words: P.prompt_or_change };
    case "voice": return { kind: "sound", seconds: sec || say(txt?.words || P.prompt_or_change), sound: "present", guess: !sec };
    case "talking-photo": return { kind: "clip", aspect: pic?.aspect, seconds: snd?.seconds, sound: "present" };
    case "lip-sync": return { kind: "clip", aspect: clip?.aspect, seconds: Math.min(clip?.seconds ?? 99, snd?.seconds ?? 99), sound: "present" };
    case "trim": return { ...first, seconds: range(P.extra) ?? range(P.prompt_or_change) ?? (sec || first.seconds) };
    case "audio-to-video": return { kind: "clip", aspect: asp || "16:9", seconds: snd?.seconds, sound: "present" };
    case "assemble": { const vis = ins.filter((x) => x.kind === "clip" || x.kind === "picture"); const total = vis.reduce((n, x) => n + (x.kind === "clip" ? x.seconds || 0 : 0), 0);
      return vis.length ? { kind: "clip", aspect: asp || vis[0].aspect, seconds: sec || total || null, sound: ins.some((x) => x.kind === "sound" || x.sound === "present") ? "present" : "none" } : { kind: "sound", seconds: Math.max(...ins.map((x) => x.seconds || 0)), sound: "present" }; }
    case "check": return { kind: "verdict" };
    case "story": case "assets": case "screenplay": case "keyframes": return { kind: "other" };
    case "clips": case "film": return { kind: "clip", aspect: asp, seconds: sec || null, sound: "present" };
    default: return { ...first };
  }
}

// a change's range ("0–5 seconds", "the first 5 seconds") is the length of what comes back
const rangeOf = (r) => { const t = String(r || ""); if (!t || /whole|all|entire/i.test(t)) return null; const m = t.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/); if (m) return Number(m[2]) - Number(m[1]); const f = t.match(/(?:first|last|opening|final)\s+(\d+(?:\.\d+)?)\s*s/i); return f ? Number(f[1]) : null; };
// the goal, from the sheet: what kind, which size, how long, transparent or not
export function goalOf(sheet, request = "") {
  const f = Object.fromEntries((sheet?.fields || []).map((x) => [x.field, x.value])), g = sheet?.goal?.value;
  const text = `${request} ${Object.values(f).join(" ")} ${(sheet?.fields || []).map((x) => x.quote || "").join(" ")}`;
  return { kind: { image: "picture", video: "clip", sound: "sound" }[g] || null, aspect: String(f.size || f.platform || "").match(/\b(1:1|4:5|9:16|16:9|3:4|4:3|2:3|3:2)\b/)?.[1] || null,
    seconds: Number(String(f.length_s || "").match(/[\d.]+/)?.[0]) || rangeOf(f.range) || null, alpha: /transparent|no (white )?(box|background)/i.test(text) || null, sound: g === "video" && /\b(voice|voice-?over|say|says|speak|music|narrat\w*|with sound|soundtrack)\b/i.test(request) && !/\b(silent|no sound|without sound|mute)\b/i.test(request) ? "present" : null };
}

export function preflight(plan, { facts = {}, session = {}, sheet = null, request = "" } = {}) {
  const steps = plan?.steps || []; if (!steps.length) return null;
  const by = {}, state = {}, notes = [];
  for (const [n, o] of Object.entries(facts)) state[n] = { kind: o.kind, aspect: o.aspect, seconds: o.seconds, sound: o.sound, alpha: o.alpha, lettering: o.seen?.words && o.seen.words !== "none" };
  for (const [n, o] of Object.entries(session)) state[n] ??= { kind: o.kind || kindOf(n), aspect: o.aspect, seconds: o.seconds, sound: o.sound, alpha: o.alpha };   // what earlier turns made
  steps.forEach((s, i) => (by[s.produces] = i));
  const done = new Set(); let guard = 0;
  while (done.size < steps.length && guard++ < steps.length + 2) steps.forEach((s, i) => {
    if (done.has(i) || s.inputs.some((n) => by[n] !== undefined && !done.has(by[n]))) return;
    const ins = s.inputs.map((n) => state[n] || { kind: kindOf(n), unknown: true }), bad = [];
    for (const n of s.inputs) if (by[n] === undefined && !facts[n] && !session[n] && /\.[a-z0-9]{2,4}$/i.test(n)) bad.push(`input ${n} is neither a material nor made by an earlier step`);
    for (const need of NEEDS[s.tool] || []) { const k = need.split("|"); const have = ins.filter((x) => k.includes(x.kind)).length, want = (NEEDS[s.tool] || []).filter((x) => x === need).length; if (have < want) { bad.push(`${s.tool} needs a ${need.replace(/\|/g, " or ")}; it gets ${ins.map((x) => x.kind).join(", ") || "nothing"}`); break; } }
    const o = predict(s, ins); if (o.lost) bad.push(o.lost);
    if (s.tool === "voice" && o.guess && plan.steps.some((t) => t.tool === "talking-photo" || t.tool === "lip-sync")) bad.push(`the speech will run about ${o.seconds} s (no params.seconds) and the clip takes the speech's length`);
    if (s.params?.extra && /dissolve|fade|crossfade|transition/i.test(s.params.extra) && s.tool === "assemble") bad.push("assemble hard-cuts; a dissolve in extra is not done");
    state[s.produces] = o; s.predicted = o; s.preflight = bad; bad.forEach((b) => notes.push(`${i + 1}. ${s.tool} → ${s.produces}: ${b}`)); done.add(i);
  });
  // the deliverables: steps nothing else takes
  const ends = steps.filter((s) => !steps.some((t) => t.inputs.includes(s.produces)) && !["check", "write"].includes(s.tool)), goal = goalOf(sheet, request), off = [];
  for (const s of ends) { const o = state[s.produces] || {};
    if (goal.aspect && o.aspect && o.kind !== "sound" && ends.length === 1 && o.aspect !== goal.aspect) off.push(`${s.produces} will be ${o.aspect}; the goal is ${goal.aspect}`);
    if (goal.seconds && o.seconds && Math.abs(o.seconds - goal.seconds) > Math.max(1, goal.seconds * 0.15)) off.push(`${s.produces} will run about ${o.seconds} s; the goal is ${goal.seconds} s`);
    if (goal.alpha && o.kind === "picture" && !o.alpha) off.push(`${s.produces} will not be transparent`);
    if (goal.sound && o.kind === "clip" && o.sound === "none") off.push(`${s.produces} will have no sound`); }
  // the user's own words carried into the prompts: their colours and every quoted string must reach some step
  const prompts = steps.map((s) => `${s.params?.prompt_or_change || ""} ${s.params?.extra || ""} ${s.params?.text || ""}`).join(" ").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
  const COLOURS = /\b(black|white|cream|ivory|red|green|blue|navy|teal|yellow|gold|golden|orange|purple|pink|brown|beige|grey|gray|silver|sage|olive|maroon|turquoise|coral|mint|lavender|charcoal)\b/gi;
  const said = request.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
  const colours = [...new Set([...said.matchAll(COLOURS)].map((m) => m[1].toLowerCase()))].filter((c) => !new RegExp(`\\b(no|not|without|non)[ -]${c}`, "i").test(said));
  const missingC = colours.filter((c) => !prompts.includes(c) && !(c === "gray" && prompts.includes("grey")) && !(c === "grey" && prompts.includes("gray")) && !(c === "gold" && prompts.includes("golden")) && !(c === "golden" && prompts.includes("gold")));
  if (missingC.length && steps.some((s) => ["image", "image-edit", "text-to-video", "image-to-video", "text-overlay"].includes(s.tool))) off.push(`the user's colour${missingC.length > 1 ? "s" : ""} ${missingC.join(", ")} reach${missingC.length > 1 ? "" : "es"} no prompt`);
  const quoted = [...said.matchAll(/"([^"]{2,200})"/g)].map((m) => m[1]).filter((q) => !prompts.includes(q.toLowerCase()) && !steps.some((s) => s.inputs.some((n) => /\.txt$/.test(n))));
  if (quoted.length) off.push(`quoted words not in any prompt: ${quoted.map((q) => `"${q.slice(0, 40)}"`).join(", ")}`);
  if (goal.kind && ends.length && !ends.some((s) => [goal.kind, "other"].includes(state[s.produces]?.kind))) off.unshift(`nothing at the end is a ${goal.kind}: it ends in ${ends.map((s) => `${s.produces} (${state[s.produces]?.kind})`).join(", ")}`);
  return { goal, steps: notes, end: off, ok: !notes.length && !off.length };
}
