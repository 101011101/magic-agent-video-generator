// The plan: the desired state (from the sheet) against the current state (the materials and the session), and the
// shortest path of tool groups between them, each step with its tool, its inputs, what it produces, and the
// parameters the tool needs. The model proposes the steps; code assigns the model and the cost per step from the
// registry by tier, and marks a tier move only where a step needs what the tier's model lacks.
import { jsonCall, S } from "../lib/llm.js";
import { catalogueText, tool as toolOf } from "./catalogue.js";
import { TIERS, STILLS, VIDEOS, stillCost, videoRate } from "../lib/models.js";

const STEP = S.obj({ group: S.str, tool: S.str, inputs: S.arr(S.str), produces: S.str, params: S.obj({ seconds: S.num, aspect: S.str, resolution: S.str, prompt_or_change: S.str, extra: S.str }), why: S.str, needs_beyond_free: S.str });
const SCHEMA = S.obj({ desired_state: S.str, current_state: S.str, steps: S.arr(STEP), questions_left: S.arr(S.str), refuse: S.str });

export async function plan({ sheet, materials = [], session = [], tier = "free" }) {
  const fields = sheet.fields.filter((f) => f.source !== "not_applicable" && f.value).map((f) => `${f.field}: ${f.value} (${f.source})`).join("\n");
  const prompt = `You plan tool calls for an agent that makes and changes images, videos and sounds. Do NOT call anything; write the plan.
Reason in STATES: the desired state is what the sheet asks for; the current state is what exists (the materials, the session's assets). Find the shortest path of tool groups from current to desired, one step per transition, naming the in-between asset each step produces. Prefer one tool over two; prefer a change to an existing asset over a generation from nothing when the user supplied the thing; "film" is only for something with a story (an ad, a short, a drama, a podcast), never for a swap, a caption, an upscale or one picture. "edit-run" is only for an asset this session made from a run. A voice track's length sets the clip length that carries it. Never plan a face swap onto a real public person from a found photo: put that in refuse.
- params.seconds: the clip length (0 when none); params.aspect: 16:9, 9:16, 1:1 or ""; params.resolution: "" (the tier decides) unless the request names one; params.prompt_or_change: one line, what the tool is told; params.extra: anything else the endpoint needs (a language, a range in seconds, a count), else "".
- needs_beyond_free: "" normally; else one line naming what no free model gives for this step (references in image-to-video, 1080p, more than 2 input pictures for an edit on qwen, more than 5 on flux-2-klein, a length above the grid).
- questions_left: anything the sheet still lacks that the tool cannot run without (usually empty: the sheet was filled first).
- refuse: "" or one line if the request must be declined.

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
  let total = 0, move = null;
  for (const s of p.steps) {
    const def = toolOf(s.tool);
    s.model = ""; s.credits = 0;
    if (!def) { s.unknown_tool = true; continue; }
    if (def.kind === "still") { s.model = t.still; s.resolution = s.params.resolution || t.res; try { s.credits = stillCost(s.model, s.resolution); } catch { s.credits = STILLS[s.model]?.cost?.[t.res] ?? 0; s.resolution = t.res; } }
    else if (def.kind === "video") { s.model = t.video; s.resolution = s.params.resolution || t.vres; const sec = s.params.seconds || 5; try { s.credits = sec * videoRate(s.model, s.resolution, true); } catch { s.credits = sec * (VIDEOS[s.model]?.cost?.[t.vres] ?? 24); s.resolution = t.vres; } }
    else if (def.kind === "pipeline") { s.model = `${t.still} + ${t.video}`; s.credits = def.id === "film" ? Math.round((Number(p.steps.find((x) => x.tool === "film")?.params.seconds) || 30) * 33) : 0; }   // ~1,000 for 30 s on the free tier (08-costs.md)
    else if (def.credits) { s.credits = def.id === "music" ? (s.params.seconds || 30) : 0; }
    if (s.needs_beyond_free && tier === "free") move ??= { step: s.tool, why: s.needs_beyond_free };
    total += s.credits;
  }
  return { ...p, tier, estimate_credits: total, tier_move: move };
}
