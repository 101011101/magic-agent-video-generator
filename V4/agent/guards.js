// Deterministic guards, run on a ready sheet before anything is called. Each returns {ok, fixes[], blocks[]}: a fix is applied
// silently and reported; a block stops the run with a plain sentence for the user.
import { TOOLS, GRID, FREE, REF_PRIORITY } from "./catalogue.js";
export function guards({ tool, params, attachments = [], cap = { spent: 0, limit: Infinity } }) {
  const t = TOOLS[tool], P = Object.fromEntries(params.map((p) => [p.name, p.value])), fixes = [], blocks = [];
  if (!t) return { ok: false, fixes, blocks: [`no such tool: ${tool}`], P };
  // 1. input types: what the tool needs must be attached (or produced earlier)
  const kinds = attachments.map((a) => a.kind);
  for (const need of t.in) { if (need.endsWith("?")) continue; const opts = need.split("|"); if (!kinds.some((k) => opts.includes(k))) blocks.push(`${tool} needs a ${need} and none was attached`); else kinds.splice(kinds.findIndex((k) => opts.includes(k)), 1); }
  // 2. the model's grid: aspect, seconds, resolution
  const model = t.model, g = GRID[model];
  if (g) {
    if (P.aspect && g.aspects && !g.aspects.includes(P.aspect)) { const near = /^(3:4|4:5|2:3)$/.test(P.aspect) ? "9:16" : /^(4:3|3:2)$/.test(P.aspect) ? "16:9" : g.aspects[0]; fixes.push(`aspect ${P.aspect} is not on ${model}; using ${near}`); P.aspect = near; }
    if (g.maxSeconds && Number(P.seconds) > g.maxSeconds) { fixes.push(`${P.seconds} s is more than one ${model} call (${g.maxSeconds} s); this becomes several clips`); P.split = true; }
    if (Number(P.seconds) < 1) { fixes.push("seconds under 1; using 5"); P.seconds = "5"; }
  }
  // 3. one reference per call, by priority; the rest are described
  const refs = attachments.filter((a) => a.use === "reference"), maxRefs = tool === "video_production" ? 1 : 2;   // small tasks may carry two references; a film's clips take one
  if (refs.length > maxRefs) { const sorted = [...refs].sort((a, b) => REF_PRIORITY.indexOf(a.role) - REF_PRIORITY.indexOf(b.role)); for (const r of sorted.slice(maxRefs)) { r.use = "describe"; fixes.push(`${r.name} (${r.role}) is described in words; ${sorted.slice(0, maxRefs).map((x) => x.name).join(" and ")} ${maxRefs === 1 ? "is the one reference" : "are the two references"}`); } }
  if (tool === "create_video_from_image" && refs.length >= 2) { fixes.push("two references: text-to-video on minimax-h3 with both as named references instead of a start frame"); P.route = "refs"; }
  for (const r of attachments.filter((a) => a.use === "reference")) if (r.clean === false) blocks.push(`${r.name} was made by a free image editor and is not a clean reference; use the original photo or a text-to-image still`);
  // 4. exact words: in a video they go through the overlay, not the generator (except a short sign that may fail)
  if (P.exact_words && P.exact_words !== "[]" && t.out === "video") fixes.push(`exact words "${P.exact_words}" will be overlaid after the clip; the prompt may also ask for them on a sign`);
  // 5. sound: a silent video strips any sound bed the model adds
  if (t.out === "video" && (P.sound === "none" || !P.sound)) fixes.push("audio off: any sound bed the model returns is stripped");
  // 6. the cap
  const cost = t.cost(P); if (cap.spent + cost > cap.limit) blocks.push(`this would cost about ${cost} credits and the cap (${cap.limit}) has ${Math.max(0, cap.limit - cap.spent)} left`);
  return { ok: blocks.length === 0, fixes, blocks, P, cost, model };
}
