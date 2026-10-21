// E1 Editor and the state manager's question loop.
//   review    (LLM) right after the story: a logic read for holes (an object used but never placed or brought, unclear who does
//             what, impossible actions) and the story back with minimal edits. The plot is kept.
//   questions (CODE) from what the state manager found: props inferred as always there, assets never on screen or on screen
//             but never mentioned, untagged mentions, rules still broken. One question per finding.
//   answer    (LLM) every open question at once: each gets an edit (a sentence added or changed), "always there" (the story now
//             says so), or "cut". The story comes back with minimal edits; ids and states are solved again.
import { jsonCall, S } from "./llm.js";

export async function reviewStory(story) {
  return jsonCall({ name: "edit-review", effort: "high",
    schema: S.obj({ holes: S.arr(S.obj({ hole: S.str, fix: S.str })), story: S.str }),
    prompt: `You are the story editor of an illustrated film. Read this story for LOGIC holes only:
- an object that is used but never placed anywhere or brought in (where do the stones come from?);
- a character who is somewhere without arriving, or does something with nothing to do it with;
- a pronoun or phrase where it is unclear who or what is meant;
- a physically impossible action.
holes: each hole found and the smallest fix (one sentence added or changed). story: the story with only those fixes made; every
other word unchanged. Do not change the plot, the tone or the length beyond the fixes. If there are no holes, return it unchanged.

Story:\n${story}` });
}

// Findings → questions. `answered` holds keys of questions already answered "always there" so they are not asked again.
export function questions({ blocking, ids, answered = [] }) {
  const out = [], name = (id) => ids.table.find((t) => t.id === id)?.name || id;
  for (const [place, list] of Object.entries(blocking.initial || {}))
    for (const id of list) {
      const key = `initial:${place}:${id}`;
      if (!answered.includes(key)) out.push({ key, q: `${name(id)} is used in ${name(place)} but the story never puts it there or brings it in. Was it there all along (then say so where the place is first described), or did someone bring it (then say who, from where, and when)?` });
    }
  for (const l of blocking.lint || []) {
    let m;
    if ((m = l.match(/^([a-z0-9-]+) is in the story but never on screen/))) out.push({ key: `unseen:${m[1]}`, q: `${name(m[1])} is mentioned but never seen. Where and when should it be seen, or should the mention go?` });
    else if ((m = l.match(/^([a-z0-9-]+) is on screen but the story never mentions it/))) out.push({ key: `unmentioned:${m[1]}`, q: `${name(m[1])} has to be on screen but the story never mentions it. Where is it?` });
    else out.push({ key: `rule:${l}`, q: `The scene plan breaks a rule: "${l}". What does the story say happens here?` });
  }
  for (const c of ids.chunks || []) for (const u of c.untagged || []) out.push({ key: `untagged:${u}`, q: `In "${c.text.slice(0, 120)}…", what does "${u}" refer to?` });
  return out.filter((q, i, a) => a.findIndex((x) => x.key === q.key) === i);
}

export async function answerQuestions(story, qs) {
  return jsonCall({ name: "edit-answer", effort: "high",
    schema: S.obj({ answers: S.arr(S.obj({ key: S.str, kind: S.enum(["edit", "always-there", "cut"]), sentence: S.str })), story: S.str }),
    prompt: `You are the story editor. The scene planner found these questions about the story. Answer ALL of them at once.
For each: kind "edit" (add or change one sentence so the story answers it; prefer the best-known version of the tale), "always-there"
(the thing really was already in that place: add a few words saying so where the place is first described), or "cut" (remove the
mention). sentence: the sentence you added or changed. story: the story with only these edits; every other word unchanged.

Questions:\n${qs.map((q) => `- [${q.key}] ${q.q}`).join("\n")}

Story:\n${story}` });
}
