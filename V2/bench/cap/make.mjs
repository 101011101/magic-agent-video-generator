// The tool-capability set: how good a frame can the Magic Hour MCP make from real references, on the free tier?
// Real photos (public-domain portraits of historical figures from Wikimedia Commons, stock people from Unsplash and
// Pexels, real places from Commons) live in bench/v1/fixtures as cap-*.jpg; sources.json says where each came from.
// Every prompt combines a face (named, or a photo), a place (named, or a photo) and an action, so the MCP has to choose:
// which tool (generate, edit, face swap, head swap, colorize, headshot), which free model (input caps differ: qwen 2,
// klein 5, krea 1), and how to chain. We record what it does and dissect it afterwards.
// Usage: node V2/bench/cap/make.mjs   → writes items/K*.json and index.html (the preview page)
//        node V2/bench/mcp/run.mjs --items V2/bench/cap/items --out V2/bench/v1/results/cap-1 --prefix cap1
import { writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ITEMS = join(HERE, "items");
mkdirSync(ITEMS, { recursive: true }); for (const f of readdirSync(ITEMS)) if (f.endsWith(".json")) rmSync(join(ITEMS, f));

const FIX = {   // the references, as the preview page captions them
  "cap-lincoln.jpg": "Abraham Lincoln, 1863 (Gardner)", "cap-vanderbilt.jpg": "Cornelius Vanderbilt, daguerreotype", "cap-vanderbilt-old.jpg": "Cornelius Vanderbilt, older (Howell & Meyer)",
  "cap-roosevelt.jpg": "Theodore Roosevelt, 1904 (Pach Bros)", "cap-curie.jpg": "Marie Curie, c. 1920", "cap-douglass.jpg": "Frederick Douglass, c. 1879", "cap-twain.jpg": "Mark Twain, 1907 (Bradley)",
  "cap-man-1.jpg": "stock: man, grey sweater", "cap-man-2.jpg": "stock: man, white tee, smiling", "cap-man-3.jpg": "stock: older man, glasses", "cap-man-4.jpg": "stock: man, dark sweater",
  "cap-man-5.jpg": "stock: man, blue tee, arms crossed", "cap-man-6.jpg": "stock: man, glasses, white tee", "cap-woman-1.jpg": "stock: woman, red top, laughing", "cap-woman-2.jpg": "stock: woman, red hair, lake",
  "cap-woman-3.jpg": "stock: woman, striped shirt", "cap-woman-4.jpg": "stock: woman, hoodie, blue wall", "cap-woman-5.jpg": "stock: woman, patterned shirt", "cap-woman-6.jpg": "stock: woman, glasses, street",
  "cap-group.jpg": "stock: office team of nine", "cap-elder.jpg": "stock: older man in a workshop",
  "cap-banff-moraine.jpg": "Moraine Lake, Banff", "cap-banff-louise.jpg": "Lake Louise, Banff", "cap-times-square.jpg": "Times Square at night", "cap-eiffel.jpg": "Eiffel Tower", "cap-grand-canyon.jpg": "Grand Canyon, Pima Point",
  "cap-golden-gate.jpg": "Golden Gate Bridge", "cap-santorini.jpg": "Oia, Santorini", "cap-tokyo.jpg": "Tokyo Tower and skyline", "cap-machu-picchu.jpg": "Machu Picchu",
};

// id, title, materials, prompt, what it tests, the answer sheet (what the proxy user says if asked), must-haves, spec
const K = [
  // K01 · a named face: from memory, from one photo, from two photos
  ["K01a", "Lincoln from memory", [], "Make a photorealistic colour photo of Abraham Lincoln standing on the shore of Moraine Lake in Banff National Park, looking out at the mountains. Daylight, 16:9.",
    "Text only: does a free model know Lincoln's face and Moraine Lake without a reference?",
    { "Who and where": "Abraham Lincoln at Moraine Lake, Banff.", "Clothes and era": "your call", "Style": "Photorealistic colour photo." },
    ["The man is recognisably Abraham Lincoln (the beard without a moustache, the gaunt face, the dark hair).", "The lake is a turquoise mountain lake with a wall of jagged peaks behind it, like Moraine Lake.", "He stands on the shore looking at the mountains.", "The picture is a photorealistic colour photo, 16:9."], "16:9"],
  ["K01b", "Lincoln from a photo, on this shore", ["cap-lincoln.jpg", "cap-banff-moraine.jpg"], "Here is a photo of Abraham Lincoln and a photo of Moraine Lake. Put him on this exact shoreline in his black suit, crouching to skip a stone across the water. Colour photo, 16:9.",
    "Two references, a face and a place: is the face his and is the shore the photographed one?",
    { "Who and where": "Lincoln from the first photo, the shore from the second.", "Pose": "Crouching, skipping a stone.", "Style": "Colour photo, 16:9." },
    ["The man's face matches the attached Lincoln portrait, not a generic bearded man.", "The lake and the peaks behind it match the attached Moraine Lake photo (the same ridge line and the same turquoise water).", "He crouches at the water's edge in the act of skipping a stone.", "The picture is in colour, 16:9."], "16:9"],
  ["K01c", "Vanderbilt from two photos, at the bridge", ["cap-vanderbilt.jpg", "cap-vanderbilt-old.jpg", "cap-golden-gate.jpg"], "The first two photos are Cornelius Vanderbilt at different ages. Make a colour photo of him, as in the first photo, standing at the railing of the Golden Gate Bridge in the third photo, pointing out at the bay, top hat and overcoat. 16:9.",
    "Three inputs (two of one face, one place): more than qwen's two inputs; does it pick klein, drop one, or chain?",
    { "Who and where": "Vanderbilt, as in the first photo, at the Golden Gate Bridge from the third.", "Clothes": "Top hat and overcoat.", "Pose": "At the railing, pointing out at the bay." },
    ["The man matches the Vanderbilt in the first photo (the long face, the swept-back hair, the clean-shaven chin with side whiskers).", "He is on the Golden Gate Bridge, its red towers and cables visible as in the attached photo.", "He wears a top hat and overcoat and points at the bay.", "The picture is in colour, 16:9."], "16:9"],

  // K02 · a stock person: in a named place, in a photographed place, two together, a whole team
  ["K02a", "Her at the Eiffel Tower, from text", ["cap-woman-1.jpg"], "Put her at the foot of the Eiffel Tower, holding a croissant, early morning light. Keep her face exactly as it is. Portrait, 9:16.",
    "One face reference, the place from the model's own knowledge: likeness and a landmark it must know.",
    { "Who": "The woman in the photo.", "Where": "At the foot of the Eiffel Tower.", "Doing": "Holding a croissant.", "Format": "9:16 portrait." },
    ["The woman's face matches the attached photo (the dark wavy hair, the wide smile, the red lips).", "The Eiffel Tower is clearly visible and correctly shaped.", "She holds a croissant.", "The light is early morning; the picture is 9:16."], "9:16"],
  ["K02b", "Him on this Santorini rooftop", ["cap-man-5.jpg", "cap-santorini.jpg"], "Put this man on this exact rooftop in Santorini, leaning on the white wall and taking a selfie with his phone. Keep his face and his blue T-shirt. Square.",
    "Face and place both from photos; a precise spot in the place photo; clothes kept.",
    { "Who": "The man in the first photo, same blue T-shirt.", "Where": "The rooftop in the second photo.", "Doing": "Leaning on the white wall, taking a selfie.", "Format": "1:1." },
    ["The man's face matches the attached photo (the dark beard, the short dark hair, the smile).", "He wears the same blue T-shirt.", "The setting matches the attached Santorini photo: white walls, blue domes, the windmill or the sea behind.", "He holds a phone as if taking a selfie; the picture is square."], "1:1"],
  ["K02c", "Two people, Times Square, one umbrella", ["cap-woman-3.jpg", "cap-man-4.jpg", "cap-times-square.jpg"], "These two are a couple. Show them together in Times Square at night, exactly the view in the third photo, sharing one umbrella and laughing. Keep both faces. 16:9.",
    "Two identities plus a place: does each face survive, and are both people present?",
    { "Who": "The woman in the first photo and the man in the second.", "Where": "Times Square as in the third photo.", "Doing": "Sharing one umbrella, laughing.", "Format": "16:9." },
    ["Both people are present: a woman with long light-brown hair matching the first photo and a man with a short beard matching the second.", "They share one umbrella and are laughing.", "The background is Times Square at night with its lit billboards, as in the attached photo.", "The picture is 16:9."], "16:9"],
  ["K02d", "The whole team at Machu Picchu", ["cap-group.jpg", "cap-machu-picchu.jpg"], "This is our team. Make a group photo of all of them at Machu Picchu, the view in the second photo behind them, in hiking clothes, as if on a company trip. Same people, same number of people. 16:9.",
    "Nine faces at once: how many identities can one edit carry?",
    { "Who": "Everyone in the first photo, nine people.", "Where": "Machu Picchu as in the second photo.", "Clothes": "Hiking clothes.", "Format": "16:9." },
    ["There are nine people in the picture.", "The people resemble those in the attached team photo (the same mix of men and women, hair and skin tones).", "The ruins and the peak of Machu Picchu are behind them, as in the attached photo.", "They wear hiking clothes; the picture is 16:9."], "16:9"],

  // K03 · the swap tools and the restoration tools
  ["K03a", "A friend's face on Mark Twain", ["cap-man-2.jpg", "cap-twain.jpg"], "Swap my friend's face (first photo) onto the Mark Twain portrait (second photo). Keep everything else about the portrait: the white hair, the suit, the pose, the black and white.",
    "A plain face swap: does it reach for swap_face_in_photo or prompt an edit model, and which keeps the portrait?",
    { "Whose face": "The man in the first photo.", "Onto": "The Twain portrait, second photo.", "Keep": "Everything but the face." },
    ["The face is the friend's from the first photo (the broad smile, the dark eyebrows), not Twain's.", "The white swept-back hair, moustache or not, the light suit and the pose are the portrait's.", "The picture stays black and white.", "The framing matches the original portrait."], "any"],
  ["K03b", "Roosevelt's head on his body", ["cap-roosevelt.jpg", "cap-man-5.jpg"], "Put Theodore Roosevelt's head (first photo) on this man's body (second photo): same blue T-shirt, same crossed arms, same wall, same colour photo. Just the head changes.",
    "A head swap (hair and all), old black-and-white head onto a colour body: swap_head_in_photo or an edit?",
    { "Whose head": "Roosevelt, first photo.", "Onto": "The man in the second photo.", "Keep": "The T-shirt, the arms, the wall, the colour." },
    ["The head is Roosevelt's: the pince-nez glasses, the thick moustache, the side-parted hair.", "The body, blue T-shirt, crossed arms and the brick wall are the second photo's.", "The head is in colour and lit like the rest of the photo, not pasted in grey.", "The framing matches the second photo."], "any"],
  ["K03c", "Marie Curie in colour, in a Tokyo café", ["cap-curie.jpg", "cap-tokyo.jpg"], "Colourise this photo of Marie Curie, then show her in that same outfit sitting at a café window with a cup of tea, the Tokyo Tower from the second photo visible through the window behind her.",
    "A chain: colorize, then compose with a place reference; does it chain two tools or do both in one edit?",
    { "Who": "Marie Curie from the first photo, in colour, same outfit.", "Where": "A café window with the Tokyo Tower behind.", "Doing": "Sitting with a cup of tea." },
    ["The woman's face matches the attached Curie photo (the drawn face, the hair pulled back).", "She wears the same dark outfit with the patterned collar, now in colour.", "The red-and-white Tokyo Tower is visible through the window behind her.", "She sits at a café table with a cup of tea; the picture is in colour."], "any"],
  ["K03d", "Douglass at the Grand Canyon", ["cap-douglass.jpg", "cap-grand-canyon.jpg"], "Frederick Douglass standing at the rim of the Grand Canyon in the second photo, hat in hand, wind in his hair, in his 1870s suit, golden hour. Colour photo, 16:9.",
    "A single reference portrait with full body and a wide landscape: does the wide shot keep the face?",
    { "Who": "Douglass from the first photo.", "Where": "The Grand Canyon from the second photo.", "Doing": "Standing at the rim, hat in hand.", "Format": "16:9, colour." },
    ["The man matches the attached Douglass portrait (the white swept-back hair, the full white beard, the stern face).", "He stands at the rim of the Grand Canyon as in the attached photo, the layered red walls behind.", "He holds a hat and wears a dark 1870s suit.", "Golden-hour light, colour, 16:9."], "16:9"],

  // K04 · an identity under change: clothes and expression, a headshot, a cut-out moved
  ["K04a", "Lincoln's Times Square selfie", ["cap-lincoln.jpg", "cap-times-square.jpg"], "Abraham Lincoln in a modern grey hoodie and jeans taking a selfie in Times Square at night, the spot in the second photo, phone held up, grinning. Colour, 9:16.",
    "Identity under a clothing change and an expression change (he never smiled in photographs).",
    { "Who": "Lincoln from the first photo.", "Where": "Times Square, second photo.", "Clothes and mood": "Grey hoodie, jeans, grinning, selfie.", "Format": "9:16, colour." },
    ["The man is recognisably the attached Lincoln: the beard without a moustache, the deep-set eyes, the gaunt face.", "He wears a grey hoodie and jeans and holds a phone up as for a selfie.", "He is grinning.", "Times Square at night from the attached photo is behind him; the picture is 9:16."], "9:16"],
  ["K04b", "Her LinkedIn headshot", ["cap-woman-4.jpg"], "Turn this into a professional LinkedIn headshot: plain grey studio background, a dark blazer, soft studio light, head and shoulders. Keep her face and her glasses exactly.",
    "The headshot tool (50 credits) against an edit (10): which does it pick, and which keeps the face?",
    { "Who": "The woman in the photo, glasses kept.", "Look": "Grey studio background, dark blazer, head and shoulders." },
    ["The face matches the attached photo (the glasses, the light-brown hair, the slight smile).", "The background is a plain grey studio background; the hoodie is gone.", "She wears a dark blazer.", "The framing is head and shoulders, lit softly."], "any"],
  ["K04c", "The workshop man crossing a Tokyo street", ["cap-elder.jpg", "cap-tokyo.jpg"], "Take this man out of his workshop and show him crossing a busy Tokyo street carrying a red toolbox, the Tokyo Tower from the second photo behind him. Same face, same white shirt. 16:9.",
    "A cut-out moved into a new scene: remove_image_background and compose, or one edit?",
    { "Who": "The man in the first photo, same white shirt.", "Where": "A Tokyo street with the Tokyo Tower behind.", "Doing": "Crossing the street with a red toolbox.", "Format": "16:9." },
    ["The man's face matches the attached photo (the grey hair, the lined face, the stubble).", "He wears the white shirt and carries a red toolbox.", "He is on a city street with the Tokyo Tower visible behind.", "The picture is 16:9."], "16:9"],
  ["K04d", "Same pose, a different lake", ["cap-woman-2.jpg", "cap-banff-moraine.jpg"], "She is already at a lake. Keep her exactly as she is, same pose, same framing, same light on her face, and replace only the background with Moraine Lake from the second photo.",
    "Background replacement only: is the subject left untouched, pixel for pixel?",
    { "Who": "The woman in the first photo, unchanged.", "Change": "Only the background, to Moraine Lake from the second photo." },
    ["The woman is unchanged from the attached photo: same red bob, same dark top, same pose, same framing.", "The background is Moraine Lake with its wall of peaks, as in the attached photo.", "The edge between her and the new background is clean, no halo.", "The light on her face is as in the original."], "any"],

  // K05 · more faces, and the place itself
  ["K05a", "Vanderbilt canoeing on Lake Louise", ["cap-vanderbilt.jpg", "cap-banff-louise.jpg"], "Cornelius Vanderbilt (first photo) paddling one of the red canoes on Lake Louise, the second photo, the chateau on the far shore behind him, in his top hat and black coat. Colour, 16:9.",
    "A full-body action from a head-and-shoulders portrait, in a photographed place.",
    { "Who": "Vanderbilt from the first photo, top hat and black coat.", "Where": "Lake Louise from the second photo.", "Doing": "Paddling a red canoe.", "Format": "16:9, colour." },
    ["The man matches the attached Vanderbilt photo (the long face, the swept-back hair, side whiskers).", "He paddles a red canoe on the lake.", "The lake and the chateau on the far shore match the attached Lake Louise photo.", "Top hat and black coat; colour; 16:9."], "16:9"],
  ["K05b", "Three at a diner", ["cap-lincoln.jpg", "cap-roosevelt.jpg", "cap-twain.jpg"], "Lincoln, Roosevelt and Twain, from the three photos, playing cards together in a 1950s diner booth, coffee cups on the table, colour photo, 16:9.",
    "Three identities in one frame, each from its own photo.",
    { "Who": "Lincoln, Roosevelt and Twain, from the three photos.", "Where": "A 1950s diner booth.", "Doing": "Playing cards, coffee on the table.", "Format": "16:9, colour." },
    ["Three men are present and each is recognisable: Lincoln (beard, no moustache), Roosevelt (pince-nez, thick moustache), Twain (white hair and moustache).", "They sit in a diner booth playing cards.", "Coffee cups are on the table; the setting reads as a 1950s diner.", "Colour; 16:9."], "16:9"],
  ["K05c", "Lake Louise from memory", [], "A photo of Lake Louise in Banff National Park: the Fairmont Chateau on the far shore, a red canoe on the water, morning light. 16:9.",
    "Text only: does the free model know the place well enough to match the real photo?",
    { "Where": "Lake Louise, Banff, with the Fairmont Chateau and a red canoe.", "Style": "Photo, morning light, 16:9." },
    ["A turquoise glacial lake with mountains and a glacier at the far end.", "A large chateau-style hotel stands on one shore.", "A red canoe is on the water.", "Morning light; 16:9."], "16:9"],
  ["K05d", "Her, him, and the bridge, in one", ["cap-woman-6.jpg", "cap-man-6.jpg", "cap-golden-gate.jpg"], "These two (first two photos) cycling side by side across the Golden Gate Bridge from the third photo, both in helmets, fog behind. Keep both faces and both pairs of glasses. 16:9.",
    "Two faces with glasses plus a place: fine detail (glasses) under an action pose.",
    { "Who": "The woman in the first photo and the man in the second, glasses kept.", "Where": "The Golden Gate Bridge from the third photo.", "Doing": "Cycling side by side, helmets on.", "Format": "16:9." },
    ["Both people are present and match the attached photos: a woman with long dark hair and round glasses, a man with glasses and a short beard.", "Both wear glasses and helmets and ride bicycles side by side.", "The red towers and cables of the Golden Gate Bridge are behind them.", "The picture is 16:9."], "16:9"],
];

const items = K.map(([id, title, materials, text, tests, answer_sheet, must_haves, aspect], i) => ({
  id, case: 100 + Number(id.slice(2, 3)), case_name: ["", "A named face: text, one photo, two photos", "A stock person in a place", "Swaps and restoration", "An identity under change", "More faces, and the place itself"][Number(id.slice(2, 3))],
  group: "K", group_name: "Tool capability: frames from real references", expect: { asks: "never", asks_about: "", beyond_free: "no", refuse: false },
  title, sub: id.slice(3), spec: { exact_text: [], aspect, kind: "image", seconds: null, outputs: 1, audio: "none" },
  turns: [{ materials, text }], tests, answer_sheet, must_haves, added: "2026-11-02: the tool-capability set (real faces and places, free tier, the MCP decides the tool)",
}));
for (const it of items) writeFileSync(join(ITEMS, `${it.id}.json`), JSON.stringify(it, null, 2) + "\n");

// the preview page: every reference, then every prompt with its references
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const img = (f, h = 160) => `<figure><img src="../v1/fixtures/${f}" style="height:${h}px" loading="lazy"><figcaption>${esc(f)}<br><span>${esc(FIX[f] || "")}</span></figcaption></figure>`;
const used = new Set(items.flatMap((it) => it.turns[0].materials));
const section = (name, pred) => `<h2>${name}</h2><div class="row">${Object.keys(FIX).filter(pred).map((f) => img(f)).join("")}</div>`;
const cards = items.map((it) => `<article><div class="hd"><b>${it.id}</b> ${esc(it.title)}<span class="meta">${esc(it.spec.aspect)} · ${it.turns[0].materials.length} reference${it.turns[0].materials.length === 1 ? "" : "s"}</span></div>
  <div class="refs">${it.turns[0].materials.map((f) => img(f, 110)).join("") || "<i>no reference: text only</i>"}</div>
  <p class="prompt">${esc(it.turns[0].text)}</p><p class="tests">${esc(it.tests)}</p>
  <details><summary>must-haves and answer sheet</summary><ul>${it.must_haves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul><dl>${Object.entries(it.answer_sheet).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></details></article>`).join("\n");
const html = `<!doctype html><meta charset="utf-8"><title>Tool capability set</title>
<style>body{font:15px/1.45 system-ui,sans-serif;max-width:1180px;margin:24px auto;padding:0 16px;color:#1a1a1a}h1{font-size:22px}h2{font-size:17px;margin:28px 0 8px}.row{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;font-size:12px;color:#444}figure img{display:block;border-radius:4px;background:#eee}figcaption span{color:#888}
article{border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin:14px 0}.hd{font-size:16px;margin-bottom:8px}.meta{float:right;color:#888;font-size:13px}.refs{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}.prompt{background:#f6f6f6;border-left:3px solid #999;padding:8px 10px;margin:8px 0}.tests{color:#555;margin:4px 0}details{font-size:13px;color:#444}dt{font-weight:600;margin-top:4px}dd{margin:0 0 0 12px}
.note{color:#555;font-size:14px}</style>
<h1>Tool capability set · ${items.length} prompts, ${used.size} of ${Object.keys(FIX).length} references used</h1>
<p class="note">Free tier only. Each prompt goes word for word to the Magic Hour MCP with a chat model and nothing else; the MCP chooses the tool, the model and the chain. Historical portraits are public domain (Wikimedia Commons); stock people are Unsplash and Pexels (free licences; real models, so the prompts keep them in ordinary situations); places are Commons. Sources in <code>sources.json</code>.</p>
${section("Historical figures", (f) => /lincoln|vanderbilt|roosevelt|curie|douglass|twain/.test(f))}
${section("Stock people", (f) => /man-|woman-|group|elder/.test(f))}
${section("Places", (f) => /banff|times|eiffel|canyon|golden|santorini|tokyo|machu/.test(f))}
<h2>The prompts</h2>
${cards}`;
writeFileSync(join(HERE, "index.html"), html);
console.log(`${items.length} items → ${ITEMS}; preview ${join(HERE, "index.html")}; unused references: ${Object.keys(FIX).filter((f) => !used.has(f)).join(", ") || "none"}`);
