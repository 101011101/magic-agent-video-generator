// SP Screenplay (adaptation): the story as scenes of visual action lines and dialogue, like a film script.
// A scene is continuous in place and time; a new place or a cut starts a new one. Action lines are present tense and only what
// the camera can see and hear, with direction of movement (toward / away from us, left / right). Simultaneous actions become
// separate beats. Readable prose for the user; the storyboard (next stage) turns each scene into panels (keyframes).
import { jsonCall, S } from "./llm.js";

const SCENE = S.obj({
  place: S.str,                  // where, in the story's own words ("Grandmother's cottage")
  inside: S.bool,                // INT. or EXT.
  time: S.str,                   // DAY, NIGHT, LATER, CONTINUOUS
  cut: S.bool,                   // true when time jumps or the view changes without following anyone (a cut)
  beats: S.arr(S.obj({ kind: S.enum(["action", "dialogue"]), who: S.str, text: S.str })),
  story_lines: S.arr(S.str),     // the story sentences this scene covers, quoted exactly
});

export async function writeScreenplay(story, names = []) {
  return jsonCall({ name: "screenplay", effort: "high", schema: S.obj({ title: S.str, scenes: S.arr(SCENE) }),
    prompt: `Adapt this story into a SCREENPLAY for an animated film, the way a screenwriter adapts a book.
- Scenes: a scene is continuous in place and time. Start a new scene for a new place, or a cut (time passes, or we jump to
  another view). place: where, in the story's words; inside: interior or exterior; time: DAY, NIGHT, LATER or CONTINUOUS;
  cut: true when the scene starts after a jump in time or view rather than by following someone.
- Action lines: present tense, only what the camera can SEE and HEAR. Write what it looks like, not what it means: "The wolf's
  belly splits. Light pours in. Red, curled inside, squints, then crawls out onto the quilt, gasping." Give direction of
  movement relative to the viewer: toward us, away from us, left, right ("The wolf races away from us around the far bend").
  One beat per action line; things that happen one after another are separate beats; keep beats short and concrete.
- Show where things come from on screen when it matters (someone carries the stones in), or start a new scene after a cut.
- Dialogue: keep the story's lines, spoken by who says them.
- Cover every event of the story in order; add nothing that changes the plot.
- story_lines: the story sentences each scene covers, quoted exactly.
${names.length ? `Names to use: ${names.join(", ")}.\n` : ""}
Story:\n${story}` });
}

// The screenplay as text, in script format (for reading).
export function screenplayText(sp) {
  return sp.scenes.map((s, i) => [`${i + 1}. ${s.inside ? "INT." : "EXT."} ${s.place.toUpperCase()} — ${s.time.toUpperCase()}${s.cut ? "   (CUT)" : ""}`, "",
    ...s.beats.map((b) => (b.kind === "dialogue" ? `                    ${b.who.toUpperCase()}\n          ${b.text}` : b.text)), ""].join("\n")).join("\n");
}

// Sound pass over an approved screenplay: the text is not rewritten. One call returns, per scene, its background sound
// (ambience) and an optional music cue, and per beat (by number) a sound effect when the beat makes a noise. Code merges them
// in by position, so the approved lines stay word for word. Dialogue beats are voices; they get no effect.
export async function addSound(sp) {
  const listing = sp.scenes.map((s, i) => `Scene ${i + 1}: ${s.inside ? "INT." : "EXT."} ${s.place} — ${s.time}\n${s.beats.map((b, j) => `  ${j + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n")}`).join("\n\n");
  const r = await jsonCall({ name: "screenplay-sound", effort: "medium",
    schema: S.obj({ scenes: S.arr(S.obj({ scene: S.int, ambience: S.str, music: S.str, effects: S.arr(S.obj({ beat: S.int, sfx: S.str })) })) }),
    prompt: `Add SOUND notes to this screenplay for an animated storybook film. Do not change any line.
For every scene: ambience = the background sound that runs under the whole scene (birdsong and wind in the trees; a crackling hearth
and a ticking clock), short; music = a one-line music cue (mood, instruments) or "" if the scene should have none.
For action beats that make a noise: effects = [{beat number, sfx}] with a short concrete sound ("three knocks on a wooden door",
"snip of shears", "heavy thud on the floorboards"). Skip silent beats and all dialogue beats (those are voices).

${listing}` });
  return { ...sp, scenes: sp.scenes.map((s, i) => {
    const x = r.scenes.find((y) => y.scene === i + 1) || { ambience: "", music: "", effects: [] };
    return { ...s, ambience: x.ambience, music: x.music, beats: s.beats.map((b, j) => ({ ...b, sfx: b.kind === "action" ? x.effects.find((e) => e.beat === j + 1)?.sfx || "" : "" })) };
  }) };
}
