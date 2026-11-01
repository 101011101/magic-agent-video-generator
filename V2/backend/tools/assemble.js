// assemble: pictures and clips, in order, into one video; a sound (music or a voice) under it. By code, zero credits.
// The reel, the slideshow, the ad's cut, "add music to my clip", an audiogram (one picture over a voice). Pictures get a
// slow push-in; every piece is cropped to fill the aspect. Clip sound is kept; music goes under speech (about -12 dB) and
// at full level over silence, trimmed to the video and faded out. params: seconds (total; 0 = clips at their length,
// pictures 2.5 s each, or the sound's length when there is one picture), aspect; extra "music: under|full".
import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { duration } from "../lib/media.js";
import { ff, FRAME, ENC, isClip, isPic, isSound, hasAudio, word } from "./video-util.js";

export const tool = {
  id: "assemble", group: "change-form", custom: true, credits: 0,
  takes: ["pictures and clips, in order", "optional sound (music or voice)"], makes: "clip", endpoint: "tools/assemble.js (ffmpeg)", kind: "none",
  needs: ["the pieces in order", "aspect", "seconds"], guarantees: ["the exact order", "the exact length and aspect", "the user's photos used as they are", "music under speech, not over it"],
  explain: "cuts the pictures and clips together in order, fills the frame, and lays the sound under it",
  ext: () => "mp4",
  run({ inputs, params, out }) {
    const vis = inputs.filter((x) => isPic(x.file) || isClip(x.file)), snd = inputs.filter((x) => isSound(x.file));
    if (!vis.length) throw new Error("assemble needs at least one picture or clip");
    const asp = FRAME[params.aspect] ? params.aspect : "9:16"; const [W, H] = FRAME[asp];
    const T = Number(params.seconds) || 0, sndLen = snd.length ? duration(snd[0].file) : 0;
    const lens = vis.map((v) => (isClip(v.file) ? duration(v.file) : null));
    let each = vis.map((v, k) => lens[k] ?? 2.5);
    if (T) { const share = T / vis.length; each = vis.map((v, k) => (lens[k] != null ? Math.min(lens[k], share) : share)); const left = T - each.reduce((a, b) => a + b, 0), pics = vis.filter((v) => !isClip(v.file)).length; if (left > 0.05 && pics) each = each.map((d, k) => (lens[k] == null ? d + left / pics : d)); }
    else if (vis.length === 1 && !lens[0] && sndLen) each = [sndLen];
    const tmp = mkdtempSync(join(tmpdir(), "asm-")), parts = [];
    vis.forEach((v, k) => {
      const d = Math.max(0.5, each[k]), p = join(tmp, `p${k}.mp4`), fill = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
      if (isClip(v.file)) ff(["-i", v.file, ...(hasAudio(v.file) ? [] : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]), "-t", String(d), "-vf", `${fill},fps=30`, ...(hasAudio(v.file) ? [] : ["-map", "0:v", "-map", "1:a"]), "-shortest", ...ENC, p]);
      else { const N = Math.round(d * 30); ff(["-i", v.file, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-vf", `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='1+0.08*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${N}:s=${W}x${H}:fps=30,setsar=1`, "-frames:v", String(N), "-t", String(d), "-map", "0:v", "-map", "1:a", ...ENC, p]); }
      parts.push(p);
    });
    const list = join(tmp, "list.txt"); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
    const cut = snd.length ? join(tmp, "cut.mp4") : out; ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", cut]);
    if (snd.length) {
      const L = duration(cut), speech = vis.some((v) => isClip(v.file) && hasAudio(v.file)), level = word(params.extra, "music") === "full" || !speech ? 1 : 0.25;
      ff(["-i", cut, "-i", snd[0].file, "-filter_complex", `[1:a]atrim=0:${L},asetpts=PTS-STARTPTS,volume=${level},afade=t=out:st=${Math.max(0, L - 1)}:d=1[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-t", String(L), out]);
    }
    return { file: out, text: `${vis.length} piece(s), ${Math.round(duration(out) * 10) / 10} s, ${asp}${snd.length ? ", with sound" : ""}` };
  },
};
