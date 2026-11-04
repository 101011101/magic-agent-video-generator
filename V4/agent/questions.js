// The universal question bank: parameter → a plain, non-technical question; and parsing of plain answers into values.
export const QUESTIONS = {
  aspect: "Where will this be shown or posted (Instagram, TikTok, YouTube, a website, print, somewhere else)?",
  seconds: "How long should it be?",
  exact_words: "Should any words appear on it? If so, which, exactly?",
  sound: "Should it have sound: music, a voice, or silent?",
  language: "Which language for the voice or captions?",
  which_one: "Which one do you mean?",
  which_face: "Whose face goes where (which person in the picture)?",
  reference_role: "Which of the attached pictures matters most: the person, the logo or label, the product, or the place?",
  look: "Any look in mind (realistic, illustrated, a brand colour, a mood)? 'Your call' is fine.",
  subject: "What should it show?",
  edit: "What should change in the picture?",
  keep: "What must stay exactly as it is?",
  motion: "What should move, and how (small natural motion, a slow push in, something happening)?",
  mood: "What mood or genre for the music?",
  script: "What should be said, word for word? Or should I write it from the gist?",
  story: "What happens, in order? Who is in it and where?",
  continuation: "What should happen next? (Or should I continue what the clip is doing?)",
  adjustment: "What should change about the look (warmer, cooler, brighter, darker, more contrast, black and white)?",
  targets: "Which sizes do you need (a square post, a tall story, a wide banner)?",
  order: "In what order should the clips go?",
  music: "Music under it? What mood?",
  range: "Which part should be kept (from when to when, or 'the best 10 seconds')?",
  position: "Where should the words sit (top, bottom, a corner)?",
  transition: "A hard cut or a dissolve between them?",
  voice: "What kind of voice (calm, upbeat, male, female, any accent)?",
};
const PLATFORM = [[/tiktok|reels?\b|stories|story\b|\bshorts\b|vertical|portrait|phone/i, "9:16"], [/youtube|landscape|widescreen|tv\b|wide\b|banner|presentation|desktop/i, "16:9"], [/instagram post|square|feed|profile pic/i, "1:1"], [/instagram/i, "1:1"], [/linkedin|facebook|twitter|\bx\b/i, "16:9"], [/print|poster|flyer|a4|letter/i, "9:16"]];
export function parseAspect(s = "") { const m = s.match(/\b(16:9|9:16|1:1|4:3|3:4|4:5)\b/); if (m) return m[1] === "4:5" || m[1] === "3:4" ? "9:16" : m[1] === "4:3" ? "16:9" : m[1]; for (const [re, v] of PLATFORM) if (re.test(s)) return v; return null; }
export function parseSeconds(s = "") { const m = s.match(/(\d+(?:\.\d+)?)\s*(s\b|sec|seconds?)/i) || s.match(/\b(\d{1,3})\b/); if (m) return Math.max(1, Math.round(Number(m[1]))); if (/half a minute/i.test(s)) return 30; if (/minute/i.test(s)) return 60; if (/short|quick|brief/i.test(s)) return 8; if (/reel|tiktok|story/i.test(s)) return 15; return null; }
export function parseSound(s = "") { if (/silent|no sound|mute|none|quiet/i.test(s)) return "none"; if (/dialog/i.test(s)) return "dialogue"; if (/voice|narrat|speak|talk|say/i.test(s)) return "narration"; if (/music|song|beat|track/i.test(s)) return "music"; if (/ambient|natural sound|sfx/i.test(s)) return "ambient"; return null; }
export const YOUR_CALL = /your call|you decide|whatever|up to you|don'?t care|anything|surprise me|dealer'?s choice/i;
