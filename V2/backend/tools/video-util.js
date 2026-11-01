// Shared by the video code tools: the frame size for an aspect, a clip's length, whether a file is a clip or a sound.
import { execFileSync } from "node:child_process";
export const isClip = (f) => /\.(mp4|mov|webm)$/i.test(f), isPic = (f) => /\.(png|jpe?g|webp)$/i.test(f), isSound = (f) => /\.(mp3|wav|m4a|aac)$/i.test(f);
export const FRAME = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [720, 720], "4:5": [720, 900] };
export const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 26 });
export const num = (extra, k) => { const m = (extra || "").match(new RegExp(`${k}:\\s*(-?[\\d.]+)`, "i")); return m ? Number(m[1]) : null; };
export const word = (extra, k) => (extra || "").match(new RegExp(`${k}:\\s*([\\w:-]+)`, "i"))?.[1]?.toLowerCase() || null;
export const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100", "-ac", "2"];
export const hasAudio = (f) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f]).toString().includes("audio");
