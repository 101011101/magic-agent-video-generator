// User archetypes for the proxy user in run.mjs. Asked for on 2026-11-08 ("user archetypes like the stupid user, the happy
// user"), every case run under every archetype. The knowledge bank (the brief as written plus the item's answer sheet) is the
// truth and is the same for every persona; a persona changes only how the user writes the first message and how willingly
// it answers. So the item's checklist holds under every persona, and a difference between two runs of one item is the
// agent's handling of the person. The one exception is the changer, who asks for one change after the result: the change is
// mechanical (changeFor) and the checklist moves with it (applyChange).
//
// opening: null when the first message is the brief as written; otherwise the rule openings.mjs uses to rewrite it, once,
// into openings/<persona>/<id>.json, so every side of a comparison gets the same first message.
// reply: how the user answers the agent. approval: the fixed answer to "may I proceed / spend", or null when the persona
// answers in character. give_up: the one message sent after the round limit (3 answers) when the agent is still asking.
// nudge: the one push sent when the agent says it cannot (or will not) do it without having tried a single call.
const HAPPY_REPLY = `You are cooperative and clear. Answer ONLY what it asks, in one short natural message, using ONLY your knowledge bank. If the bank has no value for something asked, say "your call" for that. If it asks whether to proceed, or how many credits it may spend, say yes, go ahead. Do not add anything that was not asked. Do not restate the request.`;

// The users that run (the user's decision of 2026-11-09: "we do not need that many archetypes"): one who gives the right
// information (happy), one who is lost (stupid), one who gives too much (dumper). The other three below stay defined, not run.
export const SWEEP = ["happy", "stupid", "dumper"];
// Cases where the reply is the result (no file expected), so a dry run that attempts no create call is not a fault there.
export const REPLY_ITEMS = new Set(["C14c", "C15b", "C17c", "E24c", "H43b", "J53a", "J53b", "J53c", "J54a", "J54b", "J54c"]);

