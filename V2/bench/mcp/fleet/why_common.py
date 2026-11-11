"""Shared by why_clusters.py and audit_pages.py: how an unmet checklist item is keyed into a cluster (the same symptom across chats), and where the why-chains live."""
import re, hashlib
WHY_DIR = "/Users/ray/Coding/magic-agent-video-generator/V2/bench/v1/results/fleet/why/"
KINDS = [("aspect", r"^aspect "), ("length", r"^about \d"), ("sound", r"^sound present"), ("silent", r"^silent as asked"), ("black", r"^no black frames"), ("made", r"^something was made"),
         ("kind", r"^an? (image|images|video|audio|text) was made"), ("outputs", r"^\d+ outputs"), ("backs", r"^a file backs")]
def check_kind(name):
    for k, rx in KINDS:
        if re.search(rx, name): return k
    return None
def ckey(item, text, is_check):
    """the cluster of an unmet item: deterministic checks by (kind, group), must-haves by (item, text)"""
    if is_check:
        k = check_kind(text)
        return f"check:{k or text[:30]}:{item[0]}"
    return f"must:{item}:{text.strip()}"
def cid(key): return hashlib.md5(key.encode()).hexdigest()[:10]
