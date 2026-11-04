// The typed planner (an experiment against plan.js, measured by bench/v1/plan-ab.mjs): goals first, each subgoal a
// RESTRICTED type from a fixed bank plus UNRESTRICTED details in the model's own words; code turns each type into the
// short list of tools that can serve it; a separate call picks one tool per subgoal by matching inputs and outputs; code
// type-checks the wiring and gives the tool call one chance to correct itself.
import { jsonCall, S } from "../lib/llm.js";
import { tool as toolOf } from "./catalogue.js";
import { price } from "./plan.js";

// The bank of subgoal types, and the tools each may use (the quantized choice).
export const BANK = {
  "generate-picture": ["image"],
  "designed-lettering": ["image", "image-edit"],          // a logo, a poster, a thumbnail, a meme, a slide: lettered by the image model (qwen)
  "edit-picture": ["image-edit", "background-remove", "upscale-image"],
  "compose-pictures": ["image-edit"],                     // side by side, before/after, a collage
  "logo-on-material": ["place"],
  "text-on-clip": ["text-overlay", "captions"],           // subtitles, a lower third, a URL or date on a clip
  "caption-on-untouched-photo": ["text-overlay"],
  "resize": ["crop"],
  "animate-picture": ["image-to-video"],
  "generate-clip": ["text-to-video", "image-to-video"],
  "cut-clip": ["trim"],
  "still-from-clip": ["frame"],
  "join-into-video": ["assemble"],
  "music": ["music"],
  "speech": ["write", "voice"],                           // write the words (unless given), then speak them
  "talking-head": ["talking-photo", "lip-sync"],
  "face-swap": ["face-swap-photo", "face-swap-video"],
  "write-text": ["write"],
  "verify": ["check"],
  "story-film": ["story", "assets", "screenplay", "keyframes", "clips", "film"],
};
// What each tool takes and makes, by kind (picture, clip, sound, text, verdict); "same" = the kind of its first input.
export const IO = {
  image: { in: ["picture*"], out: "picture" }, "image-edit": { in: ["picture+"], out: "picture" }, "background-remove": { in: ["picture"], out: "picture" }, "upscale-image": { in: ["picture"], out: "picture" },
  place: { in: ["picture|clip", "picture"], out: "same" }, "text-overlay": { in: ["picture|clip", "text?"], out: "same" }, captions: { in: ["clip"], out: "clip" }, crop: { in: ["picture|clip"], out: "same" },
  "image-to-video": { in: ["picture", "picture?"], out: "clip" }, "text-to-video": { in: ["picture*"], out: "clip" }, trim: { in: ["clip"], out: "clip" }, frame: { in: ["clip"], out: "picture" },
  assemble: { in: ["picture|clip+", "sound?"], out: "clip" }, music: { in: [], out: "sound" }, write: { in: ["any*"], out: "text" }, voice: { in: ["text"], out: "sound" },
  "talking-photo": { in: ["picture", "sound"], out: "clip" }, "lip-sync": { in: ["clip", "sound"], out: "clip" }, "face-swap-photo": { in: ["picture", "picture"], out: "picture" }, "face-swap-video": { in: ["clip", "picture"], out: "clip" },
  check: { in: ["any+"], out: "verdict" },
};
const kindOf = (name) => /\.(png|jpe?g|webp|gif)$/i.test(name) ? "picture" : /\.(mp4|mov|webm)$/i.test(name) ? "clip" : /\.(mp3|wav|m4a|aac)$/i.test(name) ? "sound" : /\.(txt|srt|md)$/i.test(name) ? "text" : /\.json$/i.test(name) ? "verdict" : "unknown";

// Code: every step's inputs exist and are of a kind the tool takes; what it produces is the kind it makes.
export function typeCheck(steps, materials = [], session = []) {
  const errs = [], made = {};
  for (const m of [...materials, ...session]) made[m] = kindOf(m);
  steps.forEach((s, i) => {
    const io = IO[s.tool]; const at = `step ${i + 1} (${s.tool} → ${s.produces})`;
    if (!io) { if (!BANK["story-film"].includes(s.tool)) errs.push(`${at}: no such tool`); made[s.produces] = kindOf(s.produces); return; }
    const kinds = s.inputs.map((x) => made[x] ?? (errs.push(`${at}: input "${x}" is neither a material, a session asset nor made by an earlier step`), "unknown"));
    const need = io.in.filter((x) => !/[?*]$/.test(x)).length; if (kinds.length < need) errs.push(`${at}: takes ${io.in.join(", ")}, got ${kinds.length} input(s)`);
    kinds.forEach((k, j) => { const slot = io.in[Math.min(j, io.in.length - 1)]; if (!slot) { errs.push(`${at}: takes no inputs`); return; } const ok = slot.replace(/[?*+]$/, "").split("|"); if (k !== "unknown" && !ok.includes("any") && !ok.includes(k)) errs.push(`${at}: input ${j + 1} "${s.inputs[j]}" is a ${k}; this tool takes ${slot.replace(/[?*+]$/, "")} there`); });
    const out = io.out === "same" ? kinds[0] : io.out, got = kindOf(s.produces);
    if (out && out !== "unknown" && got !== "unknown" && got !== out) errs.push(`${at}: makes a ${out}, but produces is named as a ${got}`);
    made[s.produces] = out && out !== "unknown" ? out : got;
  });
  return errs;
}

