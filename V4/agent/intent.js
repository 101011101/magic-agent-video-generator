// One LLM call per turn: from the whole conversation and the attachments, predict the tier and the tool, fill the tool's
// parameter sheet with a source for every value (user | derived | default | missing), and write the plain questions for what
// is missing. Re-run on every turn, so a change of direction re-routes. Nothing is made up: a value without a user source is
// either a stated default the user can overrule, or missing.
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { TOOLS, PARAM_TYPES, REFUSE } from "./catalogue.js";
import { QUESTIONS, parseAspect, parseSeconds, parseSound, YOUR_CALL } from "./questions.js";

const PARAM = S.obj({ name: S.str, value: S.str, source: S.enum(["user", "derived", "default", "missing"]), from: S.str });
const INTENT = S.obj({
  tier: S.enum(["simple", "pictures", "video", "campaign", "refuse", "unclear"]), tool: S.str, why: S.str,
  needs_research: S.bool, research_queries: S.arr(S.str),
  deliverables: S.arr(S.obj({ tool: S.str, brief: S.str, uses_previous: S.bool })),
  attachments: S.arr(S.obj({ file: S.str, role: S.enum(["person", "copy", "product", "environment", "other"]), use: S.enum(["reference", "describe", "ignore"]) })),
  params: S.arr(PARAM), questions: S.arr(S.obj({ param: S.str, question: S.str })), direction_changed: S.bool, say: S.str,
});

