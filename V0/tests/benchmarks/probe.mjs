// Reads a video file with ffprobe and prints spec metrics for runs.csv.
// Usage: node current/tests/benchmarks/probe.mjs <video> [requested_seconds]
// Prints: header line, then value line (duration_s,width,height,aspect,fps,has_audio,size_mb,duration_err_pct)
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const [file, requested] = process.argv.slice(2);
if (!file) { console.error("usage: probe.mjs <video> [requested_seconds]"); process.exit(1); }

const info = JSON.parse(execFileSync("ffprobe", [
  "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file,
]).toString());

const video = info.streams.find(s => s.codec_type === "video");
const hasAudio = info.streams.some(s => s.codec_type === "audio");
const duration = Number(info.format.duration);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const [num, den] = (video?.avg_frame_rate ?? "0/1").split("/").map(Number);
const g = video ? gcd(video.width, video.height) : 1;

const row = {
  duration_s: duration.toFixed(2),
  width: video?.width ?? "",
  height: video?.height ?? "",
  aspect: video ? `${video.width / g}:${video.height / g}` : "",
  fps: den ? (num / den).toFixed(2) : "",
  has_audio: hasAudio ? "y" : "n",
  size_mb: (statSync(file).size / 1e6).toFixed(1),
  duration_err_pct: requested ? (Math.abs(duration - Number(requested)) / Number(requested) * 100).toFixed(1) : "",
};
console.log(Object.keys(row).join(","));
console.log(Object.values(row).join(","));
