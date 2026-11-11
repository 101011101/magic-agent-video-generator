"""Clusters the unmet checklist items of the graded live fleet chats (same symptom, same item or check kind) and writes fleet/why/clusters.json for why.mjs.
Usage: python3 why_clusters.py [--top 60] [--min 3]"""
import json, glob, os, sys, collections
sys.path.insert(0, os.path.dirname(__file__))
from why_common import ckey, cid, WHY_DIR
R = "/Users/ray/Coding/magic-agent-video-generator/V2/bench/v1/results/fleet/"
a = sys.argv[1:]; TOP = int(a[a.index("--top") + 1]) if "--top" in a else 60; MIN = int(a[a.index("--min") + 1]) if "--min" in a else 3
cl = collections.defaultdict(lambda: dict(chats=[], builds=collections.Counter(), personas=collections.Counter()))
for f in glob.glob(R + "*/*/grade.json"):
    d = os.path.dirname(f)
    if os.path.exists(d + "/invalid.json") or not os.path.exists(d + "/host.json"): continue
    g = json.load(open(f))
    if g.get("error") or "must" not in g: continue
    for c in g.get("checks") or []:
        if not c["pass"]: k = ckey(g["item"], c["name"], True); cl[k]["chats"].append(os.path.basename(d)); cl[k]["builds"][g["side"]] += 1; cl[k]["personas"][g["persona"]] += 1; cl[k].update(text=c["name"], got=c.get("got"), is_check=True, item=g["item"])
    for m in g.get("must") or []:
        if m["met"] == "no": k = ckey(g["item"], m["item"], False); cl[k]["chats"].append(os.path.basename(d)); cl[k]["builds"][g["side"]] += 1; cl[k]["personas"][g["persona"]] += 1; cl[k].update(text=m["item"], is_check=False, item=g["item"], why_graded=m.get("why"))
ranked = sorted(cl.items(), key=lambda kv: -len(kv[1]["chats"]))
out = []
for k, v in ranked:
    if len(v["chats"]) < MIN or len(out) >= TOP: continue
    out.append(dict(id=cid(k), key=k, symptom=v["text"], is_check=v["is_check"], item=v["item"], group=v["item"][0], n=len(v["chats"]), builds=dict(v["builds"]), personas=dict(v["personas"]), chats=v["chats"][:40], got=v.get("got"), graded_why=v.get("why_graded")))
os.makedirs(WHY_DIR, exist_ok=True); json.dump(out, open(WHY_DIR + "clusters.json", "w"), indent=1)
print(f"{len(cl)} distinct unmet items; {len(out)} clusters with at least {MIN} chats written (covering {sum(c['n'] for c in out)} of {sum(len(v['chats']) for v in cl.values())} unmet cases)")
