// Exact on-screen text: render each layer to a transparent 1280×720 PNG with headless Chrome (no image model, no misspelling).
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Visual line breaks only (the characters stay exact): break after a dash separator, so "Name — details" sits on two lines.
const lines = (t) => esc(t).split(/(?<= [—–-]) /).join("<br>");
const PLACE = { center: "align-items:center", "lower third": "align-items:flex-end;padding-bottom:110px", top: "align-items:flex-start;padding-top:80px" };

// dark = true for a light background: dark text with a light glow.
export function renderText(layer, htmlFile, pngFile, { dark = false } = {}) {
  writeFileSync(htmlFile, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}
body{width:1280px;height:720px;display:flex;justify-content:center;${PLACE[layer.position] || PLACE.center};box-sizing:border-box}
p{margin:0 80px;font:600 54px/1.25 Georgia,"Times New Roman",serif;color:${dark ? "#2b1d14" : "#fff"};text-align:center;text-shadow:${dark ? "0 1px 10px rgba(255,255,255,.7)" : "0 2px 14px rgba(0,0,0,.65),0 0 3px rgba(0,0,0,.5)"}}</style></head>
<body><p>${lines(layer.text)}</p></body></html>`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000",
    "--window-size=1280,720", `--screenshot=${pngFile}`, `file://${htmlFile}`], { stdio: "ignore" });
  return pngFile;
}
