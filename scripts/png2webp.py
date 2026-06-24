#!/usr/bin/env python3
# 挿絵PNG(scripts/imggen/out/scenes/<id>.png) を assets/img/scene_<id>.webp へ変換。
# ch1 webp と同等(長辺768・quality82)。章追加のたび再利用する。
# 使い方: python3 scripts/png2webp.py c02_010 c02_040 ...   (引数なしなら out/scenes の c02_*.png 全部)
import sys, glob, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "imggen", "out", "scenes")
DST = os.path.join(ROOT, "assets", "img")
LONG_EDGE = 768

ids = sys.argv[1:]
if not ids:
    ids = [os.path.splitext(os.path.basename(p))[0] for p in sorted(glob.glob(os.path.join(SRC, "c02_*.png")))]

for sid in ids:
    src = os.path.join(SRC, sid + ".png")
    if not os.path.exists(src):
        print(f"skip (no src): {sid}")
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    scale = LONG_EDGE / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out = os.path.join(DST, f"scene_{sid}.webp")
    im.save(out, "WEBP", quality=82, method=6)
    print(f"{sid}: {w}x{h} -> {im.size} {os.path.getsize(out)//1024}KB  {out}")
