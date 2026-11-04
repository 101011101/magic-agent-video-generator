// The sheet: the question tree of prd/11-agent.md, filled from the conversation. One call per turn returns, for the
// goal and for every field of its branch, the value, how it was filled (stated | session | inferred | unknown |
// not_applicable), a confidence, and the quote that supports a stated value. Code applies the threshold: an unknown
// field, or an inferred one below THRESHOLD, becomes a question; at most MAX_QUESTIONS per turn, in tree order.
import { jsonCall, S } from "../lib/llm.js";

export const THRESHOLD = 0.7;
export const MAX_QUESTIONS = 4;

export const GOALS = ["video", "image", "change", "sound", "find"];

// The branches, in the order their questions are asked. `ask` is how the field is put to the user when unknown.
export const BRANCHES = {
  video: [
    { field: "kind", ask: null, default: "short" },
    { field: "platform", ask: "Where will it play (TikTok, Reels, Shorts, YouTube, broadcast, a deck)? It decides portrait or landscape.", default: "youtube, 16:9" },
    { field: "length_s", ask: "How long, in seconds?", default: "30" },
    { field: "audience", ask: null, default: "general" },
    { field: "direction", ask: null, default: "needed", values: ["stated", "free", "needed"] },
    { field: "message", ask: "What should the viewer come away with?", default: null, when: "direction=needed" },
    { field: "tone", ask: "What tone: warm, deadpan, urgent, quiet, epic?", default: null, when: "direction=needed" },
    { field: "subject", ask: "What or who is it about?", default: null },
    { field: "must_include", ask: null, default: "" },
    { field: "materials", ask: "Do you have pictures, clips or audio we must use (a person, a product, a logo, a voice)?", default: "none", when: "real-thing-only-the-user-has" },
  ],
  image: [
    { field: "subject", ask: "What should the picture show?", default: null },
    { field: "direction", ask: null, default: "needed", values: ["stated", "free", "needed"] },
    { field: "style", ask: "What style or mood?", default: null, when: "direction=needed" },
    { field: "size", ask: null, default: "1:1" },
    { field: "materials", ask: "Is there a picture we must start from (a product, a person, a logo)?", default: "none", when: "real-thing-only-the-user-has" },
    { field: "count", ask: null, default: "1" },
  ],
  change: [
    { field: "asset", ask: "Which picture or clip should I change? Send it, or name one from earlier.", default: null },
    { field: "provenance", ask: null, default: "supplied", values: ["made-here", "supplied"] },
    { field: "change", ask: "What should change?", default: null },
    { field: "change_kind", ask: null, default: null, values: ["identity", "content", "look", "form", "speech", "time"] },
    { field: "reference", ask: "Whose face or which character goes in? Send a picture.", default: null, when: "change_kind=identity" },
    { field: "range", ask: null, default: "whole" },
    { field: "language", ask: "Which language?", default: null, when: "change_kind=speech" },
    { field: "keep_rest", ask: null, default: "yes" },
  ],
  sound: [
    { field: "what", ask: "Speech from text, a voice for a character, music, or a dub of a clip?", default: null },
    { field: "voice", ask: "Which voice: a preset, or a sample you have?", default: "preset" },
    { field: "text_or_cue", ask: "What should it say, or what should the music be like?", default: null },
    { field: "length_s", ask: null, default: null },
    { field: "attach_to", ask: null, default: "none" },
  ],
  find: [{ field: "question", ask: "What do you want to know?", default: null }],
};

const FIELD = S.obj({ field: S.str, value: S.str, source: S.enum(["stated", "session", "inferred", "unknown", "not_applicable"]), confidence: S.num, quote: S.str });
const SCHEMA = S.obj({ goal: S.obj({ value: S.enum(GOALS), source: S.enum(["stated", "session", "inferred", "unknown"]), confidence: S.num, quote: S.str, why: S.str }), refers_to: S.str, about_focus: S.bool, fields: S.arr(FIELD) });