export const PERSONAS = {
  happy: {
    label: "Happy user",
    about: "Gives the right information: writes the brief as given, answers what is asked, approves the spend.",
    opening: null,
    reply: HAPPY_REPLY,
    approval: "Yes, go ahead.",
    give_up: "Your call on anything else. Go ahead and make it.",
    nudge: "Please go ahead with the free settings anyway.",
  },
  stupid: {
    label: "Stupid user",
    about: "Lost: types one vague casual line, understands no technical word, gives a fact only when asked in plain words.",
    opening: `Rewrite the request the way a casual, non-technical person types into a chat box: ONE short line, lower-case, little or no punctuation, maybe one typo or abbreviation. No technical word (no aspect ratio, resolution, 16:9, 9:16, fps, reference, render, prompt). Keep only the subject and the kind of thing wanted (a video, a pic, an ad, a poster...). Drop every concrete detail: shape or platform, length, exact words, sound, style, date, venue, which person, colours. Mention each attachment as "this" or "this pic" / "this clip". Every detail dropped goes into withheld, as the plain-words fact the user would give if asked in plain words.`,
    reply: `You are a casual, non-technical person. You do not understand technical words: aspect ratio, resolution, 16:9, 9:16, 4:5, fps, reference image, prompt, model, render, orientation, overlay, export. You do know plain words: vertical or horizontal, square, tall or wide, TikTok, Instagram, YouTube, with sound or silent, how long. When a question uses a technical word, do not answer it: say something like "idk", "what do you mean", "huh?", "whatever's normal" (vary it, stay short). When it asks more than two things at once, answer only the first one you understand. When a question is in plain words, answer it from your knowledge bank, casually and briefly ("tiktok", "like 10 sec", "the blonde one", "no sound"). Never invent a fact that is not in the bank; if the bank has nothing for it, say "whatever" or "you pick". If it asks whether to proceed, say "ya go". One short message, lower-case.`,
    approval: "ya go ahead",
    give_up: "idk just make it",
    nudge: "huh? just try it",
  },
  impatient: {
    label: "Impatient user",
    about: "Two sentences with the facts that matter, tells the agent not to ask, answers one question then stops cooperating.",
    opening: `Rewrite the request as a person in a hurry: one or two short sentences. Keep the facts that matter most: what it is, any attachment (as "this"), any exact words that must appear, the platform or shape if the request names one, the length if it names one. Drop the rest (style notes, mood, camera, colours, reasons) into withheld. End with a push like "quick pls" or "don't ask me a bunch of questions, just make it".`,
    reply: `You are in a hurry and do not want a conversation. The FIRST time it asks you something, answer only that, in a few words, from your knowledge bank (if the bank has nothing for it: "your call"). Every time after that, do not answer questions: say "just make it, your call" or "i don't care, go" (vary it). If it asks whether to proceed, say "yes go". One short message.`,
    approval: "yes go",
    give_up: "stop asking. make it.",
    nudge: "just try it. go.",
  },
  dumper: {
    label: "Oversharing user",
    about: "Gives too much information: buries the facts in a ramble and answers with extras the agent did not ask for; nothing added changes what a correct result looks like.",
    opening: `Rewrite the request as a person who over-explains: 4 to 7 sentences in one paragraph. Keep EVERY fact of the original. Add one or two sentences of backstory or feeling that do not change the result (why they want it, who it is for, a worry about how it will look), and move one or two of the concrete facts (the shape or platform, the length, the exact words, the date or venue, which person) into the middle of the ramble so they are easy to miss. Do not add any new constraint on the result: nothing added may change what a correct output looks like. Each added sentence goes into extras; withheld stays empty.`,
    reply: `You over-explain. Answer what it asks from your knowledge bank, then add one or two sentences it did not ask for: a fact from the bank it has not asked about yet, or harmless backstory (who it is for, why, a worry). Never add a new requirement that is not in the bank. If it asks whether to proceed, say yes and add one more remark. Two to four sentences.`,
    approval: null,
    give_up: "ok ok, just do whatever you think is best, honestly i trust you",
    nudge: "Oh, please just go ahead and try it anyway. I'd rather have something than nothing, and I know the free plan has its limits, that's fine by me.",
  },
  tightwad: {
    label: "Tightwad user",
    about: "Wants the cost before anything runs, says no to the first spend, agrees once a cost or a cheaper version is on the table.",
    opening: `Rewrite the request keeping every fact of the original, then add one or two sentences about money: they are on the free plan, they do not want their credits burned, they want to know what it will cost before anything runs, and whether there is a cheaper, shorter or smaller way to do it. No new constraint on the result itself. The added sentences go into extras; withheld stays empty.`,
    reply: `You worry about cost. Answer what it asks from your knowledge bank, briefly. Whenever it proposes to make something, asks to proceed, or mentions credits: the FIRST time, do not agree; ask how many credits it will cost and whether a cheaper, shorter or smaller version is possible. The SECOND time it asks to proceed, or once it has named a cost or offered a cheaper option, agree: "ok, go ahead with that". Never invent a fact that is not in the bank. One or two sentences.`,
    approval: null,
    give_up: "fine, just do the cheapest version",
    nudge: "ok, go ahead with the cheapest option you listed",
  },
  changer: {
    label: "Changing user",
    about: "The happy user who, after the result, asks for exactly one change and everything else kept.",
    opening: null,
    reply: HAPPY_REPLY,
    approval: "Yes, go ahead.",
    give_up: "Your call on anything else. Go ahead and make it.",
    nudge: "Please go ahead with the free settings anyway.",
    follow_up: `Write the one-line message this user sends after seeing the result: they want exactly this one change and everything else kept. Plain words ("vertical, for stories" rather than "9:16"; "2 seconds shorter" rather than a frame count). Start with "actually" or "can you".`,
  },
};

