#!/usr/bin/env python3
"""
gen_restyle.py — 既存の立ち絵(out/cast/<id>.png)を、新ユイと同じ
「クリーンなアニメ調」に画風統一して作り直す。

各キャラ自身の現行立ち絵を参照(likeness/デザイン保持)に添付しつつ、
プロンプトで cast.json の容姿正典 + lock + 強いアニメ画風指定を与えて
ペインタリー/半リアルから脱却させる。出力は out/cast_restyle/<id>.png。
レビュー後に out/cast/ へ昇格する運用。

使い方:
  python gen_restyle.py --only gaku doudo
  python gen_restyle.py            # yui系以外の全キャラ
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from gptimg import generate_image

HERE = Path(__file__).resolve().parent
CAST = HERE / "cast.json"
CAST_OUT = HERE / "out" / "cast"
OUT = HERE / "out" / "cast_restyle"

YUI_DONE = {"yui", "yui_15", "yui_18"}

RESTYLE = (
    "Clean, soft, warm Japanese ANIME character illustration with smooth cel shading, "
    "gentle clean linework and bright appealing colors — the polished look of a modern "
    "mobile-game character sheet, matching a clean anime art style. "
    "NOT a dark semi-realistic painterly concept-art style, NOT photorealistic, "
    "NOT a heavy oil-painting render."
)
CREATURE_FRAMING = (
    "A single full-body creature reference, the beast shown clearly in full, "
    "simple soft plain background, even lighting, no human characters."
)
OBJECT_FRAMING = (
    "An intimate still-life, the object alone and centered, simple soft dark "
    "background, warm glow, no people."
)


def build_prompt(style: dict, ch: dict) -> str:
    t = ch.get("type")
    if t == "creature":
        framing = CREATURE_FRAMING
    elif t == "object_no_figure":
        framing = OBJECT_FRAMING
    else:
        framing = style["portrait_framing"]
    parts = [
        RESTYLE,
        framing,
        "Redraw THIS character (keep the same identity, face, hair, outfit and design "
        "as the reference image) cleanly in the anime style described above.",
        f"Character: {ch['name']} ({ch['role']}).",
        ch.get("appearance", ""),
        ch.get("outfit", ""),
        ch.get("equipment", ""),
        f"Consistency: {ch['lock']}" if ch.get("lock") else "",
        f"Color palette: {ch.get('palette', '')}." if ch.get("palette") else "",
        ch.get("negative_extra") or style["negative"],
    ]
    return " ".join(p.strip() for p in parts if p and p.strip())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--only", nargs="*", default=None)
    p.add_argument("--size", default="1024x1536")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    data = json.loads(CAST.read_text(encoding="utf-8"))
    style = data["style"]
    chars = data["characters"]
    if args.only:
        chars = [c for c in chars if c["id"] in set(args.only)]
    else:
        chars = [c for c in chars if c["id"] not in YUI_DONE]

    OUT.mkdir(parents=True, exist_ok=True)
    for ch in chars:
        prompt = build_prompt(style, ch)
        ref = CAST_OUT / f"{ch['id']}.png"
        out_path = OUT / f"{ch['id']}.png"
        print(f"\n=== {ch['id']} ({ch['name']}) ref={ref.name if ref.is_file() else 'NONE'} ===")
        print(prompt)
        if args.dry_run:
            continue
        refs = [str(ref)] if ref.is_file() else None
        for s in generate_image(prompt, out_path, size=args.size, refs=refs):
            print(f"  saved: {s}")


if __name__ == "__main__":
    main()
