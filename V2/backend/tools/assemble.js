// assemble: pictures and clips, in order, into one video; a sound (music or a voice) under it. By code, zero credits.
// The reel, the slideshow, the ad's cut, "add music to my clip", an audiogram (one picture over a voice). Pictures get a
// slow push-in; every piece is cropped to fill the aspect. Clip sound is kept; music goes under speech (about -12 dB) and
// at full level over silence, trimmed to the video and faded out. Sounds alone (a show intro: a voice and music) are
// mixed into one sound: the first at full level, the rest under it, to the length asked or of the first. params: seconds (total; 0 = clips at their length,
// pictures 2.5 s each, or the sound's length when there is one picture), aspect; extra "music: under|full",
// "fit: contain" (each whole picture on a blurred copy of itself; "fit: contain plain" on its edge colour; the default for a
// picture whose shape is far from the frame's, a phone screenshot in 16:9), "durations: 3, 3, 4" (seconds per piece).
// Transitions are cuts; a dissolve or other setting it cannot do is reported as ignored, never silently dropped.
import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { duration, size } from "../lib/media.js";
import { ff, FRAME, ENC, isClip, isPic, isSound, hasAudio, word } from "./video-util.js";

export const tool = {
  id: "assemble", group: "change-form", custom: true, credits: 0,
  takes: ["pictures and clips, in order", "optional sound (music or voice)"], makes: "clip", endpoint: "tools/assemble.js (ffmpeg)", kind: "none",
  needs: ["the pieces in order", "aspect", "seconds"], guarantees: ["the exact order", "the exact length and aspect", "the user's photos used as they are", "each whole picture kept (fit: contain, blurred or plain bands) when asked or when its shape is far from the frame's", "seconds per piece (durations, or \"0–1 s …\" timings)", "dissolves between pieces when asked", "sound: replace drops the clip's own sound; a voice-over goes on top, never faded", "pad colour (pad: navy)", "music under speech, not over it"],
  explain: "cuts the pictures and clips together in order, fills the frame, and lays the sound under it",
  ext: (ins = []) => (ins.length && ins.every((x) => isSound(x.file)) ? "mp3" : "mp4"),
  run({ inputs, params, out }) {
    const vis = inputs.filter((x) => isPic(x.file) || isClip(x.file)), snd = inputs.filter((x) => isSound(x.file));
    if (!vis.length && snd.length >= 2) {   // sounds alone: one mix, the voice on top (found by name, not order), the rest under it
      const isVoice = (x) => /voice|narrat|speech|\bvo\b|host|script|line|read/i.test(x.name || x.file), vi = Math.max(0, snd.findIndex(isVoice)), order = [snd[vi], ...snd.filter((_, k) => k !== vi)];
      const lead = Number(String(params.extra || "").match(/(?:voice|narration|speech)\s+(?:starts?|in|enters?)\s+(?:at|after)\s+(\d+(?:\.\d+)?)\s*s/i)?.[1] || String(params.extra || "").match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?\s+(?:of\s+)?music[- ]only/i)?.[1] || 0);
      const T = Number(params.seconds) || duration(order[0].file) + lead, n = order.length;
      ff(["-y", ...order.flatMap((x) => ["-i", x.file]), "-filter_complex", `${order.map((_, k) => `[${k}:a]${k === 0 && lead ? `adelay=${Math.round(lead * 1000)}:all=1,` : ""}volume=${k ? 0.22 : 1},apad[a${k}]`).join(";")};${order.map((_, k) => `[a${k}]`).join("")}amix=inputs=${n}:duration=longest:normalize=0,atrim=0:${T},afade=t=out:st=${Math.max(0, T - 1)}:d=1[m]`, "-map", "[m]", "-c:a", "libmp3lame", "-q:a", "3", out]);
      return { file: out, text: `${n} sounds mixed, ${Math.round(duration(out) * 10) / 10} s, ${order[0].name || "the first"} on top${lead ? ` from ${lead} s` : ""}` };
    }
    if (!vis.length) throw new Error("assemble needs at least one picture or clip");
    const near = (f) => { const [w, h] = size(f); const r = w / h; return Object.keys(FRAME).reduce((a, k) => (Math.abs(FRAME[k][0] / FRAME[k][1] - r) < Math.abs(FRAME[a][0] / FRAME[a][1] - r) ? k : a), "16:9"); };
    const asp = FRAME[params.aspect] ? params.aspect : near(vis[0].file); const [W, H] = FRAME[asp];   // no aspect asked: keep the first piece's shape
    const T = Number(params.seconds) || 0, sndLen = snd.length ? duration(snd[0].file) : 0;
    const lens = vis.map((v) => (isClip(v.file) ? duration(v.file) : null));
    const ex = `${params.extra || ""} ${params.prompt_or_change || ""}`, contain = /fit:\s*contain|without (cropping|crop)|no crop|whole (photo|picture)|blur(red)? (background|copy)|letterbox/i.test(ex), plain = /fit:\s*contain\s*plain|plain (background|bands?)/i.test(ex);
    let per = (ex.match(/durations?:\s*([\d.,\s]+)/i)?.[1] || "").split(/[,\s]+/).map(Number).filter((x) => x > 0);
    // timings in words: "0–1 s storefront, 1–2 s latte …" or "hold the title for 2 seconds"
    if (per.length !== vis.length) { const rg = [...ex.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*s/gi)].map((m) => Number(m[2]) - Number(m[1])).filter((x) => x > 0); if (rg.length === vis.length) per = rg; }
    const pad = ex.match(/pad:\s*([a-z]+|#?[0-9a-f]{6})|solid ([a-z]+) (?:background|bands?)|([a-z]+) (?:bands|bars|padding)/i), padColor = pad ? (pad[1] || pad[2] || pad[3]).replace(/^#/, "0x") : "black";
    const replace = /sound:\s*replace|replace (?:the )?(?:clip'?s? )?(?:original )?(?:audio|sound)|instead of the (?:original )?(?:audio|sound|conversation)|drop the (?:original )?(?:audio|sound)|narration only/i.test(ex);
    const dissolve = /dissolve|cross-?fade|fade between|soft transitions?/i.test(ex);
    const ignored = [/ken burns|pan across/i.test(ex) && "pans"].filter(Boolean);
    const far = (f) => { const [w, h] = size(f); const r = w / h, R = W / H; return Math.max(r / R, R / r) > 1.35; };
    let each = vis.map((v, k) => lens[k] ?? 2.5);
    // a total length: clips keep their own length (the user's 7 s clip was cut to 3.5 s) and the pictures share what is left
    if (T) { const clipSum = lens.reduce((a, b) => a + (b ?? 0), 0), pics = vis.filter((v) => !isClip(v.file)).length; if (pics && clipSum < T - 0.5 * pics) each = vis.map((v, k) => (lens[k] != null ? lens[k] : (T - clipSum) / pics)); else { const share = T / vis.length; each = vis.map((v, k) => (lens[k] != null ? Math.min(lens[k], share) : share)); const left = T - each.reduce((a, b) => a + b, 0); if (left > 0.05 && pics) each = each.map((d, k) => (lens[k] == null ? d + left / pics : d)); } }
    else if (vis.length === 1 && !lens[0] && sndLen) each = [sndLen];
    if (per.length === vis.length) each = per;
    const tmp = mkdtempSync(join(tmpdir(), "asm-")), parts = [];
    vis.forEach((v, k) => {
      const d = Math.max(0.5, each[k]), p = join(tmp, `p${k}.mp4`), fit = contain || far(v.file);
      // contain: the whole piece centred, over a blurred, darkened copy of itself (or its edge colour), nothing cropped
      const fill = fit ? (plain ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${padColor},setsar=1` : `split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.08[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`) : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
      if (isClip(v.file)) ff(["-i", v.file, ...(hasAudio(v.file) ? [] : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]), "-t", String(d), ...(fit && !plain ? ["-filter_complex", `[0:v]${fill},fps=30[v]`, "-map", "[v]", "-map", hasAudio(v.file) ? "0:a" : "1:a"] : ["-vf", `${fill},fps=30`]), ...(fit && !plain ? [] : hasAudio(v.file) ? [] : ["-map", "0:v", "-map", "1:a"]), "-shortest", ...ENC, p]);
      else if (fit) { ff(["-loop", "1", "-i", v.file, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", `[0]${fill},fps=30,format=yuv420p[v]`, "-map", "[v]", "-map", "1:a", "-t", String(d), ...ENC, p]); }
      else { const N = Math.round(d * 30); ff(["-i", v.file, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-vf", `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='1+0.08*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${N}:s=${W}x${H}:fps=30,setsar=1`, "-frames:v", String(N), "-t", String(d), "-map", "0:v", "-map", "1:a", ...ENC, p]); }
      parts.push(p);
    });
    const list = join(tmp, "list.txt"); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
    const cut = snd.length ? join(tmp, "cut.mp4") : out;
    if (dissolve && parts.length > 1) {   // 0.5 s dissolves between pieces (video xfade, sound acrossfade)
      const D = 0.5, lensP = parts.map((p) => duration(p)); let off = 0, vf = "", af = "", vl = "[0:v]", al = "[0:a]";
      for (let k = 1; k < parts.length; k++) { off += lensP[k - 1] - D; vf += `${vl}[${k}:v]xfade=transition=fade:duration=${D}:offset=${off.toFixed(2)}[v${k}];`; af += `${al}[${k}:a]acrossfade=d=${D}[a${k}];`; vl = `[v${k}]`; al = `[a${k}]`; }
      ff([...parts.flatMap((p) => ["-i", p]), "-filter_complex", (vf + af).replace(/;$/, ""), "-map", vl, "-map", al, ...ENC, cut]);
    } else ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", cut]);
    if (snd.length) {
      const L = duration(cut), speech = vis.some((v) => isClip(v.file) && hasAudio(v.file)), isVoice = /voice|narrat|speech|\bvo\b|script/i.test(snd[0].name || snd[0].file);
      // a voice-over goes on top at full level and is never faded; music goes under speech; "sound: replace" drops the clip's own sound
      const level = isVoice || replace || word(params.extra, "music") === "full" || !speech ? 1 : 0.25, under = isVoice && speech && !replace ? 0.3 : 1, fade = isVoice ? "" : `,afade=t=out:st=${Math.max(0, L - 1)}:d=1`;
      ff(["-i", cut, "-i", snd[0].file, "-filter_complex", replace ? `[1:a]atrim=0:${L},asetpts=PTS-STARTPTS,volume=${level},apad${fade}[a]` : `[0:a]volume=${under}[o];[1:a]atrim=0:${L},asetpts=PTS-STARTPTS,volume=${level},apad${fade}[m];[o][m]amix=inputs=2:duration=first:normalize=0[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-t", String(L), out]);
    }
    return { file: out, text: `${ignored.length ? `ignored: ${ignored.join(", ")} · ` : ""}${vis.length} piece(s), ${Math.round(duration(out) * 10) / 10} s, ${asp}${vis.some((v) => contain || far(v.file)) ? ", whole pictures (fit)" : ""}${snd.length ? ", with sound" : ""}` };
  },
};
