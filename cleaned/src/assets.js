// A0 Asset bank: one canonical reference sheet per tracked thing, specified in relation to the others and checked.
//   1. spec   (LLM)   every character, group and prop the story uses: what it looks like in detail (hair, clothes, colours,
//                     species and build), its height relative to a grown person, written so the set is consistent together.
//   2. sheet  (image) one subject on a plain light-grey background; nothing else (no scenery, ground, animals, text).
//   3. check  (VLM)   per sheet: single subject, plain background, matches its spec. A failure regenerates it with the misses.
//   4. set    (VLM)   all sheets together: one style, scales that agree with the specs. Offenders get one more try.
// The sheets are the only identity references for the whole film (B-004 passes them; S5 compares frames against them).
import { jsonCall, S } from "./llm.js";
import { frameStyle } from "./seed.js";

const TRIES = 3;
const SPEC = S.obj({ assets: S.arr(S.obj({ id: S.str, spec: S.str, height: S.str })) });

// only: spec just these ids (the rest of the set is still listed, for consistency and for what they contain).
export async function specAssets(world, only = null) {
  const r = await jsonCall({ name: "asset-spec", schema: SPEC, effort: "high",
    prompt: `Write the canonical reference spec of every tracked thing in this story, so all of them can be drawn as one consistent set.
For each id below write:
- spec: 2-4 sentences about the THING ONLY (never the art style, medium, light, background or composition) that a painter can follow exactly: build and proportions, face, hair (style, length, colour), clothes with colours,
  distinctive details that must never change. For an animal say whether it is natural or stands and dresses like a person. For a
  prop: shape, material, colour, size in hands.
  Describe ONLY its normal look at the START of the story, on its own: never later states (a swollen belly, wearing someone
  else's cap, torn, filled) and never other characters or their body parts (no "the dog's ears" in a hat's spec).
- height: relative to a grown person ("a small child, about half a grown person", "a large dog standing on its hind legs, a head taller than a
  grown man", "fits in one hand").
The set must agree with itself: one art style (below), consistent sizes, colours that suit the story's palette, and every detail
the story mentions (a red hooded cape, a white nightcap…).
Style: ${world.style}
Things:
${world.entities.filter((e) => !only || only.includes(e.id)).map((e) => { const inner = world.entities.filter((x) => x.inside === e.id).map((x) => x.name); return `- ${e.id} (${e.kind}): ${e.name}. ${e.look || ""}${inner.length ? ` At the start it holds: ${inner.join(", ")} (draw them in it).` : ""}`; }).join("\n")}
Story (for details it mentions):
${world.story}` });
  return world.entities.filter((e) => !only || only.includes(e.id)).map((e) => ({ ...e, ...(r.assets.find((a) => a.id === e.id) || { spec: e.look, height: "" }) }));
}

export const sheetPrompt = (style, a, note = "") => `${frameStyle(style)}. Reference sheet of ONE ${a.kind === "prop" ? "object" : a.kind === "group" ? "group, all members side by side at their true relative sizes" : "character"}: ${a.name}. ${a.spec}${a.height ? ` Height: ${a.height}.` : ""}
${a.kind === "prop" ? "The object alone, centred, whole, seen slightly from above." : "Full body, front view, standing in a neutral pose, arms relaxed, whole figure visible head to feet."}
Plain light-grey backdrop (seamless studio paper) and nothing else: no scenery, no plants, no buildings, no other characters or animals, no frame or border, no text or labels.${note ? `\nThe last try got this wrong; fix it: ${note}` : ""}`;

// major: a miss that changes who or what it is (species, build, main colours, a signature item, an extra subject or view, a
// later story state); minor misses (a hem a little long, boots vs shoes) do not fail a sheet. score ranks tries when none passes.
const CHECK = S.obj({ single_subject: S.bool, plain_background: S.bool, matches_spec: S.bool, major: S.bool, misses: S.str, score: S.int });
async function checkSheet(file, a) {
  return jsonCall({ name: "asset-check", schema: CHECK, images: [file], effort: "medium",
    prompt: `This should be a reference sheet of ONE ${a.kind}: ${a.name}. Spec: ${a.spec}${a.height ? ` Height: ${a.height}.` : ""}
single_subject: only this one ${a.kind === "group" ? "group" : "subject"} is shown, ONCE (no second view or pose, no other characters, animals or
objects besides what it wears or holds).
plain_background: a plain backdrop with nothing in it (no scenery, trees, buildings, furniture, props or framing). A studio floor
shadow, a soft gradient or seamless-paper look is fine, especially for photographs.
matches_spec: every detail of the spec is right (hair, clothes, colours, build, species). misses: what is wrong, or "".
major: true if a miss changes who or what it is: species or build, main colours, a signature item missing or added (a hood, a
cap, ears on a cap), a later story state (swollen belly, wearing another's clothes), extra subjects or views. Small differences in
length, shade or footwear are not major.
score: 1-5, how good a canonical reference this is (5 = exactly the spec, one subject, plain background).` });
}

