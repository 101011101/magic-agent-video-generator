// The plan: the desired state (from the sheet) against the current state (the materials and the session), and the
// shortest path of tool groups between them, each step with its tool, its inputs, what it produces, and the
// parameters the tool needs. The model proposes the steps; code assigns the model and the cost per step from the
// registry by tier, and marks a tier move only where a step needs what the tier's model lacks.
import { jsonCall, S } from "../lib/llm.js";
import { catalogueText, tool as toolOf } from "./catalogue.js";
import { TIERS, STILLS, VIDEOS, stillCost, videoRate } from "../lib/models.js";

const STEP = S.obj({ group: S.str, tool: S.str, inputs: S.arr(S.str), produces: S.str, params: S.obj({ seconds: S.num, aspect: S.str, resolution: S.str, prompt_or_change: S.str, extra: S.str }), why: S.str, needs_beyond_free: S.str });
const SCHEMA = S.obj({ shape: S.enum(["single", "tree", "film"]), say: S.str, desired_state: S.str, current_state: S.str, steps: S.arr(STEP), questions_left: S.arr(S.str), refuse: S.str });

export async function plan({ sheet, materials = [], session = [], tier = "free", focus = null }) {
  const fields = sheet.fields.filter((f) => f.source !== "not_applicable" && f.value).map((f) => `${f.field}: ${f.value} (${f.source})`).join("\n");
  const prompt = `You plan tool calls for an agent that makes and changes images, videos and sounds. Do NOT call anything; write the plan.
Reason in STATES: the desired state is what the sheet asks for; the current state is what exists (the materials, the session's assets). Find the shortest path of tool groups from current to desired, one step per transition, naming the in-between asset each step produces. Prefer one tool over two; prefer a change to an existing asset over a generation from nothing when the user supplied the thing; "film" (the story chain) is only for a STORY with characters and scenes longer than 20 seconds, or when the user asks for a film, a short film, a drama or a trailer; never for an ad, promo, reel, slideshow, explainer, podcast, loop or clip of 20 seconds or less, never for a swap, a caption, an upscale or one picture: those are trees (see VIDEO TREES). "edit-run" is only for an asset this session made from a run. A voice track's length sets the clip length that carries it. REFUSE (put one line in refuse, plan no steps, and offer the safe version in say): a real, identifiable public person (a celebrity, a politician) shown endorsing, saying or doing something, whether by face swap, by generation or by an edit; any face swap, head swap or face edit of a child; a brand's logo or trademark (Nike swoosh, Apple logo) put on a product the user did not say is theirs; anything sexual involving a real person.
QUESTIONS ABOUT WHAT YOU CAN DO ("can you…", "is it possible on the free plan…", "don't make it yet, just tell me"): answer in say from the FREE TIER facts below, plan NO steps; if they then want it, they will say so. A request for a paid model or a resolution the tier lacks: plan the steps on the tier's model only if the user did not forbid substitution, and always fill needs_beyond_free on that step; if they forbade substitution or asked you to check first, plan no steps and ask for the yes in say.
OPEN CHOICES: when a choice only the user can make is open (which of two people, which picture, a date or name the user must supply), put it in questions_left and plan NO steps; never ask a question in say while planning steps.
FREE TIER facts: stills flux-2-klein or qwen at 640 px (no 1k/2k/4k); video minimax-h3 or ltx-2.5 at 480p (no 720p/1080p/4K), up to 10 s a clip, longer pieces are several clips assembled; image-to-video takes one start picture (and optionally an end picture), no other references; music up to 300 s; subtitles; face swap on photos and on clips (about 30 credits a second of clip); lip sync "lite" (about 30 credits a second); talking photo from a picture and a voice (about 30 credits a second); upscale ×2; background removal; speech by the voice tool in neutral synthetic voices (not imitations of anyone); text, cropping, cutting, assembling and overlays by code at no credit.
- params.seconds: the clip length (0 when none); params.aspect: 16:9, 9:16, 1:1 or ""; params.resolution: "" (the tier decides) unless the request names one; params.prompt_or_change: one line, what the tool is told; params.extra: anything else the endpoint needs (a language, a range in seconds, a count), else "".
- needs_beyond_free: "" normally; else one line naming what no free model gives for this step (references in image-to-video, 1080p, more than 2 input pictures for an edit on qwen, more than 5 on flux-2-klein, a length above the grid).
- questions_left: anything the sheet still lacks that the tool cannot run without (usually empty: the sheet was filled first).
- refuse: "" or one line if the request must be declined.
- shape: "single" when one element and one tool (or a short chain) does it; "tree" when the desired state has MORE THAN ONE element that must coexist (a product AND a headline AND a logo), or text on the picture, or variants (sizes, slides), or a sequence of pictures; "film" only as above (a story longer than 20 s, or a film the user asked for by name).
- for "tree": decompose. First the sub-elements, one node each: a supplied element whose look must change is an image-edit of that material; an element with no material is an image generation; a logo or any supplied FILE is an input to the compose. TEXT comes in two kinds. (a) Words LAID OVER the picture, a headline, a caption, a label, a price, a title card: a "text-overlay" node AFTER the picture it goes on, taking that picture as its one input, the exact words in params.prompt_or_change, params.extra = "at: top|middle|bottom". (b) Words that are PART OF THE SCENE, a neon sign, a shop front, a jersey number, graffiti, a label on a bottle: an image-edit that paints the sign into the picture (the model may misspell; on a tight tier add a "check" node after it asking whether the word reads correctly). Never an overlay for a sign; never an edit for a caption. When an overlay will add the words, the image-edit prompt before it must NOT mention a headline, a caption, text or the words (an image model paints gibberish letters when it hears "headline"); ask for "a clear, uncluttered area at the top" instead. A SIZE or aspect variant is a "crop" node (code, 0 credits, params.aspect set, params.extra "anchor: top|center|bottom") of the picture that already carries its text; never ask an image model to crop. Match GUARANTEES to what the desired state needs: if it needs legible words, exact placement or an identity, use a tool that guarantees it; never a tool that CANNOT. Then the COMPOSE nodes: one image-edit whose inputs name the produced sub-elements (by their produces name) plus the supplied text/logo files. Then variants: one node per size or slide, taking the compose. Every node's inputs name ONLY materials (files the user supplied) or earlier nodes' produces (file names); produces is a file name; no node takes a file nothing made; never put words, text or a headline in inputs.
- for "film": the nodes are EXACTLY story → assets → screenplay → keyframes → clips → film, in that order, each taking the previous one's produces (story takes nothing; assets takes story.json and the materials); params.seconds on clips is the film length; nothing else is invented.
- VIDEO TREES (short videos, all by nodes, no film chain): an ad, promo or reel of up to 20 s is its shots as pictures (the user's photos, or "image" nodes, or image-edits of a supplied product), each animated by "image-to-video" (5 s each, one prompt per shot saying the motion), then ONE "assemble" taking every shot clip in order plus a "music" (or "voice") node, params.seconds = the total, params.aspect = the final aspect; exact words (a name, a date, a price, a URL) go on the assembled clip with "text-overlay" (extra "at: top|middle|bottom; from: 0; to: 3" for timing). Photos the user wants "made into a reel or slideshow" go straight into "assemble" (no image-to-video unless they ask for motion). Music on the user's clip: "music" then "assemble" (the clip, the music). A voice-over: "write" the script (or the user's words) then "voice" then "assemble" with the clip or a picture. A podcast: "write" a script with speaker names ("Name: line") then "voice" then "assemble" with one picture (an audiogram). Reframe a clip (16:9 to 9:16): "crop" with params.aspect. Cut a clip: "trim" (extra "from: 2; to: 12"). A still from a clip (a thumbnail): "frame" (extra "at: 3"). A logo, watermark or sticker on a picture or clip: "place" (inputs: the base, then the logo; extra "corner: top-right; scale: 0.15"). Subtitles: "captions". A loop: one "image-to-video" whose end picture is its start picture (inputs: the picture twice). Never plan "estimate" or "gate" as steps; "search" only for facts about a real thing; "edit-run" only for a film run this session made, never for a follow-up on a tree (redo or edit that node instead).
- words that must be WRITTEN (a post's text, a caption, a slogan the user did not supply, a shot list) are a "write" node (0 credits) whose output .txt feeds the overlay or the voice; a verdict the user asked for ("make sure the face is the same") is a "check" node after the picture.
- say: one or two short sentences TO THE USER, plain words, first person: what you understood and what you are about to do (name the tool in words, not its id: "I'll put the logo onto the mug photo with one edit"); mention a choice you made only if the user did not state it; no parameters, no prompts, no costs.

TOOLS, by group:
${catalogueText()}

SHEET (goal: ${sheet.goal.value}${sheet.refers_to ? `; refers to ${sheet.refers_to}` : ""}):
${fields}

MATERIALS: ${materials.length ? materials.join(", ") : "none"}
SESSION assets: ${session.length ? session.map((a) => `${a.label} (${a.kind}${a.from ? `, from ${a.from}` : ""})`).join("; ") : "none"}
TIER: ${tier}${focus ? `\nFOCUS: the user is talking about ${focus.step.produces}, made by a ${focus.step.tool} node ("${(focus.step.params?.prompt_or_change || "").slice(0, 120)}", inputs ${focus.step.inputs.join(", ") || "none"}). Plan the change to THAT: take ${focus.step.produces} as the input of the first step (or redo that node's tool with the changed instruction and its original inputs), and nothing else from the session unless asked.` : ""}`;
  const out = await jsonCall({ name: "agent-plan", effort: "low", schema: SCHEMA, prompt });
  return price(out, tier);
}

// Code assigns the model and the cost per step from the registry; the model never picks a model.
export function price(p, tier) {
  const t = TIERS[tier] || TIERS.free;
  // The shape follows the nodes, whatever the model called it: one node is single; the story chain is film.
  p.shape = p.steps.some((s) => s.tool === "story") ? "film" : p.steps.length <= 1 ? "single" : p.shape === "film" ? "tree" : p.shape || "tree";
  let total = 0, move = null;
  for (const s of p.steps) {
    const def = toolOf(s.tool);
    s.model = ""; s.credits = 0;
    if (!def) { s.unknown_tool = true; continue; }
    if (def.kind === "still") { s.model = t.still; s.resolution = s.params.resolution || t.res; try { s.credits = stillCost(s.model, s.resolution); } catch { s.credits = STILLS[s.model]?.cost?.[t.res] ?? 0; s.resolution = t.res; } }
    else if (def.kind === "video") { s.model = t.video; s.resolution = s.params.resolution || t.vres; const sec = s.params.seconds || 5; try { s.credits = sec * videoRate(s.model, s.resolution, true); } catch { s.credits = sec * (VIDEOS[s.model]?.cost?.[t.vres] ?? 24); s.resolution = t.vres; } }
    else if (def.kind === "pipeline") {
      const secs = Number(p.steps.find((x) => x.tool === "clips" || x.tool === "film")?.params.seconds) || 30;
      if (def.id === "keyframes") { s.model = t.still; s.resolution = t.res; s.credits = Math.round(secs / 2.5) * (STILLS[t.still]?.cost?.[t.res] ?? 5); }   // about one still per 2.5 s of film
      else if (def.id === "clips") { s.model = t.video; s.resolution = t.vres; s.credits = secs * (VIDEOS[t.video]?.cost?.[t.vres] ?? 24); }
      else if (def.id === "assets") { s.model = t.still; s.credits = 6 * (STILLS[t.still]?.cost?.[t.res] ?? 5); }
      else { s.model = def.id === "film" && p.shape !== "film" ? `${t.still} + ${t.video}` : "text"; s.credits = def.id === "film" && p.shape !== "film" ? Math.round(secs * 33) : 0; }
    }
    else if (def.credits) { s.credits = def.id === "music" ? Math.round(s.params.seconds || 30) : 0; }
    else if (def.custom) { s.model = "code"; s.credits = 0; }
    else { s.credits = { "upscale-image": 25, "face-swap-photo": 10, "face-swap-video": Math.ceil(30 * (s.params.seconds || 10)), "lip-sync": Math.ceil(30 * (s.params.seconds || 10)), "talking-photo": Math.ceil(30 * (s.params.seconds || 10)), "background-remove": 5, captions: Math.round(4.8 * (s.params.seconds || 10)), colorize: 10 }[def.id] ?? 0; }
    if (s.needs_beyond_free && tier === "free") move ??= { step: s.tool, why: s.needs_beyond_free };
    total += s.credits;
  }
  return { ...p, tier, estimate_credits: total, tier_move: move };
}
