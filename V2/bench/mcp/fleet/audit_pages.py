"""Builds the human-audit pages: one HTML per auditor, the same tests, separate auto-saved notes (browser storage, keyed by auditor and test).
Reads every result folder listed in SOURCES (API-harness runs and fleet runs), one block per test, one collapsed block per chat.
Usage: python3 V2/bench/mcp/fleet/audit_pages.py [--out /path/to/dir] [--fleet pilot1,pilot2]
Keep the page minimal: no explanations on it, only the data, the filters, the notes."""
import json, os, glob, html, base64, subprocess, sys, re, collections, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from why_common import ckey, cid, WHY_DIR
WHY = {}
for _f in glob.glob(WHY_DIR + '*.json'):
    if not _f.endswith('clusters.json'):
        _w = json.load(open(_f))
        if _w.get('result'): WHY[_w['id']] = _w
V2 = "/Users/ray/Coding/magic-agent-video-generator/V2/"
R = V2 + "bench/v1/results/"; FLEET = R + "fleet/"
SP = "/private/tmp/claude-501/-Users-ray-Coding-magic-hour-mcp/df9aab02-1613-4a89-ac8f-8d1ec407c2f1/scratchpad/"
args = sys.argv[1:]
OUT = args[args.index("--out") + 1] if "--out" in args else "/Users/ray/Coding/magic-hour-mcp/Benchmark/audit"
FLEET_TAGS = (args[args.index("--fleet") + 1].split(",") if "--fleet" in args else [])
FLEET_TAGS = sorted(set(FLEET_TAGS) | {n for n in os.listdir(R + "fleet") if re.match(r"s\d", n)})   # every stage folder (s1, s2, s2r, s2rr, s3 ...) is always included
ART = "--artifact" in args
esc = lambda s: html.escape(str(s if s is not None else ""), quote=True)
FREE = {"get_workflow_guide", "ping", "wait_for_video_project", "wait_for_image_project", "wait_for_audio_project", "fetch_image_download", "fetch_audio_download", "fetch_video_download", "get_account_info", "list_saved_items", "get_upload_urls", "get_face_detection_results", "get_video_project", "get_image_project", "get_audio_project", "join_production_clips", "join_videos", "get_last_frame", "plan_request", "plan_video_production", "detect_faces", "upload_chatgpt_image", "upload_chatgpt_media", "voices_list"}
ITEMS = {}
for f in glob.glob(V2 + "bench/v1/items/*.json"):
    d = json.load(open(f)); ITEMS[d["id"]] = d
def host_usd(u):   # Opus 5.5 list prices per M tokens: in 4, out 20, cache read 0.2, cache write 5; usage.input = everything the model read
    fresh = u.get("input", 0) - u.get("cached", 0) - u.get("cache_write", 0)
    return (fresh * 4 + u.get("output", 0) * 20 + u.get("cached", 0) * 0.2 + u.get("cache_write", 0) * 5) / 1e6
def price_per(folder):   # what a dry chat attempted, priced with the measured prices (a lower bound for multi-step items)
    js = "import {priceDir} from '" + SP + "price2.mjs'; console.log(JSON.stringify(priceDir(process.argv[1]).per))"
    out = subprocess.run(["node", "--input-type=module", "-e", js, R + folder], capture_output=True, text=True)
    try: return json.loads(out.stdout.strip().splitlines()[-1])
    except Exception: return {}
