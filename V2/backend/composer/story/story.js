// STORY: natural language → a story. The research gate (one small call) decides whether the brief needs facts and sets the
// pipeline's mode: nonfiction (research round with web search; the story written from the facts only, cited) or fiction
// (no research; the story invented from the brief). Text calls only, cached.
import { jsonCall, S } from "../../lib/llm.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function runStory({ brief, log: L, run, say = console.log, seconds = 30, reuse = null }) {
  L.brief = brief;
  // The story is an asset too: a rerun with the same brief keeps the earlier run's gate, research and story, so the element
  // table and the bank match and nothing is procured twice (a fresh story renamed every character and nothing matched).
  if (reuse && !L.story && existsSync(join(reuse, "run.json"))) {
    const old = JSON.parse(readFileSync(join(reuse, "run.json"), "utf8"));
    if (old.brief === brief && old.story) { for (const k of ["gate", "mode", "research", "story"]) if (old[k] !== undefined) L[k] = old[k]; say(`story: reused from ${reuse} ("${old.story.title}")`); run.save(); }
  }
  if (L.story && !L.story.kind) { L.story.kind = (await jsonCall({ name: "film-kind", effort: "low", schema: S.obj({ kind: S.enum(["drama", "ad", "trailer", "documentary", "explainer", "music-video", "short"]) }), prompt: `What kind of film does this brief ask for: drama, ad, trailer, documentary, explainer, music-video or short?\nBrief: ${brief}` })).kind; run.save(); }
  // 1. Gate: does writing this accurately need research? Sets the mode.
  // Two separate questions: are the EVENTS a record (nonfiction) or invented (fiction, an ad)? and do real things in it need
  // their documented looks (research), which can be true in either case: an invented ad can star a real aircraft.
  L.gate ??= await jsonCall({ name: "research-gate-v2", effort: "low", schema: S.obj({ fiction: S.bool, needs_research: S.bool, confidence: S.int, why: S.str, queries: S.arr(S.str) }),
    prompt: `A short film will be written from this brief. Answer two separate questions.
fiction: true if the events are to be invented (a story, an advertisement, a scenario), false if the film must show what actually happened (a true episode, a record).
needs_research: true if any real person, place, event, vessel, aircraft, building or object appears whose facts or documented look matter (then research is needed even for an invented story), false if everything may be made up.
confidence: 0-100 that no research is needed; why: one line; queries: 2-5 web searches that would settle the facts and the documented looks (empty if none).
Brief: ${brief}` });
  L.mode = L.gate.fiction ? "fiction" : "nonfiction";
  say(`gate: ${L.mode}, research ${L.gate.needs_research ? "needed" : "not needed"} (confidence no research needed: ${L.gate.confidence}) · ${L.gate.why}`);
  run.save();

  // 2. Research round (nonfiction): facts with sources and the documented look of the real things.
  if (L.gate.needs_research && !L.research) {
    say("research…");
    L.research = await jsonCall({ name: "research", effort: "medium", tools: [{ type: "web_search" }],
      schema: S.obj({ subject: S.str, facts: S.arr(S.obj({ n: S.int, fact: S.str, when: S.str, source: S.str })), looks: S.arr(S.obj({ thing: S.str, look: S.str, source: S.str })) }),
      prompt: `Research for a short factual film. Brief: ${brief}
Suggested searches: ${L.gate.queries.join(" · ")}
Use web search. Return:
- facts: ${L.mode === "nonfiction" ? `6-10 verified facts, numbered, each with its date and the URL it comes from, around ONE interesting true episode that could be shown on screen in ${seconds} seconds (who, where, what happened, what it led to)` : "4-8 verified facts about the real things in the brief that an invented story must respect (what they are, what they can and cannot do, where they operate), numbered, each with its source URL"}.
- looks: the documented LOOK of every real person, place, vessel, building or object involved (appearance, age at the time, clothing, vessel type and rig, building style) with a source URL each. Only what the sources say; no invention.` });
    run.save();
  }
  const facts = L.research?.facts || [];
  if (L.research) say(`facts: ${facts.length}; looks: ${L.research.looks?.length || 0}`);

  // 3. The story.
  if (!L.story) {
    say("story…");
    const KIND = S.enum(["drama", "ad", "trailer", "documentary", "explainer", "music-video", "short"]);
    const schema = S.obj({ title: S.str, kind: KIND, style: S.str, story: S.str, fact_use: S.arr(S.str) });
    L.story = L.mode === "nonfiction"
      ? await jsonCall({ name: "fact-story", effort: "high", schema, prompt: `Write the story of a ${seconds}-second live-action film from this brief: ${brief}
Use ONLY the facts below (and the documented looks). Every sentence must be supported by a numbered fact; add no invented event, line of dialogue, or object. Pick one episode and show it on screen, in order, in plain prose, 120-200 words; name the real people, places, vessels and years concretely as the facts give them.
- title; kind: what this film is (drama, ad, trailer, documentary, explainer, music-video, short), from the brief; style: one line of visual style (live-action, period-accurate, documentary realism; camera; light).
- story; fact_use: one entry per paragraph, "paragraph N: facts a, b".
Facts:
${facts.map((f) => `${f.n}. (${f.when}) ${f.fact} [${f.source}]`).join("\n")}
Documented looks:
${(L.research?.looks || []).map((l) => `- ${l.thing}: ${l.look} [${l.source}]`).join("\n")}` })
      : await jsonCall({ name: "fiction-story", effort: "high", schema, prompt: `Write the story of a ${seconds}-second film from this brief: ${brief}
Plain prose, 120-200 words, in order, only what a camera can show and a microphone can hear. Name every character, place and important object concretely and consistently (one name each, used every time). Keep the cast small (at most four people) and the places few (two or three). Invent nothing the brief contradicts. If the brief is an advertisement, write the action the ad shows, in order, and the line or title it ends on.
${facts.length || L.research?.looks?.length ? `Real things in it must be true to the record below (what they are and can do, how they look); the events around them are yours to invent.
Facts:
${facts.map((f) => `${f.n}. ${f.fact} [${f.source}]`).join("\n")}
Documented looks:
${(L.research?.looks || []).map((l) => `- ${l.thing}: ${l.look} [${l.source}]`).join("\n")}
` : ""}- title; kind: what this film is (drama, ad, trailer, documentary, explainer, music-video, short), from the brief; style: one line of visual style (the medium: live-action, animation, or another; the look; camera; light).
- story; fact_use: which facts the real things rely on, or empty.` });
    run.save();
  }
  say(`story: ${L.story.title} (${L.mode})`);
  return L;
}