// The knowledge bank: the brief as written (the facts a rewritten opening left out) plus the item's answer sheet.
export const bankOf = (it) => ({ "The request in full, as you would have written it if you were being thorough": it.turns[0].text, ...it.answer_sheet });

// The changer's one change, mechanical so the checklist can move with it. Not for items whose test is the reply itself.
// The framing of an attached picture or clip is kept (a new shape would fight must-haves about the user's own framing), so
// with an attachment the change is the length, a word or the sound instead. null = nothing to change; the item runs as happy.
const FLIP = { "16:9": "9:16", "9:16": "16:9", "1:1": "9:16", "4:5": "1:1" };
export function changeFor(it) {
  const s = it.spec || {}; if (["none", "text"].includes(s.kind) || it.expect?.refuse) return null;
  const attached = it.turns.some((t) => (t.materials || []).some((m) => /\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(m)));
  if (!attached && FLIP[s.aspect]) return { field: "aspect", from: s.aspect, to: FLIP[s.aspect] };
  if (!attached && s.aspect === "any" && ["image", "images"].includes(s.kind)) return { field: "aspect", from: "any", to: "1:1" };   // a shape where none was asked: "make it square"
  if (s.seconds && s.seconds >= 5) return { field: "seconds", from: s.seconds, to: s.seconds - 2 };
  if (s.exact_text?.length) return { field: "text", from: s.exact_text[s.exact_text.length - 1], to: null };   // `to` is chosen by openings.mjs
  if (s.kind === "video" && s.audio === "none") return { field: "audio", from: "none", to: "required" };
  if (s.kind === "video" && s.audio === "required") return { field: "audio", from: "required", to: "none" };
  return null;
}
const SHAPE = { "16:9": "widescreen 16:9", "9:16": "vertical 9:16", "1:1": "square 1:1", "4:5": "portrait 4:5", any: "any shape" };
export const describeChange = (c) => c.field === "aspect" ? `the shape: from ${SHAPE[c.from]} to ${SHAPE[c.to]}` : c.field === "seconds" ? `the length: from ${c.from} to ${c.to} seconds (2 seconds shorter)` : c.field === "text" ? `the words: "${c.from}" becomes "${c.to}"` : c.to === "required" ? "the sound: add some calm music (it was silent)" : "the sound: drop it, make it silent";

// The item with the change applied, for the grader: spec values move, must-haves that name the old value are rewritten, and
// one line states the change. rec.item carries this copy once the follow-up message was sent.
export function applyChange(it, c) {
  const n = JSON.parse(JSON.stringify(it)), s = n.spec, after = "After the follow-up, ";
  if (c.field === "aspect") { s.aspect = c.to; n.must_haves = n.must_haves.map((m) => m.split(c.from).join(c.to)); n.must_haves.push(`${after}the final result is ${SHAPE[c.to]} (the user changed the shape from ${SHAPE[c.from]}); everything else is as before.`); }
  if (c.field === "seconds") { s.seconds = c.to; n.must_haves = n.must_haves.map((m) => m.replace(new RegExp(`\\b${c.from}[- ]second`, "g"), `${c.to}-second`).replace(new RegExp(`\\b${c.from} s\\b`, "g"), `${c.to} s`)); n.must_haves.push(`${after}the final result is about ${c.to} seconds long (the user asked for 2 seconds less); everything else is as before.`); }
  if (c.field === "text") { s.exact_text = s.exact_text.map((t) => (t === c.from ? c.to : t)); n.must_haves = n.must_haves.map((m) => m.split(c.from).join(c.to)); n.must_haves.push(`${after}the text reads exactly "${c.to}" where it read "${c.from}"; everything else is as before.`); }
  if (c.field === "audio") { s.audio = c.to; n.must_haves.push(c.to === "required" ? `${after}the final result has audible sound (the user asked for some music); everything else is as before.` : `${after}the final result is silent (the user asked for the sound to be dropped); everything else is as before.`); }
  n.changed_by = c; return n;
}