_thumbs = {}
def thumb(path):   # a small JPEG of a picture or a poster frame of a clip, as a data URI
    if path in _thumbs: return _thumbs[path]
    uri = ""
    try:
        vf = ["-ss", "1"] if re.search(r"\.(mp4|mov|webm)$", path, re.I) else []
        b = subprocess.run(["ffmpeg", "-loglevel", "error", *vf, "-i", path, "-frames:v", "1", "-vf", "scale=480:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "6", "-"], capture_output=True, timeout=60).stdout
        if b: uri = "data:image/jpeg;base64," + base64.b64encode(b).decode()
    except Exception: pass
    _thumbs[path] = uri; return uri
def short(a, n=140):
    try: s = json.dumps(a, ensure_ascii=False)
    except Exception: s = str(a)
    return s if len(s) <= n else s[:n] + "…"

CONV_CHECKS = ("asks first", "asks nothing", "stops asking", "refuses", "does not refuse", "says it is beyond", "reply meets", "must-haves met", "finished what it started")
def mk_checklist(checks, must):
    L = []
    def crop_of(name, got):   # a picture or clip that is only a little off the asked shape can be cropped to it: how much would have to go (None if not an aspect check)
        m = re.match(r"aspect (\d+):(\d+)", name)
        if not m: return None
        try:
            t = int(m.group(1)) / int(m.group(2)); cs = []
            for z in json.loads(got):
                w, h = [float(x) for x in str(z).split("x")]; r = w / h; cs.append(1 - min(r / t, t / r))
            return max(cs) if cs else None
        except Exception: return None
    for c in checks or []:
        if str(c.get("name", "")).startswith(CONV_CHECKS): continue
        cr = None if c.get("pass") else crop_of(c["name"], str(c.get("got", "")))
        if cr is not None and cr <= 0.15: L.append(dict(kind="check", text=f"{c['name']} (crop {cr * 100:.0f}% to fit)", st="ok", why="")); continue
        L.append(dict(kind="check", text=c["name"], st="ok" if c.get("pass") else "no", why="" if c.get("pass") else str(c.get("got", ""))[:200]))
    for m in must or []:
        L.append(dict(kind="must", text=m["item"], st={"yes": "ok", "no": "no"}.get(m.get("met"), "?"), why=m.get("why", "")))
    return L
chats = []   # every chat of every source, in one shape
def add_api_folder(folder, side, persona, mode, label):
    d = R + folder
    if not os.path.exists(d + "/run.json"): return
    run = json.load(open(d + "/run.json")); conv = {}
    if os.path.exists(d + "/conversation.json"): conv = {i["id"]: i for i in json.load(open(d + "/conversation.json"))["items"]}
    pp = price_per(folder) if run.get("dry") else {}
    recs = []
    for f in sorted(glob.glob(d + "/*.json")):
        b = os.path.basename(f)
        if b.endswith((".trace.json", ".conv.json", ".grade.json")) or b in ("run.json", "tools.json", "uploads.json", "conversation.json", "grades.json"): continue
        try: r = json.load(open(f))
        except Exception: continue
        if isinstance(r, dict) and r.get("id") and r.get("turns") is not None: recs.append(r)
    total = (run.get("claude_spend") or {}).get("usd", 0); host = sum(host_usd(r.get("usage") or {}) for r in recs); rest = max(0.0, total - host)
    weights = {}
    for r in recs:
        tf = f"{d}/{r['id']}.trace.json"; n = 1
        if os.path.exists(tf):
            try: n += sum(1 for e in json.load(open(tf))["events"] if e["type"] in ("classify", "proxy"))
            except Exception: pass
        weights[r["id"]] = n
    wsum = sum(weights.values()) or 1
    for r in recs:
        if r.get("error") and not r.get("turns"): continue
        c = conv.get(r["id"], {}); j = c.get("judge") or {}; g = None
        gf = f"{d}/{r['id']}.grade.json"
        if os.path.exists(gf): g = json.load(open(gf))
        tr = []; calls = []; files = []; full = []
        for t in r["turns"]:
            for e in t.get("timeline") or []:
                if e.get("type") == "call":
                    res = str(e.get("result") or ""); st = "REFUSED" if res.startswith("Refused by the account") else "error" if res.startswith("Error:") else "ok"
                    full.append(dict(tool=e.get("name"), args=parse(e.get("arguments")), result=res, status=st))
            tr.append(("user", t.get("text"), "next message" if t.get("follow_up") else ""))
            for dd in t.get("dialog", []):
                tr.append(("assistant", dd.get("agent"), (dd.get("asked") or [""])[0])); tr.append(("user", dd.get("user"), "push" if dd.get("nudge") else "gave up" if dd.get("gave_up") else ""))
            if t.get("agent"): tr.append(("assistant", t.get("agent"), t.get("kind") or ""))
            for a in t.get("approvals", []) or []:
                if a["name"] in FREE and a.get("approve"): continue
                calls.append(f"{'REFUSED ' if not a.get('approve') else ''}{a['name']} {short(a.get('args'))}" + (f" — {a.get('reason', '')[:120]}" if not a.get("approve") else ""))
            for k in t.get("calls", []):
                if k["name"] in FREE: calls.append(f"{k['name']}")
                else: calls.append(f"ran {k['name']} {short(parse(k.get('arguments')))}")
            for s in t.get("ran", []) or []:
                if s.get("output") and rec_dir(r): files.append((V2 + r["sessionDir"] + "/" + s["output"], s.get("tool")))
        att = [a["name"] for t in r["turns"] for a in (t.get("approvals") or []) if a["name"] not in FREE and (run.get("dry") or a.get("approve"))] if run.get("dry") else [k["name"] for t in r["turns"] for k in t.get("calls", []) if k["name"] not in FREE]
        must = (g.get("reply") or {}).get("must_haves") if g else None
        cl = mk_checklist(g.get("checks"), ((g.get("judge") or {}).get("must_haves") or (g.get("reply") or {}).get("must_haves"))) if g else None
        gsum = ((g.get("judge") or {}).get("summary") or (g.get("reply") or {}).get("summary")) if g else None
        chats.append(dict(id=r["id"], side=side, persona=persona, mode=mode, src="api", label=label, seconds=r.get("seconds"), usd=round(host_usd(r.get("usage") or {}) + rest * weights[r["id"]] / wsum, 2), credits=r.get("spent", 0),
            credits_if_live=pp.get(r["id"]), questions=sum(len(t.get("dialog", [])) for t in r["turns"]), kind=(r["turns"][-1].get("kind") if r["turns"] else None), tried=sorted(set(att)), verdict=j.get("verdict"), note=j.get("note"),
            grade=(None if not g else dict(passed=bool(g.get("pass")), score=g.get("score"), tags=g.get("tags") or [])), must=must, checklist=cl, gscore=(((g.get("judge") or {}).get("score")) if g else None), gsummary=gsum, transcript=tr, calls=calls, calls_full=full, files=files, error=r.get("error"), gave_up=bool(r.get("gave_up"))))
def parse(s):
    try: return json.loads(s) if isinstance(s, str) else s
    except Exception: return s
def rec_dir(r): return bool(r.get("sessionDir"))
def add_fleet(tag):
    d = FLEET + tag
    if not os.path.exists(d + "/chats.json"): return
    for c in json.load(open(d + "/chats.json")):
        cd = f"{d}/{c['chatId']}"
        if not os.path.exists(cd + "/host.json") or os.path.exists(cd + "/invalid.json"): continue   # a chat the harness refused for its own credit floor is flagged invalid and left out (it is rerun)
        h = json.load(open(cd + "/host.json")); st = json.load(open(cd + "/state.json")); ch = json.load(open(cd + "/chat.json")); r = h.get("result") or {}
        if h.get("note") and not st.get("ended"): continue   # written afterwards while the host was still running: not finished yet
        ev = [json.loads(l) for l in open(cd + "/calls.jsonl") if l.strip()]
        tr = [(m["role"], m["text"], m.get("kind") or ("push" if m.get("nudge") else "gave up" if m.get("give_up") else "")) for m in st.get("transcript", [])]
        calls = []; files = []; credits = 0; full = []
        for e in ev:
            if e["type"] == "call":
                full.append(dict(tool=e["tool"], args=e.get("args"), result=(e.get("output") or e.get("error") or ("Refused by the account: " + str(e.get("reason", "")))), status=("REFUSED" if not e["approve"] else "error" if e.get("error") else "ok"), credits=e.get("credits"), ms=e.get("ms")))
                if e["approve"]: credits += e.get("credits") or 0
                if e["tool"] in FREE and e["approve"]: calls.append(e["tool"])
                else: calls.append(f"{'' if e['approve'] else 'REFUSED '}{e['tool']} {short(e.get('args'))}" + ("" if e["approve"] else f" — {e.get('reason', '')[:120]}") + (f" · {e.get('credits')} cr" if e["approve"] and e.get("credits") else ""))
                for f in e.get("files") or []:
                    if not f.startswith("download failed"): files.append((f"{cd}/{f}", e["tool"]))
        gj = json.load(open(cd + "/grade.json")) if os.path.exists(cd + "/grade.json") else None
        cl = mk_checklist(gj.get("checks"), gj.get("must")) if gj and not gj.get("error") else None
        says = [e for e in ev if e["type"] == "say"]; helper = sum(e.get("usd") or 0 for e in ev if e["type"] == "llm")
        att = sorted({e["tool"] for e in ev if e["type"] == "call" and e["tool"] not in FREE and (ch["mode"] == "dry" or e["approve"])})
        chats.append(dict(id=ch["item"], side=ch["side"], persona=ch["persona"]["name"], mode=ch["mode"], src="agent", label=tag, seconds=h.get("seconds"), usd=round((r.get("total_cost_usd") or 0) + helper, 2), credits=credits, credits_if_live=None,
            questions=sum(1 for m in st.get("transcript", []) if m["role"] == "user") - 1, kind=(says[-1]["kind"] if says else None), tried=att, verdict=None, note=None, grade=None, must=None, checklist=cl, gscore=(gj or {}).get("score"), gusable=(gj or {}).get("usable_as_is"), gsummary=(gj or {}).get("summary"), transcript=tr, calls=calls, calls_full=full, files=files,
            error=(None if not (r.get("is_error") or h.get("exit")) else str(r.get("result") or h.get("stderr"))[:200]), gave_up=any(m.get("give_up") for m in st.get("transcript", []))))

for side in ("old", "new"):
    for p in ("happy", "stupid", "dumper"):
        add_api_folder(f"b0-dry-{side}-{p}", side, p, "dry", "b0 dry")
        add_api_folder(f"b0-live-{side}-{p}", side, p, "live", "b0 live")
        add_api_folder(f"b0-live-{side}-{p}-c15b", side, p, "live", "b0 live C15b")
        add_api_folder(f"b1-dry-{side}-{p}", side, p, "dry", "b1 dry")
for tag in FLEET_TAGS: add_fleet(tag)

# ---- html
def cut(s, n):
    s = str(s if s is not None else ""); return s if len(s) <= n else s[:n] + f" …[cut: {len(s)} chars in all]"
def call_html(i, k):
    head = f"#{i} {k['tool']}" + (f" · {k['status']}" if k["status"] != "ok" else "") + (f" · {k['credits']} cr" if k.get("credits") else "") + (f" · {k['ms']} ms" if k.get("ms") else "")
    a = k.get("args"); at = a if isinstance(a, str) else json.dumps(a, ensure_ascii=False, indent=1)
    return f"<details class='k'{' open' if k['tool'] not in FREE else ''}><summary>{esc(head)}</summary><pre>{esc(cut(at, 3000))}</pre><pre class='res'>{esc(cut(k.get('result'), 1500))}</pre></details>"
import shutil
MEDIA_STATS = collections.Counter()
def media_items(c):   # the outputs of a chat, copied next to the pages so the folder can be shared: (relative path, kind, poster)
    key = re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{c['label']}.{c['side']}.{c['persona']}.{c['id']}"); items = []; seen = set()
    for path, tool in c["files"]:
        b = os.path.basename(path)
        if b in seen or not os.path.exists(path) or len(seen) >= 4: continue
        seen.add(b); os.makedirs(f"{OUT}/media/{key}", exist_ok=True); dest = f"{OUT}/media/{key}/{b}"
        if not os.path.exists(dest): shutil.copy2(path, dest)
        kind = "video" if re.search(r"\.(mp4|mov|webm)$", b, re.I) else "audio" if re.search(r"\.(mp3|wav|m4a)$", b, re.I) else "image"
        items.append((f"media/{key}/{b}", kind, thumb(path) if kind == "video" else "")); MEDIA_STATS[kind] += 1
    if items: MEDIA_STATS["chats with output"] += 1
    if any(k == "video" for _, k, _ in items): MEDIA_STATS["chats with video"] += 1
    return items
def steps_html(c):   # everything between the brief and the output: the conversation, every tool call with its arguments and result, the checks
    meta = [c["label"], c["mode"], f"asked {c['questions']}", ("tried " + ",".join(c["tried"])) if c["tried"] else "no create", f"${c['usd']:.2f}" + (" list" if c["src"] == "agent" else "")]
    if c["verdict"]: meta.append(f"judge {c['verdict']}")
    if c["grade"]: meta.append("grader " + ("pass" if c["grade"]["passed"] else "FAIL") + f" {c['grade']['score']}")
    if c["gave_up"]: meta.append("gave up")
    body = f"<p class='tools'>{esc(' · '.join(meta))}</p>"
    body += "".join(f"<p class='{r}'><b>{'USER' if r == 'user' else 'ASSISTANT'}{(' · ' + esc(tag)) if tag else ''}</b>{esc(SAN(t))}</p>" for r, t, tag in c["transcript"] if t)
    if c.get("calls_full"): body += f"<details class='k0' open><summary>tool calls ({len(c['calls_full'])})</summary>" + "".join(call_html(i + 1, k) for i, k in enumerate(c["calls_full"])) + "</details>"
    elif c["calls"]: body += "<p class='tools'><b>TOOLS</b>" + esc("\n".join(c["calls"])) + "</p>"
    if c["must"]: body += "<p class='tools'><b>CHECKLIST (grader)</b>" + esc("\n".join(f"{'✓' if m['met'] == 'yes' else '✗'} {m['item']} — {m['why']}" for m in c["must"])) + "</p>"
    if c["note"]: body += f"<p class='tools'><b>JUDGE NOTE</b>{esc(c['note'])}</p>"
    if c["error"]: body += f"<p class='tools'><b>ERROR</b>{esc(str(c['error'])[:300])}</p>"
    return body
def ck_html(c):
    L = c.get("checklist")
    if L is None: return "<p class='s'>checklist · " + ("dry: nothing made" if c["mode"] == "dry" else "not graded yet") + "</p>"
    ok = sum(1 for x in L if x["st"] == "ok"); bad = sum(1 for x in L if x["st"] == "no"); cls = "bad" if bad else "unk" if ok < len(L) else "good"
    def why_html(x):
        w = WHY.get(cid(ckey(c["id"], x["text"], x["kind"] == "check"))) if x["st"] == "no" else None
        if not w: return ""
        r = w["result"]; steps = "".join(f"<li><b>{esc(t['why'])}</b> {esc(t['because'])} <i>[{esc(t['evidence'])}]</i></li>" for t in r["whys"])
        return f"<details class='why'><summary>why? ({len(r['whys'])} steps → {esc(r['category'])})</summary><ol>{steps}</ol><p><b>AXIOM</b> {esc(r['axiom'])}</p><p class='s'>sits in: {esc(r['builds'])} · fix: {esc(r['fix'])} · seen in {w['n']} chats</p></details>"
    lines = "".join(f"<li class='{x['st']}'>{'✓' if x['st'] == 'ok' else '✗' if x['st'] == 'no' else '?'} {esc(x['text'])}" + (f" <i>— {esc(x['why'])}</i>" if x["why"] and x["st"] != "ok" else "") + why_html(x) + "</li>" for x in L)
    extra = f"<p class='s'>{('score ' + str(c['gscore']) + ' · ') if c.get('gscore') else ''}{esc(c.get('gsummary') or '')}</p>" if (c.get("gsummary") or c.get("gscore")) else ""
    return f"<details class='ck {cls}'><summary>checklist {ok}/{len(L)}{(' · ' + str(bad) + ' not done') if bad else ''}</summary><ul>{lines}</ul>{extra}</details>"
def render_media(kind, rel, poster):
    if kind == "video": return f"<video controls preload='none' poster='{poster}' src='{esc(rel)}'></video>"
    if kind == "audio": return f"<audio controls preload='none' src='{esc(rel)}'></audio>"
    return f"<a href='{esc(rel)}' target='_blank'><img loading='lazy' src='{esc(rel)}'></a>"
def card_html(c):
    media = media_items(c)
    if media:
        parts = []
        for rel, kind, poster in media:
            parts.append(render_media(kind, rel, poster))
        m = f"<div class='m n{min(len(parts), 4)}'>{''.join(parts)}</div>"
    else:
        last = next((t for r, t, tag in reversed(c["transcript"]) if r == "assistant" and t), "")
        m = f"<div class='m none'><span>no output · {esc(cut(last, 240))}</span></div>"
    cap = [c["side"], c["persona"], f"{c['seconds']} s" if c["seconds"] is not None else "– s", f"{c['credits']} cr" + (f" (≈{c['credits_if_live']:.0f} if live)" if c["credits_if_live"] and c["mode"] == "dry" else ""), c["kind"] or "–"]
    if c["error"]: cap.append("ERROR")
    return (f"<article class='c' data-side='{c['side']}' data-user='{c['persona']}' data-mode='{c['mode']}' data-src='{c['src']}' data-err='{1 if c['error'] else 0}' data-bad='{1 if c.get('checklist') and any(x['st'] == 'no' for x in c['checklist']) else 0}'>{m}<p class='s'>{esc(' · '.join(cap))}</p>{ck_html(c)}"
            f"<details class='st'><summary>steps</summary>{steps_html(c)}</details></article>")
CARD = card_html
LABEL = {}
HALF = {}
SAN = lambda t: t
by = collections.defaultdict(list)
for c in chats: by[c["id"]].append(c)
SIDE = {"old": 0, "new": 1}; USER = {"happy": 0, "stupid": 1, "dumper": 2}
def test_html(tid):
    it = ITEMS.get(tid, {}); cs = by[tid]
    t0 = it.get("turns", [{}])[0]; att = ", ".join(t0.get("materials") or [])
    wanted = "".join(f"<li>{esc(m)}</li>" for m in it.get("must_haves", []))
    sheet = esc(json.dumps(it.get("answer_sheet", {}), ensure_ascii=False, indent=1))
    labels = collections.OrderedDict()
    PRIO = {"s1": 0, "s2": 0, "b0 live": 1, "b0 live C15b": 1, "pilot1": 3, "pilot2": 3}
    for c in sorted(cs, key=lambda c: (0 if c["mode"] == "live" else 1, PRIO.get(c["label"], 2), c["label"], SIDE[c["side"]], USER[c["persona"]])): labels.setdefault(c["label"], []).append(c)
    grids = "".join(f"<div class='g'><small>{esc(lab)}</small><div class='grid'>{''.join(CARD(c) for c in lcs)}</div></div>" for lab, lcs in labels.items())
    graded = [c for c in cs if c.get("checklist") is not None and c["mode"] == "live"]; done_n = sum(1 for c in graded if not any(x["st"] == "no" for x in c["checklist"]))
    sc = {sd: [c["gscore"] for c in graded if c["side"] == sd and c.get("gscore")] for sd in ("old", "new")}
    prog = (f" · {done_n}/{len(graded)} complete" + (" · score " + " / ".join(f"{sd} {sum(v) / len(v):.1f}" for sd, v in sc.items() if v) if any(sc.values()) else "")) if graded else ""
    return (f"<section class='t' data-id='{tid}' data-half='{HALF.get(tid, '')}' data-group='{esc(it.get('group', ''))}' data-search='{esc((tid + ' ' + it.get('title', '')).lower())}'>"
            f"<h3>{LABEL.get(tid, '')}{tid} · {esc(it.get('title', ''))} <small>{esc(it.get('group_name', ''))}{prog}</small> <button class='ob'>checklists</button></h3>"
            f"<details><summary>brief · wanted</summary><p class='user'><b>BRIEF</b>{esc(t0.get('text', ''))}{(chr(10) + 'ATTACHED: ' + esc(att)) if att else ''}</p><ul>{wanted}</ul><p class='tools'><b>USER KNOWS</b>{sheet}</p></details>"
            f"{grids}"
            f"<div class='n'><select class='mark'><option value=''>–</option><option value='ok'>ok</option><option value='issue'>issue</option></select><textarea class='note' rows='2' placeholder='notes'></textarea></div></section>")
tids = sorted(by, key=lambda x: (ITEMS.get(x, {}).get("group", "Z"), x))
groups = sorted({ITEMS.get(t, {}).get("group", "?") for t in tids})
CSS = """:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#ddd;--a:#f4f4f4;--u:#eef5ff;--t:#fff8e6}@media(prefers-color-scheme:dark){:root{--bg:#161616;--fg:#e8e8e8;--mut:#9a9a9a;--line:#333;--a:#202020;--u:#17222f;--t:#2a2515}}
body{margin:0 auto;max-width:1200px;padding:0 16px 80px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
#bar{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;z-index:5}
select,input,textarea,button{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:3px 6px}
h1{font-size:16px;margin:10px 0 0}h3{font-size:15px;margin:22px 0 6px}small{color:var(--mut);font-weight:400}
section.t{border-top:1px solid var(--line);padding-bottom:8px}summary{cursor:pointer;padding:4px 8px;font-size:13px}
details>p,details>ul{margin:0;padding:6px 10px;white-space:pre-wrap;word-break:break-word}details>ul{padding-left:28px}p b{display:block;font-size:11px;color:var(--mut);letter-spacing:.04em}
.user{background:var(--u)}.assistant{background:var(--a)}.tools{background:var(--t);font:12px/1.4 ui-monospace,monospace}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:2px 0 6px}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
article.c{border:1px solid var(--line);border-radius:6px;padding:4px;min-width:0;display:flex;flex-direction:column;gap:3px}
.m{aspect-ratio:1/1;background:var(--a);border-radius:4px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;overflow:hidden}.m img,.m video{max-width:100%;max-height:100%;object-fit:contain;display:block}.m.n2>*,.m.n3>*,.m.n4>*{width:50%;height:50%}.m a{display:contents}
.m.none{align-items:flex-start;justify-content:flex-start;padding:8px;font-size:12px;color:var(--mut);overflow:auto;white-space:pre-wrap}.m audio{width:100%}
.s{margin:0;font-size:11px;color:var(--mut)}details.st>summary{font-size:11px;color:var(--mut);padding:0 2px}details.st{border:0}
details.k{border:0;margin:0}details.k>summary{font:12px ui-monospace,monospace;color:var(--mut);padding:2px 10px}pre{margin:0;padding:4px 10px;white-space:pre-wrap;word-break:break-word;font:12px/1.4 ui-monospace,monospace}pre.res{background:var(--a)}details.k0>summary{padding:2px 10px;font-size:12px}
.n{display:flex;gap:6px;margin-top:6px}.n textarea{flex:1}#g{width:100%;box-sizing:border-box}.ck>summary{font-size:11px;padding:0 2px;color:var(--mut)}.ck.bad>summary{color:#e5484d}.ck.good>summary{color:#30a46c}.ck.unk>summary{color:#d9a40b}.ck ul{margin:0;padding:2px 4px 4px 6px;font-size:11px;list-style:none}.ck li{padding:1px 0}.ck li.no{color:#e5484d}.ck li.unk{color:#d9a40b}.ck li i{color:var(--mut)}details.ck{border:0}h2{font-size:17px;margin:34px 0 0;border-top:2px solid var(--line);padding-top:10px}.ob{font-size:11px;padding:1px 8px;margin-left:8px;cursor:pointer}#stats table{border-collapse:collapse;font-size:12px;margin:8px 0}#stats th,#stats td{border:1px solid var(--line);padding:2px 6px;text-align:right}#stats td:first-child{text-align:left}details.why{margin:2px 0 4px 10px}details.why>summary{color:#6e56cf}details.why ol{margin:2px 0;padding-left:18px}details.why p{margin:2px 0;padding:0;background:none}[hidden]{display:none!important}"""
JS = """const A=document.body.dataset.auditor,$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const get=k=>{try{return localStorage.getItem(A+'.'+k)||''}catch(e){return ''}},put=(k,v)=>{try{localStorage.setItem(A+'.'+k,v)}catch(e){}};
$('#g').value=get('global');$('#g').oninput=e=>put('global',e.target.value);
$$('.t').forEach(t=>{const id=t.dataset.id,n=$('.note',t),m=$('.mark',t);n.value=get(id+'.note');m.value=get(id+'.mark');n.oninput=()=>{put(id+'.note',n.value);f()};m.onchange=()=>{put(id+'.mark',m.value);f()}});
const F={group:$('#fg'),user:$('#fu'),side:$('#fs'),mode:$('#fm'),src:$('#fr'),mark:$('#fk'),q:$('#fq'),err:$('#fe'),bad:$('#fb')};
function f(){let nt=0,nc=0;$$('.t').forEach(t=>{const id=t.dataset.id,mk=$('.mark',t).value,has=!!$('.note',t).value;let ok=(!F.group.value||t.dataset.group===F.group.value)&&(!F.q.value||t.dataset.search.includes(F.q.value.toLowerCase()));
const k=F.mark.value;if(k==='none')ok=ok&&!mk&&!has;else if(k==='note')ok=ok&&has;else if(k)ok=ok&&mk===k;
let vis=0;$$('.c',t).forEach(c=>{const s=(!F.user.value||c.dataset.user===F.user.value)&&(!F.side.value||c.dataset.side===F.side.value)&&(!F.mode.value||c.dataset.mode===F.mode.value)&&(!F.src.value||c.dataset.src===F.src.value)&&(!F.err.checked||c.dataset.err==='1')&&(!F.bad.checked||c.dataset.bad==='1');c.hidden=!s;if(s)vis++});
$$('.g',t).forEach(g=>g.hidden=!$('.c:not([hidden])',g));t.hidden=!(ok&&vis);if(!t.hidden){nt++;nc+=vis}});$$('.gw').forEach(g=>g.hidden=!$('.t:not([hidden])',g));$('#cnt').textContent=nt+' tests · '+nc+' chats'}
Object.values(F).forEach(x=>x.oninput=f);f();
$$('.ob').forEach(b=>b.onclick=()=>{const sc=b.closest('.t')||b.closest('.gw'),ds=$$('article.c:not([hidden]) .ck',sc),openAll=ds.some(d=>!d.open);ds.forEach(d=>d.open=openAll)});
$('#ex').onclick=()=>{let o='# Notes '+A+'\\n\\n'+(get('global')?get('global')+'\\n\\n':'');$$('.t').forEach(t=>{const id=t.dataset.id,n=get(id+'.note'),m=get(id+'.mark');if(n||m)o+='## '+id+' '+(m?'['+m+']':'')+'\\n'+n+'\\n\\n'});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([o],{type:'text/markdown'}));a.download='notes-'+A+'.md';a.click()};"""
def stats_html():
    live = [c for c in chats if c["src"] == "agent" and c["mode"] == "live" and c.get("checklist") is not None]
    def agg(rs):
        if not rs: return None
        items = [x for c in rs for x in c["checklist"]]; sc = [c["gscore"] for c in rs if c.get("gscore")]; us = [c["gusable"] for c in rs if c.get("gusable") is not None]
        return dict(n=len(rs), ticked=100 * sum(1 for c in rs if not any(x["st"] == "no" for x in c["checklist"])) / len(rs), items=100 * sum(1 for x in items if x["st"] == "ok") / max(1, len(items)), score=sum(sc) / max(1, len(sc)),
                    usable=100 * sum(1 for u in us if u) / max(1, len(us)), cr=sum(c["credits"] for c in rs) / len(rs), sec=sum((c["seconds"] or 0) for c in rs) / len(rs), usd=sum(c["usd"] for c in rs) / len(rs), cr_total=sum(c["credits"] for c in rs))
    f = lambda a, k, fmt: "–" if not a else format(a[k], fmt)
    rows = "".join(f"<tr><td>{lab}</td>" + "".join(f"<td>{f(a, 'n', '.0f')}</td><td>{f(a, 'ticked', '.0f')}%</td><td>{f(a, 'items', '.0f')}%</td><td>{f(a, 'score', '.2f')}</td><td>{f(a, 'usable', '.0f')}%</td><td>{f(a, 'cr', '.0f')}</td><td>{f(a, 'sec', '.0f')}</td>" for a in (agg([c for c in rs if c["side"] == "old"]), agg([c for c in rs if c["side"] == "new"]))) + "</tr>"
                   for lab, rs in [("all", live)] + [(f"{g} · {esc(ITEMS[next(t for t in tids if ITEMS.get(t, {}).get('group') == g)].get('group_name', ''))}", [c for c in live if ITEMS.get(c["id"], {}).get("group") == g]) for g in groups] if rs)
    head = "<tr><th rowspan=2>type</th>" + "".join(f"<th colspan=7>{b}</th>" for b in ("old", "new")) + "</tr><tr>" + "".join("<th>chats</th><th>ticked</th><th>items ok</th><th>score</th><th>usable</th><th>credits</th><th>s</th>" for _ in range(2)) + "</tr>"
    tot = agg(live); tc = f" · {tot['cr_total']:.0f} credits in these chats · mean host usage ${tot['usd']:.2f} per chat (list price)" if tot else ""
    return f"<div id='stats'><table><thead>{head}</thead><tbody>{rows}</tbody></table><p class='s'>agent chats with a graded checklist · ticked = every check and must-have met · items ok = share of all checklist lines met · score 1-5 from the grader · credits and seconds are means per chat{tc}</p></div>"
def group_html(g):
    gt = [t for t in tids if ITEMS.get(t, {}).get("group") == g]
    if not gt: return ""
    return f"<div class='gw' data-group='{esc(g)}'><h2>{esc(g)} · {esc(ITEMS[gt[0]].get('group_name', ''))} <button class='ob'>checklists</button></h2>{''.join(test_html(t) for t in gt)}</div>"
def page(auditor):
    opt = lambda vals: "".join(f"<option value='{v}'>{v}</option>" for v in vals)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit {auditor}</title><style>{CSS}</style></head>
<body data-auditor="{auditor}"><h1>Audit · {auditor}</h1>
{stats_html()}
<div id="bar"><select id="fg"><option value="">group</option>{opt(groups)}</select><select id="fu"><option value="">user</option>{opt(["happy", "stupid", "dumper"])}</select><select id="fs"><option value="">build</option>{opt(["old", "new"])}</select><select id="fm"><option value="">mode: any</option><option value="dry">dry</option><option value="live" selected>live</option></select><select id="fr"><option value="">source</option><option value="api">api</option><option value="agent">agent</option></select><select id="fk"><option value="">marked: any</option><option value="none">unmarked</option><option value="ok">ok</option><option value="issue">issue</option><option value="note">has note</option></select><label><input type="checkbox" id="fb"> not done</label><label><input type="checkbox" id="fe"> errors</label><input id="fq" placeholder="search"><span id="cnt"></span><button id="ex">export notes</button></div>
<textarea id="g" rows="3" placeholder="notes"></textarea>
{''.join(group_html(g) for g in groups)}
<script>{JS}</script></body></html>"""
if ART:   # two pages for Claude Artifacts: every test in both, one top down (batch A), one bottom up (batch B); the halfway line splits the review effort 50/50
    ART_OUT = args[args.index("--art-out") + 1] if "--art-out" in args else "/Users/ray/Coding/magic-hour-mcp/Benchmark/audit/artifacts"; os.makedirs(ART_OUT, exist_ok=True)
    TW = int(os.environ.get("THUMB_W", "300")); TQ = int(os.environ.get("THUMB_Q", "12")); MAXM = int(os.environ.get("MAX_MEDIA", "2"))
    def san(t):   # no signed links, no local paths in a page that leaves the machine
        t = re.sub(r"\?X-Goog-[^\s\"')\]]*", "?…", str(t)); t = re.sub(r"[?&](Signature|Expires|token|sig)=[^\s\"')\]&]*", "", t); return re.sub(r"/Users/ray/[^\s\"'<>)\]]*", "<path>", t)
    _cut0 = cut
    def cut(s, n): return _cut0(san(s), min(n, 1100 if n >= 3000 else 700))
    SAN = san
    keep = [c for c in chats if not c["label"].startswith("pilot")]; live_ids = {c["id"] for c in keep if c["mode"] == "live"}
    chats = [c for c in keep if c["mode"] == "live" or c["id"] not in live_ids]          # live chats; a dry chat only for a test that has no live chat (the refusal tests)
    def probe(path):
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
        try: return float(r)
        except Exception: return 0.0
    def jpeg(a):
        return subprocess.run(["ffmpeg", "-loglevel", "error", *a, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", str(TQ), "-"], capture_output=True, timeout=90).stdout
    URI = lambda b: ("data:image/jpeg;base64," + base64.b64encode(b).decode()) if b else ""
    VS = int(os.environ.get("VIDEO_SHORT", "360")); VCRF = os.environ.get("VIDEO_CRF", "33"); CACHE = ART_OUT + "/cache"; os.makedirs(CACHE, exist_ok=True)
    isvid = lambda p: re.search(r"\.(mp4|mov|webm)$", p, re.I); isaud = lambda p: re.search(r"\.(mp3|wav|m4a)$", p, re.I)
    def pick(c):   # the outputs shown for a chat: its last MAXM distinct files (the finished result is usually the last one made)
        seen = []
        for path, tool in c["files"]:
            if os.path.exists(path) and path not in seen and os.path.basename(path) not in {os.path.basename(x) for x in seen}: seen.append(path)
        return seen[-MAXM:]
    def small(path):   # a small playable copy (video: short side VS px, sound kept; audio: mono 64k), cached by source path; "" if it could not be made
        o = f"{CACHE}/{hashlib.sha1(path.encode()).hexdigest()[:14]}.mp4"
        if not (os.path.exists(o) and os.path.getsize(o) > 0):
            cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", path] + (["-vn", "-c:a", "aac", "-b:a", "64k", "-ac", "1"] if isaud(path) else ["-vf", f"scale='if(gt(iw,ih),-2,min({VS},iw))':'if(gt(iw,ih),min({VS},ih),-2)'", "-r", "24", "-c:v", "libx264", "-preset", "veryfast", "-crf", VCRF, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "48k", "-ac", "1"]) + ["-movflags", "+faststart", o + ".part.mp4"]
            try: subprocess.run(cmd, capture_output=True, timeout=600)
            except Exception: pass
            if os.path.exists(o + ".part.mp4"): os.replace(o + ".part.mp4", o)
        return o if os.path.exists(o) and os.path.getsize(o) > 0 else ""
    from concurrent.futures import ThreadPoolExecutor
    _todo = sorted({q for c in chats for q in pick(c) if isvid(q) or isaud(q)})
    with ThreadPoolExecutor(max_workers=6) as _ex: _small = dict(zip(_todo, _ex.map(small, _todo)))
    print(f"playable copies: {sum(1 for v in _small.values() if v)} of {len(_todo)} ({sum(os.path.getsize(v) for v in _small.values() if v) / 1e6:.0f} MB)", flush=True)
    PUB = {}   # per page: small copy -> its published name (m/1.mp4, m/2.mp4 ...)
    def pubname(f):
        if f not in PUB: PUB[f] = f"m/{len(PUB) + 1}.mp4"
        return PUB[f]
    def media_items(c):
        out = []
        for path in pick(c):
            if isvid(path):
                f = _small.get(path); d = probe(path); out.append((pubname(f) if f else "", "video", URI(jpeg(["-ss", f"{min(max(d / 3, 0.2), 3):.2f}", "-i", path, "-vf", f"scale={TW}:-2"]))))
            elif isaud(path): f = _small.get(path); out.append((pubname(f) if f else "", "audio", f"{probe(path):.0f} s"))
            else: out.append((URI(jpeg(["-i", path, "-vf", f"scale={TW}:-2"])), "image", ""))
        return out
    def render_media(kind, rel, poster):
        if kind == "video": return f"<video controls playsinline preload='none' poster='{poster}' src='{rel}'></video>" if rel else (f"<img src='{poster}' alt='video (no playable copy)'>" if poster else "<div class='aud'>video (no preview)</div>")
        if kind == "audio": return f"<div class='aud'><audio controls preload='none' src='{rel}'></audio>{esc(poster)}</div>" if rel else f"<div class='aud'>audio {esc(poster)} (no playable copy)</div>"
        return f"<img src='{rel}' alt=''>" if rel else "<div class='aud'>image (no preview)</div>"
    by = collections.defaultdict(list)
    for c in chats: by[c["id"]].append(c)
    def nat(t):
        m = re.match(r"([A-Za-z]+)(\d+)(.*)$", t); return (ITEMS.get(t, {}).get("group", "Z"), int(m.group(2)) if m else 0, m.group(3) if m else t)
    canon = sorted(by, key=nat)
    def weight(t):   # review effort of one test: look at every output, read every checklist line, tool call and message, extra for video
        w = 0.0
        for c in by[t]: w += 1 + 0.1 * len(c.get("checklist") or []) + 0.1 * len(c.get("calls_full") or c["calls"]) + 0.25 * sum(len(x[1] or "") for x in c["transcript"]) / 1000 + (0.8 if any(re.search(r"\.(mp4|mov|webm)$", f[0], re.I) for f in c["files"]) else 0)
        return w
    W = {t: weight(t) for t in canon}; tot = sum(W.values()); cum = 0; best = (1e18, 0)
    for i, t in enumerate(canon):
        cum += W[t]
        if abs(cum - tot / 2) < best[0]: best = (abs(cum - tot / 2), i + 1)
    K = best[1]; TOP, BOT = canon[:K], canon[K:]
    TOKENS = (":root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#ddd;--a:#f4f4f4;--u:#eef5ff;--t:#fff8e6;--bad:#c62828;--good:#1b7f4b;--unk:#946200;--why:#5b45b8}"
              "@media(prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--bg:#161616;--fg:#e8e8e8;--mut:#9a9a9a;--line:#333;--a:#202020;--u:#17222f;--t:#2a2515;--bad:#ff7b72;--good:#56d364;--unk:#e3b341;--why:#b4a1ff;color-scheme:dark}}"
              ":root[data-theme=\"dark\"]{--bg:#161616;--fg:#e8e8e8;--mut:#9a9a9a;--line:#333;--a:#202020;--u:#17222f;--t:#2a2515;--bad:#ff7b72;--good:#56d364;--unk:#e3b341;--why:#b4a1ff;color-scheme:dark}")
    CSS_ART = re.sub(r"^:root\{[^}]*\}@media\(prefers-color-scheme:dark\)\{:root\{[^}]*\}\}", lambda m: TOKENS, CSS)
    assert CSS_ART.startswith(TOKENS), "css tokens not replaced"
    for a, b in (("body{margin:0 auto;max-width:1200px;padding:0 16px 80px;", "body{margin:0 auto;max-width:1200px;padding-block:0 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));"), ("#bar{position:sticky;top:0;", "#bar{position:sticky;top:env(safe-area-inset-top,0px);"),
                 ("#e5484d", "var(--bad)"), ("#30a46c", "var(--good)"), ("#d9a40b", "var(--unk)"), ("#6e56cf", "var(--why)")):
        assert a in CSS_ART, a; CSS_ART = CSS_ART.replace(a, b)
    CSS_ART += ("body::before{content:\"\";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}#stats{overflow-x:auto;max-width:100%}.m.none{min-height:0}.aud{padding:10px;font-size:12px;color:var(--mut)}.m img,.m video{width:100%}.mid{margin:26px 0;padding:10px;border:2px dashed var(--line);text-align:center;font-weight:600}"
                "h1{margin-top:14px}#out{width:100%;box-sizing:border-box;margin:6px 0}.lab{font-weight:600;color:var(--fg)}.t[data-half=other] h3{opacity:.75}@media(max-width:520px){.grid{grid-template-columns:minmax(0,1fr)}}")
    JS_ART = r"""const root=document.getElementById('app'),A=root.dataset.auditor,$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const get=k=>{try{return localStorage.getItem(A+'.'+k)||''}catch(e){return ''}},put=(k,v)=>{try{localStorage.setItem(A+'.'+k,v)}catch(e){}};
$('#g').value=get('global');$('#g').oninput=e=>put('global',e.target.value);
$$('.t:not(.stub)').forEach(t=>{const id=t.dataset.id,n=$('.note',t),m=$('.mark',t);n.value=get(id+'.note');m.value=get(id+'.mark');n.oninput=()=>{put(id+'.note',n.value);f()};m.onchange=()=>{put(id+'.mark',m.value);f()}});
const F={half:$('#fh'),group:$('#fg'),user:$('#fu'),side:$('#fs'),mode:$('#fm'),src:$('#fr'),mark:$('#fk'),q:$('#fq'),err:$('#fe'),bad:$('#fb')};
function f(){let nt=0,nc=0,dn=0,mine=0;$$('.t').forEach(t=>{const st=t.classList.contains('stub'),id=t.dataset.id,mk=st?'':$('.mark',t).value,has=st?false:!!$('.note',t).value;if(t.dataset.half==='mine'){mine++;if(mk||has)dn++}
let ok=(!F.half.value||t.dataset.half===F.half.value)&&(!F.group.value||t.dataset.group===F.group.value)&&(!F.q.value||t.dataset.search.includes(F.q.value.toLowerCase()));
const k=F.mark.value;if(k==='none')ok=ok&&!mk&&!has;else if(k==='note')ok=ok&&has;else if(k)ok=ok&&mk===k;
let vis=st?1:0;$$('.c',t).forEach(c=>{const s=(!F.user.value||c.dataset.user===F.user.value)&&(!F.side.value||c.dataset.side===F.side.value)&&(!F.mode.value||c.dataset.mode===F.mode.value)&&(!F.src.value||c.dataset.src===F.src.value)&&(!F.err.checked||c.dataset.err==='1')&&(!F.bad.checked||c.dataset.bad==='1');c.hidden=!s;if(s)vis++});
$$('.g',t).forEach(g=>g.hidden=!$('.c:not([hidden])',g));t.hidden=!(ok&&vis);if(!t.hidden){nt++;nc+=vis}});$$('.gw').forEach(g=>g.hidden=!$('.t:not([hidden])',g));$('#cnt').textContent=nt+' tests · '+nc+' chats · reviewed '+dn+'/'+mine}
Object.values(F).forEach(x=>x.oninput=f);f();
$$('.ob').forEach(b=>b.onclick=()=>{const sc=b.closest('.t')||b.closest('.gw'),ds=$$('article.c:not([hidden]) .ck',sc),o=ds.some(d=>!d.open);ds.forEach(d=>d.open=o)});
$('#oa').onclick=()=>{const ds=$$('article.c:not([hidden]) .ck'),o=ds.some(d=>!d.open);ds.forEach(d=>d.open=o)};
$('#ex').onclick=()=>{let o='# Notes '+A+'\n\n'+(get('global')?get('global')+'\n\n':'');$$('.t').forEach(t=>{const id=t.dataset.id,n=get(id+'.note'),m=get(id+'.mark');if(n||m)o+='## '+id+' '+(m?'['+m+']':'')+'\n'+n+'\n\n'});
const b=$('#out');b.value=o;b.hidden=false;b.focus();b.select();try{navigator.clipboard.writeText(o).catch(()=>{})}catch(e){}};
document.addEventListener('error',e=>{const m=e.target;if(m&&(m.tagName==='VIDEO'||m.tagName==='AUDIO')&&!m.dataset.bad){m.dataset.bad=1;m.insertAdjacentHTML('afterend','<div class="aud">this '+m.tagName.toLowerCase()+' did not load</div>')}},true);"""
    def test_stub(tid):   # the other half of the tests, one line each: the full test is in the other batch (both halves in one page would be over the Artifact size limit)
        it = ITEMS.get(tid, {}); cs = by[tid]; gr = [c for c in cs if c.get("checklist") is not None and c["mode"] == "live"]; dn = sum(1 for c in gr if not any(x["st"] == "no" for x in c["checklist"]))
        return (f"<section class='t stub' data-id='{tid}' data-half='other' data-group='{esc(it.get('group', ''))}' data-search='{esc((tid + ' ' + it.get('title', '')).lower())}'>"
                f"<h3>{LABEL.get(tid, '')}{tid} · {esc(it.get('title', ''))} <small>{esc(it.get('group_name', ''))} · {len(cs)} chats" + (f" · {dn}/{len(gr)} complete" if gr else "") + " · in the other batch</small></h3></section>")
    def art_page(name, order, mine, other):
        PUB.clear(); HALF.clear(); HALF.update({t: ("mine" if t in mine else "other") for t in order}); LABEL.clear(); LABEL.update({t: f"<span class='lab'>{name}{i + 1}/{len(order)}</span> · " for i, t in enumerate(order)})
        mine_set = set(mine); nch = sum(len(by[t]) for t in mine); eff = 100 * sum(W[t] for t in mine) / tot
        MID = f"<div class='mid'>halfway · batch {name} ends here · batch {other} comes from the other end and stops at the same line</div>"
        out = []; cur = None
        for i, t in enumerate(order):
            g = ITEMS.get(t, {}).get("group", "?")
            if g != cur:
                if cur is not None: out.append("</div>")
                out.append(f"<div class='gw' data-group='{esc(g)}'><h2>{esc(g)} · {esc(ITEMS[t].get('group_name', ''))} <button class='ob'>checklists</button></h2>"); cur = g
            out.append(test_html(t) if t in mine_set else test_stub(t))
            if i + 1 == len(mine): out.append("</div>" + MID); cur = None
        if cur is not None: out.append("</div>")
        opt = lambda vals: "".join(f"<option value='{v}'>{v}</option>" for v in vals); gs = sorted({ITEMS.get(t, {}).get("group", "?") for t in order})
        bar = (f"<div id='bar'><select id='fh'><option value='mine' selected>my half</option><option value=''>all tests</option></select><select id='fg'><option value=''>type</option>{opt(gs)}</select><select id='fu'><option value=''>user</option>{opt(['happy', 'stupid', 'dumper'])}</select><select id='fs'><option value=''>build</option>{opt(['old', 'new'])}</select>"
               "<select id='fm'><option value=''>mode: any</option><option value='dry'>dry</option><option value='live'>live</option></select><select id='fr'><option value=''>source</option><option value='api'>api</option><option value='agent'>agent</option></select>"
               "<select id='fk'><option value=''>marked: any</option><option value='none'>unmarked</option><option value='ok'>ok</option><option value='issue'>issue</option><option value='note'>has note</option></select><label><input type='checkbox' id='fb'> not done</label><label><input type='checkbox' id='fe'> errors</label>"
               "<input id='fq' placeholder='search'><span id='cnt'></span><button id='oa'>open all checklists</button><button id='ex'>copy notes</button></div><textarea id='out' rows='8' hidden></textarea>")
        head = f"<h1>Test batch {name}</h1><p class='s'>{len(mine)} of {len(order)} tests are yours ({mine[0]} to {mine[-1]}), {nch} chats, {eff:.0f}% of the review effort. Order: {'top down' if name == 'A' else 'bottom up'}. Stop at the halfway line.</p>"
        return (f"<title>Test batch {name}</title>\n<meta name=\"claude:viewport-fit-sides\" content=\"cover\">\n<style>{CSS_ART}</style>\n<div id=\"app\" data-auditor=\"batch-{name.lower()}\">{head}\n{stats_html()}\n{bar}\n<textarea id=\"g\" rows=\"3\" placeholder=\"notes\"></textarea>\n{''.join(out)}\n</div>\n<script>{JS_ART}</script>\n"), nch, eff
    res = {}
    for name, order, mine, other in (("A", canon, TOP, "B"), ("B", canon[::-1], BOT[::-1], "A")):
        h, nch, eff = art_page(name, order, mine, other); p = f"{ART_OUT}/test-batch-{name.lower()}.html"; open(p, "w").write(h); res[name] = (len(mine), nch, eff)
        pd = f"{ART_OUT}/pub-{name.lower()}"; os.makedirs(pd + "/m", exist_ok=True)
        for f, rel in PUB.items():
            d = f"{pd}/{rel}"
            if not os.path.exists(d):
                try: os.link(f, d)
                except OSError: shutil.copy2(f, d)
        sz = [os.path.getsize(f"{pd}/{rel}") for rel in PUB.values()]; chunks = []; cur = 0; st = 1
        for k, b in enumerate(sz, 1):
            if cur + b > 40e6 or k - st >= 240: chunks.append((st, k - 1, cur)); st = k; cur = 0
            cur += b
        chunks.append((st, len(sz), cur))
        print(f"  page {name} plays {len(sz)} files, {sum(sz) / 1e6:.0f} MB in {pd}/m; publish chunks m/FIRST..LAST (MB): " + ", ".join(f"{a}-{z} ({b / 1e6:.0f})" for a, z, b in chunks), flush=True)
        media = sum(len(x) for x in re.findall(r"data:image/jpeg;base64,[A-Za-z0-9+/=]+", h))
        print(f"batch {name}: {len(mine)} tests mine ({mine[0]}..{mine[-1]}), {nch} chats, effort {eff:.0f}% · page {os.path.getsize(p) / 1e6:.1f} MB (embedded pictures {media / 1e6:.1f} MB)")
    exp = {(i, s, p) for i in ITEMS for s in ("old", "new") for p in ("happy", "stupid", "dumper")}; got = {(c["id"], c["side"], c["persona"]) for c in chats}; graded = {(c["id"], c["side"], c["persona"]) for c in chats if c.get("checklist") is not None}
    print(f"coverage: {len(ITEMS)} tests, {len(exp)} test x user x build cells, {len(exp & got)} with a finished chat, {len(exp & graded)} graded; tests with no chat: {sorted(set(ITEMS) - set(by))}; missing cells: {len(exp - got)}")
    sys.exit(0)
os.makedirs(OUT, exist_ok=True)
for a in ("auditor-1", "auditor-2"):
    open(f"{OUT}/audit-{a[-1]}.html", "w").write(page(a))
print(f"{len(tids)} tests, {len(chats)} chats ({dict(collections.Counter(c['label'] for c in chats))}); media: {dict(MEDIA_STATS)}; pages in {OUT}: " + ", ".join(f"audit-{i}.html {os.path.getsize(f'{OUT}/audit-{i}.html') // 1024} KB" for i in (1, 2)))