// Generate → check → regenerate on a miss (≤ TRIES). Cap errors stop the retries of that asset; the best try is kept.
// keep: assets from an earlier pass that are not redone; their tries are re-checked (LLM only) and the best kept, no images.
export async function makeAssets(world, assets, jobs, tracker, { estimate, keep = {} }) {
  const out = {};
  const attempt = async (a, t, note) => {
    const file = t === 1 ? `roots/${a.id}.png` : `roots/${a.id}-t${t}.png`;
    await jobs.image(t === 1 ? `root-${a.id}` : `root-${a.id}-t${t}`, file, sheetPrompt(world.style, a, note));
    if (estimate) return { t, file, ok: true, chk: null };
    const chk = await checkSheet(jobs.run.path(file), a);
    const ok = chk.single_subject && chk.plain_background && !chk.major;
    console.log(`  sheet ${a.id} try ${t}: ${ok ? "ok" : [!chk.single_subject && "not single", !chk.plain_background && "background", !chk.matches_spec && `spec: ${chk.misses}`].filter(Boolean).join("; ")}`);
    return { t, file, ok, chk };
  };
  const note = (c) => [!c.single_subject && "show ONLY this one subject", !c.plain_background && "plain light-grey studio backdrop, nothing else in the picture", (c.major || !c.matches_spec) && c.misses].filter(Boolean).join("; ");
  const recheck = async (a) => Promise.all(keep[a.id].tries.map(async (t) => {
    const chk = await checkSheet(jobs.run.path(t.file), a), ok = chk.single_subject && chk.plain_background && !chk.major;
    console.log(`  sheet ${a.id} (kept) try ${t.t}: ${ok ? "ok" : chk.misses} · score ${chk.score}`);
    return { t: t.t, file: t.file, ok, chk };
  }));
  const firsts = await Promise.all(assets.map((a) => (keep[a.id] ? recheck(a) : attempt(a, 1, "").then((x) => [x]))));
  for (const [i, a] of assets.entries()) {
    const tries = firsts[i];
    if (keep[a.id]) { const best = tries.reduce((b, x) => ((x.ok ? 10 : 0) + x.chk.score > (b.ok ? 10 : 0) + b.chk.score ? x : b)); out[a.id] = { ...a, file: best.file, tries, ok: best.ok }; continue; }
    try { while (!tries.at(-1).ok && tries.length < TRIES) tries.push(await attempt(a, tries.length + 1, note(tries.at(-1).chk))); }
    catch (e) { if (!/credit cap/.test(e.message)) throw e; console.log(`  sheet ${a.id}: retries stopped (${e.message.split(":")[0]})`); }
    // The best try, not the last: custom-rrh3 kept Red's third try (hood down, short coral cape) over a better first try.
    const best = tries.reduce((b, x) => ((x.ok ? 10 : 0) + (x.chk?.score || 0) > (b.ok ? 10 : 0) + (b.chk?.score || 0) ? x : b));
    out[a.id] = { ...a, file: best.file, tries: tries.map((x) => ({ t: x.t, file: x.file, ok: x.ok, chk: x.chk })), ok: best.ok };
  }
  // The set together: one style, agreeing scales. Offenders get one more try.
  if (!estimate) {
    const ids = Object.keys(out), r = await jsonCall({ name: "asset-set", effort: "medium", images: ids.map((id) => jobs.run.path(out[id].file)),
      schema: S.obj({ sheets: S.obj(Object.fromEntries(ids.map((id) => [id, S.obj({ style_matches_set: S.bool, scale_ok: S.bool, note: S.str })]))) }),
      prompt: `These ${ids.length} images are the reference sheets of one illustrated story, in this order: ${ids.map((id, k) => `image ${k + 1} = ${out[id].name} (height: ${out[id].height || "n/a"})`).join("; ")}.
For each: style_matches_set (same medium, line work, palette and level of detail as the majority, and ONE view of one subject like
the others, not a sheet of several views), scale_ok (its drawn proportions fit its stated height next to the others; for props, true unless absurd). note: what differs, or "".` });
    for (const id of ids) {
      const v = r.sheets[id]; out[id].set = v;
      if (v.style_matches_set && v.scale_ok) continue;
      console.log(`  sheet ${id}: set check — ${v.note}`);
      try {
        const x = await attempt(out[id], out[id].tries.length + 1, `${note(out[id].tries.at(-1).chk || {}) || ""}${v.note ? `; match the other sheets: ${v.note}` : ""}`);
        out[id].tries.push({ t: x.t, file: x.file, ok: x.ok, chk: x.chk });
        if (x.ok) Object.assign(out[id], { file: x.file, ok: true, set_retry: true });
      } catch (e) { if (!/credit cap/.test(e.message)) throw e; console.log(`  sheet ${id}: set retry stopped (cap)`); }
    }
  }
  for (const [id, a] of Object.entries(out)) tracker.roots[id] = a.file;
  tracker.save();
  return out;
}