function treeText(goal) {
  const b = BRANCHES[goal] || [];
  return b.map((q) => `- ${q.field}${q.values ? ` (one of: ${q.values.join(", ")})` : ""}${q.when ? ` [only when ${q.when}]` : ""}${q.default != null ? ` [default: ${q.default}]` : ""}`).join("\n");
}

// Fill the sheet from the conversation. `messages` is [{who: user|agent, text}], `materials` the files the user has,
// `session` the assets made earlier ([{label, kind, from}]). Returns the raw sheet plus the questions code derived.
// With `liberty` (the creative-liberty toggle) nothing is asked: every open field takes its default or the model's
// best guess and is marked "assumed"; the goal alone is still asked when unknown, since no default exists for it.
export async function fillSheet({ messages, materials = [], attached = null, session = [], goalHint = null, liberty = false, focus = null }) {
  const out = await fillSheetRaw({ messages, materials, session, goalHint, focus });
  if (!focus) out.about_focus = false;
  // Code rules the model keeps missing: one supplied picture or clip on a change IS the asset; one on an image request is its material.
  const pool = attached && attached.length ? attached : materials; const pics = pool.filter((m) => /\.(png|jpe?g|webp|gif|mp4|mov)$/i.test(m));
  const fix = (field, value) => { const f = out.fields.find((x) => x.field === field); if (f && (f.source === "unknown" || (f.source === "inferred" && f.confidence < THRESHOLD))) { f.value = value; f.source = "session"; f.confidence = 1; f.quote = ""; } };
  if (out.goal.value === "change" && pics.length === 1) fix("asset", pics[0]);
  if (out.goal.value === "change" && pics.length) fix("provenance", "supplied");
  if (pics.length) fix("materials", pics.join(", "));
  out.questions = questionsFor(out);
  if (!liberty) return out;
  const branch = BRANCHES[out.goal.value] || [];
  for (const q of branch) {
    const f = out.fields.find((x) => x.field === q.field); if (!f || f.source === "not_applicable") continue;
    if (f.source === "unknown" || (f.source === "inferred" && f.confidence < THRESHOLD)) { f.value = f.value || q.default || "agent's choice"; f.source = "assumed"; f.confidence = 1; }
  }
  if (out.goal.source === "inferred") { out.goal.source = "assumed"; }
  return { ...out, questions: out.goal.source === "unknown" ? questionsFor(out).slice(0, 1) : [] };
}