const SUB = S.obj({ id: S.str, type: S.enum(Object.keys(BANK)), details: S.str, exact_words: S.str, from: S.arr(S.str), aspect: S.str, seconds: S.num });
const GOALS = S.obj({ deliverables: S.arr(S.obj({ name: S.str, kind: S.enum(["picture", "clip", "sound", "text", "answer"]), aspect: S.str, seconds: S.num, subgoals: S.arr(SUB) })), say: S.str, refuse: S.str, questions_left: S.arr(S.str), needs_beyond_free: S.str });
const STEP = S.obj({ subgoal: S.str, tool: S.str, inputs: S.arr(S.str), produces: S.str, params: S.obj({ seconds: S.num, aspect: S.str, resolution: S.str, prompt_or_change: S.str, extra: S.str, lettering: S.bool }), why: S.str });

export async function plan2({ sheet, materials = [], session = [], tier = "free" }) {
  const fields = sheet.fields.filter((f) => f.source !== "not_applicable" && f.value).map((f) => `${f.field}: ${f.value} (${f.source})`).join("\n");
  const sess = session.map((a) => a.label || a);
  // 1. Goals: restricted type + unrestricted details.
  const G = await jsonCall({ name: "agent-goals-typed", effort: "low", schema: GOALS, prompt: `Break the request into DELIVERABLES (each picture, clip, sound or text the user receives; three sizes are three; five slides are five) and each deliverable into SUBGOALS in the order they must happen. Each subgoal has a TYPE from this bank, and DETAILS in your own words with everything specific (style, content, colours, motion, position, mood):
${Object.keys(BANK).join(", ")}.
designed-lettering: words that are part of a design (logo, poster, flyer, thumbnail, meme, slide, title or end card, social graphic). text-on-clip: subtitles, a lower third, a date or URL over a clip. caption-on-untouched-photo: words over the user's photo that must stay unchanged. compose-pictures: side by side, before/after, collage. story-film: only a story with characters longer than 20 s, or when a film is named.
exact_words: verbatim words for that subgoal, else "". from: the materials, session assets or earlier subgoal ids it builds on. id: short, unique. A capability question or a reply in words: one deliverable of kind "answer" with no subgoals, the answer in say. refuse: one line if it must be declined (a real public person endorsing, a child's face swapped, a trademark on a product not theirs, sexual content of a real person), else "". questions_left: only a choice only the user can make. say: one or two sentences to the user. needs_beyond_free: what no free model gives, else "".
FREE TIER: stills flux-2-klein or qwen-image-2.1 at 640px, made 1:1, 16:9 or 9:16 and cut to other sizes by code; video minimax-h3 at 480p, up to 10 s a clip, adds its own speech (dropped unless kept).
MATERIALS: ${materials.join(", ") || "none"}
SESSION: ${sess.join(", ") || "none"}
SHEET (goal: ${sheet.goal.value}):
${fields}` });
  const base = { shape: "tree", say: G.say, desired_state: "", current_state: "", refuse: G.refuse, questions_left: G.questions_left, steps: [], goals: G };
  if (G.refuse || G.questions_left.length || !G.deliverables.some((d) => d.subgoals.length)) return price(base, tier);
  // 2. Tools: one per subgoal from its allowed list, wired by inputs and outputs; then the type check, one correction.
  const menu = [...new Set(G.deliverables.flatMap((d) => d.subgoals.flatMap((s) => BANK[s.type])))].map((t) => `- ${t}: takes ${(IO[t]?.in || ["(pipeline)"]).join(", ") || "nothing"}; makes ${IO[t]?.out || "(pipeline)"}${toolOf(t)?.guarantees ? `; ${toolOf(t).guarantees.join("; ")}` : ""}`).join("\n");
  const ask = (errors) => jsonCall({ name: "agent-tools-typed", effort: "low", schema: S.obj({ steps: S.arr(STEP) }), prompt: `Choose the tool calls for these subgoals. For EACH subgoal use only a tool from its ALLOWED list (speech may be write then voice; story-film is the six film nodes in order). Wire inputs by name: a material, a session asset, or an earlier step's produces. Name every produces with the right extension for what the tool makes (.png picture, .mp4 clip, .mp3 sound, .txt text, .json verdict). Put the subgoal's details and exact words (in double quotes) into params.prompt_or_change; params.lettering = true for designed-lettering; params.aspect and params.seconds from the subgoal or deliverable; params.extra for placement or timing ("at: bottom", "anchor: left", "from: 0; to: 3", "sound: keep" only when the clip's own sound is wanted). Each deliverable's last step produces it.
TOOLS (takes → makes; * any number, + one or more, ? optional):
${menu}
SUBGOALS with their ALLOWED tools:
${G.deliverables.map((d) => `DELIVERABLE ${d.name} (${d.kind}${d.aspect ? `, ${d.aspect}` : ""}${d.seconds ? `, ${d.seconds}s` : ""})\n${d.subgoals.map((s) => `  ${s.id} [${s.type}] allowed: ${BANK[s.type].join(", ")} | from: ${s.from.join(", ") || "-"} | ${s.details}${s.exact_words ? ` | words: "${s.exact_words}"` : ""}${s.aspect ? ` | ${s.aspect}` : ""}${s.seconds ? ` | ${s.seconds}s` : ""}`).join("\n")}`).join("\n")}
MATERIALS: ${materials.join(", ") || "none"}
SESSION: ${sess.join(", ") || "none"}${errors ? `\nYOUR LAST ANSWER FAILED THE TYPE CHECK; fix exactly these:\n${errors.join("\n")}` : ""}` });
  let out = await ask(null), errs = typeCheck(out.steps, materials, sess), retried = false;
  if (errs.length) { out = await ask(errs); errs = typeCheck(out.steps, materials, sess); retried = true; }
  const steps = out.steps.map((s) => ({ group: toolOf(s.tool)?.group || "", ...s }));
  const p = price({ ...base, shape: steps.some((s) => s.tool === "story") ? "film" : steps.length <= 1 ? "single" : "tree", steps }, tier);
  return { ...p, type_errors: errs, type_retried: retried };
}
