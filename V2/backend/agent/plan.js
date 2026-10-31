// The plan: the desired state (from the sheet) against the current state (the materials and the session), and the
// shortest path of tool groups between them, each step with its tool, its inputs, what it produces, and the
// parameters the tool needs. The model proposes the steps; code assigns the model and the cost per step from the
// registry by tier, and marks a tier move only where a step needs what the tier's model lacks.
import { jsonCall, S } from "../lib/llm.js";
import { catalogueText, tool as toolOf } from "./catalogue.js";
import { TIERS, STILLS, VIDEOS, stillCost, videoRate } from "../lib/models.js";

const STEP = S.obj({ group: S.str, tool: S.str, inputs: S.arr(S.str), produces: S.str, params: S.obj({ seconds: S.num, aspect: S.str, resolution: S.str, prompt_or_change: S.str, extra: S.str }), why: S.str, needs_beyond_free: S.str });
const SCHEMA = S.obj({ shape: S.enum(["single", "tree", "film"]), say: S.str, desired_state: S.str, current_state: S.str, steps: S.arr(STEP), questions_left: S.arr(S.str), refuse: S.str });

export async function plan({ sheet, materials = [], session = [], tier = "free" }) {
  const fields = sheet.fields.filter((f) => f.source !== "not_applicable" && f.value).map((f) => `${f.field}: ${f.value} (${f.source})`).join("\n");
  const prompt = `You plan tool calls for an agent that makes and changes images, videos and sounds. Do NOT call anything; write the plan.
Reason in STATES: the desired state is what the sheet asks for; the current state is what exists (the materials, the session's assets). Find the shortest path of tool groups from current to desired, one step per transition, naming the in-between asset each step produces. Prefer one tool over two; prefer a change to an existing asset over a generation from nothing when the user supplied the thing; "film" is only for something with a story (an ad, a short, a drama, a podcast), never for a swap, a caption, an upscale or one picture. "edit-run" is only for an asset this session made from a run. A voice track's length sets the clip length that carries it. Never plan a face swap onto a real public person from a found photo: put that in refuse.
- params.seconds: the clip length (0 when none); params.aspect: 16:9, 9:16, 1:1 or ""; params.resolution: "" (the tier decides) unless the request names one; params.prompt_or_change: one line, what the tool is told; params.extra: anything else the endpoint needs (a language, a range in seconds, a count), else "".
- needs_beyond_free: "" normally; else one line naming what no free model gives for this step (references in image-to-video, 1080p, more than 2 input pictures for an edit on qwen, more than 5 on flux-2-klein, a length above the grid).
- questions_left: anything the sheet still lacks that the tool cannot run without (usually empty: the sheet was filled first).
- refuse: "" or one line if the request must be declined.
- shape: "single" when one element and one tool (or a short chain) does it; "tree" when the desired state has MORE THAN ONE element that must coexist (a product AND a headline AND a logo), or text on the picture, or variants (sizes, slides), or a sequence of pictures; "film" when there is a story (an ad with action, a short, a drama, a podcast, a trailer).
- for "tree": decompose. First the sub-elements, one node each: a supplied element whose look must change is an image-edit of that material; an element with no material is an image generation; a logo or any supplied FILE is an input to the compose. TEXT (a headline, a caption, a label, a price) is NEVER asked of an image model: it is its own node, tool "text-overlay", AFTER the picture it goes on, taking that picture as its one input, with the exact words in params.prompt_or_change and params.extra = "at: top|middle|bottom"; a size variant that must carry the text is cut from the overlaid picture. Match GUARANTEES to what the desired state needs: if it needs legible words, exact placement or an identity, use a tool that guarantees it; never a tool that CANNOT. Then the COMPOSE nodes: one image-edit whose inputs name the produced sub-elements (by their produces name) plus the supplied text/logo files. Then variants: one node per size or slide, taking the compose. Every node's inputs name ONLY materials (files the user supplied) or earlier nodes' produces (file names); produces is a file name; no node takes a file nothing made; never put words, text or a headline in inputs.
- for "film": the nodes are EXACTLY story → assets → screenplay → keyframes → clips → film, in that order, each taking the previous one's produces (story takes nothing; assets takes story.json and the materials); params.seconds on clips is the film length; nothing else is invented.
- say: one or two short sentences TO THE USER, plain words, first person: what you understood and what you are about to do (name the tool in words, not its id: "I'll put the logo onto the mug photo with one edit"); mention a choice you made only if the user did not state it; no parameters, no prompts, no costs.

TOOLS, by group:
${catalogueText()}

SHEET (goal: ${sheet.goal.value}${sheet.refers_to ? `; refers to ${sheet.refers_to}` : ""}):
${fields}

MATERIALS: ${materials.length ? materials.join(", ") : "none"}
SESSION assets: ${session.length ? session.map((a) => `${a.label} (${a.kind}${a.from ? `, from ${a.from}` : ""})`).join("; ") : "none"}
TIER: ${tier}`;
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
    else { s.credits = { "upscale-image": 25, "face-swap-photo": 10, "face-swap-video": 0, "background-remove": 5, captions: Math.round(4.8 * (s.params.seconds || 10)), colorize: 10 }[def.id] ?? 0; }
    if (s.needs_beyond_free && tier === "free") move ??= { step: s.tool, why: s.needs_beyond_free };
    total += s.credits;
  }
  return { ...p, tier, estimate_credits: total, tier_move: move };
}