async function fillSheetRaw({ messages, materials = [], session = [], goalHint = null, focus = null }) {
  const convo = messages.map((m) => `${m.who.toUpperCase()}: ${m.text}`).join("\n");
  const prompt = `You fill a SHEET for an agent that makes images, videos and sounds. Read the conversation and the materials and fill every field of the sheet. Rules:
- source "stated": the user said it; put the exact words in quote. "session": an earlier message or a supplied file settles it. "inferred": not said, but a confident reading of the words, the platform, the materials (quote the words that imply it). "unknown": nothing supports a value. "not_applicable": this branch or this request does not need the field (then value "").
- confidence 0-1 for inferred values only (1 for stated and session, 0 for unknown).
- Never mark "stated" without a quote. Never invent a material the user did not mention.
- direction: "stated" when tone, ending, style or message is given; "free" when the user says surprise me / your call / you decide; "needed" otherwise. message and tone are ALWAYS filled when the text gives them (stated, with the quote); they are unknown, not not_applicable, when it does not; code decides whether to ask.
- kind: if the user's words name it (ad, commercial, short, trailer, podcast, documentary, explainer, music video, drama), that is stated with that word as the quote; "ad" and "commercial" are kind "ad".
- platform: stated when the platform's name is in the text (TikTok, Reels, Instagram, Shorts, YouTube); the aspect that follows from it is part of the value, not a reason to call it inferred.
- aspect words state the size and the platform's shape: "vertical", "portrait", "for Stories/Reels/TikTok" → 9:16; "widescreen", "landscape", "horizontal", "16:9" → 16:9; "square" → 1:1. Then platform and size are "stated" (quote the word), never unknown.
- delegation: when the user says "your call", "you pick", "up to you", "surprise me", "whatever you think" about a field or about everything, those fields are "inferred" with confidence 1 and a sensible value you choose; they are never unknown.
- kind, audience and size are never asked: infer them (an image with no size is 1:1 unless the use implies otherwise; a clip with no aspect is 16:9).
- materials: the files the user has (listed below) and which real thing each is the record of; ask only when a real thing only the user has (their product, their relative, their pet, their truck) is in the request and no file covers it; a public, documented thing (a landmark, a historical person, a famous aircraft) is researched, never asked for.
- change_kind: identity (a face, head, body, character), content (add, remove, alter something), look (style, colour), form (upscale, reframe, background), speech (captions, dub, lip-sync), time (cut, trim).
- provenance: "made-here" when the asset is one this session produced (see session), else "supplied".
- A verb alone does not decide the goal: "edit me a picture of X" with no picture is goal "image".
- refers_to: when the user points at an earlier asset ("it", "the first one", "the ending"), the session label it means; else "".
- about_focus: ${focus ? `the user is LOOKING AT ${focus.step.produces} (a ${focus.step.tool} node: "${(focus.step.params?.prompt_or_change || "").slice(0, 80)}"). true if this message is about that thing (a change to it, a question about it, "make it bigger", "the sign", "this one"); false if it is a new, unrelated request. When true: goal is "change", asset is ${focus.step.produces}, provenance "made-here".` : "false (nothing is focused)."}

GOAL: one of ${GOALS.join(", ")} (video = a complete piece with a story; image = one or a few pictures; change = something done to an asset that exists; sound = speech, voice, music, dub; find = an answer, nothing made).${goalHint ? ` The goal was settled earlier as "${goalHint}"; keep it unless the user changed it.` : ""}

FIELDS of each branch (fill ONLY the branch of the goal you chose, every field of it, in this order):
video:\n${treeText("video")}\nimage:\n${treeText("image")}\nchange:\n${treeText("change")}\nsound:\n${treeText("sound")}\nfind:\n${treeText("find")}

MATERIALS the user has: ${materials.length ? materials.join(", ") : "none"}
SESSION assets made earlier: ${session.length ? session.map((a) => `${a.label} (${a.kind}${a.from ? `, from ${a.from}` : ""})`).join("; ") : "none"}

CONVERSATION:
${convo}`;
  const out = await jsonCall({ name: "agent-sheet", effort: "low", schema: SCHEMA, prompt });
  return { ...out, questions: questionsFor(out) };
}

// Code, not the model, decides what is asked: tree order, threshold, the cap.
export function questionsFor(sheet) {
  const qs = [];
  if (sheet.goal.source === "unknown" || (sheet.goal.source === "inferred" && sheet.goal.confidence < THRESHOLD)) qs.push({ field: "goal", question: "What should I make: a complete video, a picture, a change to something you have, a sound, or do you just need an answer?", default: null });
  const branch = BRANCHES[sheet.goal.value] || [];
  const val = (name) => sheet.fields.find((x) => x.field === name)?.value;
  for (const q of branch) {
    if (!q.ask) continue;   // fields the model derives (direction, change_kind, provenance) are never asked directly
    const f = sheet.fields.find((x) => x.field === q.field);
    if (!f || f.source === "not_applicable") continue;
    if (q.when && /^(\w+)=(\w+)$/.test(q.when)) { const [, k, v] = q.when.match(/^(\w+)=(\w+)$/); if (val(k) !== v) continue; }   // asked only under the condition; filled regardless
    if (q.field === "style" && /\bmeme|joke|funny|caption (it|this)|reaction (image|pic)/i.test(JSON.stringify(sheet.fields.map((x) => [x.value, x.quote])))) continue;   // a meme's style is its template, never asked (G39b)
    if (f.source === "unknown" || (f.source === "inferred" && f.confidence < THRESHOLD)) qs.push({ field: q.field, question: q.ask, default: q.default });
  }
  return qs.slice(0, MAX_QUESTIONS);
}

export const asked = (questions) => questions.map((q) => `${q.question}${q.default ? ` (default: ${q.default})` : ""}`).join("\n");