export async function intent({ messages, attachments = [], previous = null }) {
  const toolList = Object.entries(TOOLS).map(([k, t]) => `${k} (tier ${t.tier}; in: ${t.in.join("+") || "nothing"}; out: ${t.out}; params: ${t.params.join(", ")}; required: ${t.required.join(", ") || "none"})`).join("\n");
  const r = await jsonCall({ name: "v4-intent-v1", effort: "medium", schema: INTENT, prompt: `You are the intake of a media-making agent on Magic Hour's FREE plan. Read the whole conversation and decide what the user wants made, which ONE tool makes it, and fill that tool's parameters.

TOOLS (pick exactly one; video_production only when the request needs more than one clip or a story with several scenes):
${toolList}

RULES
- aspect for a tool whose output IS the picture (edit_image, adjust_image, upscale, the swaps): the PICTURE'S OWN shape is the derived value (each attachment lists it) unless the user names a destination or a shape; never ask for it in that case. For a VIDEO made from a picture (create_video_from_image, create_talking_photo) the destination decides the shape, so aspect is missing until the user names where it goes or a shape; ask (it fits in the budget).
- A tone-only change to a picture (warmer, cooler, brighter, darker, more contrast, black and white, "a bit more X") is adjust_image (a filter, no regeneration), not edit_image. "Resize / the right sizes / for socials" with a picture is resize_image with targets as aspect ratios. Several video attachments and "put these together / edit these into one" is join_videos (order, transition, music mood if wanted, any title words).
- needs_research = true when the request is about a real recent event, a real place, person, product or organisation whose facts the result must get right (a news reel, "the latest X", a real festival); then research_queries = 2–5 web searches. false for invented or generic subjects.
- deliverables: when the request asks for SEVERAL things (a product shot AND a poster AND a film), list them in the order they should be made, each with its own one-line brief and the tool that makes it, and uses_previous = true when it should use the previous deliverable as its reference (the poster uses the product shot; the film's clips use the product shot). Then tier is "campaign" and tool is the FIRST deliverable's tool. For a single thing, deliverables = [].
- A request whose sound is a VOICE-OVER (narration we must write or read out, facts told in words) is video_production even if it is one clip: the voice is a separate track mixed under the picture, never generated inside the clip. create_video_from_text is for clips that are silent, ambient or music only.
- "extend / continue / make it longer" with a video attached is extend_video: continuation = what the user says happens next (source user) or, if they say nothing about it, "continue naturally" (source default: the clip itself is read to decide); seconds is required.
- Tier: simple = text (or text + one picture) and one deliverable; pictures = the user's attached pictures must be used as themselves (a face, a product, a place); video = several clips or a story; refuse = ${REFUSE.join("; ")}; unclear = you cannot tell what is wanted.
- Every parameter of the chosen tool gets an entry. source "user" = the user said it (quote it in "from"); "derived" = it follows from what the user said (say how in "from", e.g. "Instagram story → 9:16"); "default" = a free-tier default the user can overrule (say which, e.g. "sound: none, silent unless asked"), allowed ONLY for: look, position, transition, voice, language (English), keep; a default LOOK for a designed piece (poster, flyer, card, social graphic, ad) must be a real design direction that fits the subject (a palette with one strong colour, a visual motif or illustration, type with character), never "clean, simple, readable"; "missing" = required and not derivable → ask.
- Types: ${Object.entries(PARAM_TYPES).map(([k, v]) => `${k}: ${v}`).join("; ")}. aspect is NEVER defaulted: if the user did not say where it will be shown or the shape, it is missing. seconds for a clip is missing unless said or clearly implied ("a reel" → 15). sound for a video is missing unless said ("silent", "with music", "a voice-over" count).
- exact_words is REQUIRED (missing unless given, or unless the user said we may write them) whenever the deliverable is a poster, flyer, card, sign, label, logo, social post with copy, banner or ad: ask "Should any words appear on it? If so, which, exactly?". A photo, portrait, product shot or scene without copy does not need it ("none" as derived).
- exact_words are never invented: they come from the user, or stay missing with the question "Should I write them, or do you have the words?"; only an explicit "you write them" / "your call" lets you draft them (then source "default", and "from" says the user let you write them). "The usual stuff" is NOT permission: ask what the usual stuff is.
- "for the website" or "for social" alone does not give the shape: aspect stays missing and the question names the places (a wide banner, a square post, a tall story).
- Questions: for each missing required parameter, one plain non-technical question (ask where it will be posted, not the ratio; how long, not the frame count). At most 3 per turn, the most blocking first. If the user answered "your call" for a parameter, it is not missing: fill it as "default" with your choice and say so in "from".
- Attachments: name each attached file's role (person / copy such as a logo, label or sign / product / environment / other) and whether this request uses it as a reference, only describes it, or ignores it. Up to TWO attachments may be "reference" for a single-call task; priority person > copy > product > environment. A request that puts a pictured thing into a different place (this car on that bridge; this person in this room) is create_video_from_text with both pictures as references (the clip is built from scratch around them), NOT create_video_from_image, which only continues the picture it is given. create_video_from_image is for animating the picture as it is.
- direction_changed: true when the latest user message changes the deliverable, the subject or the tool from what earlier messages asked for; then the sheet is rebuilt for the new request and earlier answers that no longer apply are dropped.
- "say": one or two sentences to the user: what you understood and, if nothing is missing, what you are about to make; if refusing, why and the nearest thing you can do instead.
- Strange or off-topic answers: do not invent values from them; keep the parameter missing and ask again more simply, or note the user's answer as "user" if it does answer in an indirect way.

ATTACHMENTS: ${attachments.length ? attachments.map((a) => `${a.name} (${a.kind}${a.aspect ? `, shape ${a.aspect}` : ""}${a.seconds ? `, ${a.seconds} s` : ""}${a.seen ? `: ${a.seen}` : ""})`).join("; ") : "none"}
${previous ? `PREVIOUS TURN'S SHEET (keep values the user has already given unless the direction changed): ${JSON.stringify(previous.params)}` : ""}

CONVERSATION (oldest first):
${messages.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n")}` });
  // code-side parsing of plain answers for the three parameters that matter most, so "Instagram story" becomes 9:16 even if the model left it missing
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text || "", allUser = messages.filter((m) => m.role === "user").map((m) => m.text).join("\n");
  // a visual tool always carries an aspect row (the model sometimes folds "square" into keep and lists no aspect at all)
  if (TOOLS[r.tool]?.params.includes("aspect") && !r.params.some((p) => p.name === "aspect")) r.params.push({ name: "aspect", value: "", source: "missing", from: "" });
  // the user's own words for the shape beat a picture-derived or defaulted shape
  { const said = parseAspect(attachments.length ? allUser.replace(/\b(poster|flyer|print|a4|letter)\b/gi, "") : allUser), p = r.params.find((x) => x.name === "aspect"); if (said && p && p.source !== "user" && p.value !== said) { p.value = said; p.source = "user"; p.from = `the user's words ("${(allUser.match(/\b(16:9|9:16|1:1|4:3|3:4|4:5|square|portrait|vertical|landscape|widescreen|story|reel|tiktok|youtube|banner|instagram|facebook|linkedin|print|poster)\b/i) || [said])[0]}")`; r.questions = r.questions.filter((q) => q.param !== "aspect"); } }
  for (const p of r.params) {
    if (p.source !== "missing") continue;
    const v = p.name === "aspect" ? parseAspect(lastUser) : p.name === "seconds" ? parseSeconds(lastUser) : p.name === "sound" ? parseSound(lastUser) : null;
    if (v != null) { p.value = String(v); p.source = "derived"; p.from = `parsed from "${lastUser.slice(0, 60)}"`; r.questions = r.questions.filter((q) => q.param !== p.name); }
    else if (YOUR_CALL.test(lastUser) && r.questions.length === 1 && r.questions[0].param === p.name) { p.source = "default"; p.value = p.value || ({ aspect: "16:9", seconds: "10", sound: "none" }[p.name] || ""); p.from = "the user said it is our call"; r.questions = []; }
  }
  for (const p of r.params) if (p.name === "aspect" && p.source === "missing" && !/create_video_from_image|create_talking_photo/.test(r.tool)) { const pic = attachments.find((a) => a.kind === "image" && a.aspect) || attachments.find((a) => a.kind === "video" && a.aspect); if (pic) { p.value = pic.aspect; p.source = "derived"; p.from = `the shape of ${pic.name}`; r.questions = r.questions.filter((q) => q.param !== "aspect"); } }
  // when the picture's shape is NOT a safe answer, ask where it goes: a video made from a picture; a destination named without a shape
  // ("for the website", "for social"); or several pictures of different shapes. The user's own shape word (parsed above) always wins.
  // a "user" shape the user never typed (the model sometimes invents a "previously supplied value") is only a derivation
  { const p = r.params.find((x) => x.name === "aspect"); if (p && p.source === "user" && !parseAspect(attachments.length ? allUser.replace(/\b(poster|flyer|print|a4|letter)\b/gi, "") : allUser)) { p.source = "derived"; p.from = `assumed (${p.from})`; } }
  const shapeText = attachments.length ? allUser.replace(/\b(poster|flyer|print|a4|letter)\b/gi, "") : allUser, askedShape = messages.some((m) => m.role === "assistant" && /\b(square|tall|wide|shape|format|where will|posted|shown)\b/i.test(m.text));
  { const p = r.params.find((x) => x.name === "aspect"), shapes = new Set(attachments.filter((a) => a.aspect).map((a) => a.aspect)), named = /\b(website|web ?site|web|social|socials|online|site|homepage|ad|advert)\b/i.test(allUser);
    if (p && p.source !== "user" && p.source !== "default" && !askedShape && !parseAspect(shapeText) && (/create_video_from_image|create_talking_photo/.test(r.tool) || named || shapes.size > 1 || (attachments.filter((a) => a.kind === "image").length > 1 && !/swap/.test(r.tool)))) { p.value = ""; p.source = "missing"; p.from = ""; if (!r.questions.some((q) => q.param === "aspect")) r.questions.unshift({ param: "aspect", question: QUESTIONS.aspect }); } }
  // a designed piece (post, poster, flyer, banner, card, ad) carries words: unless the user quoted them or was already asked, ask which exactly
  { const w = r.params.find((x) => x.name === "exact_words"), askedWords = messages.some((m) => m.role === "assistant" && /\bwords?\b/i.test(m.text));
    if (r.tool === "generate_image" && /\b(post|poster|flyer|banner|card|ad|advert|announcement|invite|invitation)\b/i.test(allUser) && !askedWords && !/["“”']/.test(allUser) && !r.questions.some((q) => q.param === "exact_words")) { if (w) { w.value = ""; w.source = "missing"; } else r.params.push({ name: "exact_words", value: "", source: "missing", from: "" }); r.questions.unshift({ param: "exact_words", question: QUESTIONS.exact_words }); } }
  // an edit whose change the user never stated is asked, not assumed
  { const e = r.params.find((x) => x.name === "edit"); if (r.tool === "edit_image" && e && e.source !== "user" && !r.questions.some((q) => q.param === "edit")) { e.value = ""; e.source = "missing"; r.questions.unshift({ param: "edit", question: QUESTIONS.edit }); } }
  const tool = TOOLS[r.tool];
  if (tool) { for (const q of [...r.questions]) if (!tool.params.includes(q.param)) r.questions = r.questions.filter((x) => x !== q); for (const name of tool.required) { const p = r.params.find((x) => x.name === name); if ((!p || p.source === "missing") && !r.questions.some((q) => q.param === name)) r.questions.push({ param: name, question: QUESTIONS[name] || `What should the ${name} be?` }); } }
  r.questions = r.questions.slice(0, 3);
  r.ready = r.tier !== "unclear" && r.tier !== "refuse" && r.questions.length === 0;
  return r;
}
