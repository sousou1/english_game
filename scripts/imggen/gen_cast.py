#!/usr/bin/env python3
"""
gen_cast.py — cast.json を読み、登場人物を 1人1枚ずつ gpt-image-2 で生成する。

各キャラの立ち絵プロンプト =
    style.base + style.portrait_framing + appearance + outfit + equipment
    + (character.negative_extra or style.negative)

生成物 -> out/cast/<id>.png 。生成後 build_gallery.py で一覧 HTML を作る。

使い方:
  python gen_cast.py                 # cast.json の全キャラを生成
  python gen_cast.py --only yui gaku # 一部だけ
  python gen_cast.py --ref           # 既存 Anima 参照画像(ref_existing)を likeness として添付
  python gen_cast.py --size 1024x1536
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from gptimg import generate_image

HERE = Path(__file__).resolve().parent
CAST = HERE / "cast.json"
OUT = HERE / "out" / "cast"


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
        style["base"],
        framing,
        f"Character: {ch['name']} ({ch['role']}).",
        ch.get("appearance", ""),
        ch.get("outfit", ""),
        ch.get("equipment", ""),
        f"Color palette: {ch.get('palette', '')}." if ch.get("palette") else "",
        ch.get("negative_extra") or style["negative"],
    ]
    return " ".join(p.strip() for p in parts if p and p.strip())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--only", nargs="*", default=None, help="生成する character id")
    p.add_argument("--ref", action="store_true", help="ref_existing を参照添付して生成")
    p.add_argument("--size", default="1024x1536")
    p.add_argument("--dry-run", action="store_true", help="プロンプトのみ表示")
    args = p.parse_args()

    data = json.loads(CAST.read_text(encoding="utf-8"))
    style = data["style"]
    chars = data["characters"]
    if args.only:
        chars = [c for c in chars if c["id"] in set(args.only)]

    OUT.mkdir(parents=True, exist_ok=True)
    for ch in chars:
        prompt = build_prompt(style, ch)
        out_path = OUT / f"{ch['id']}.png"
        print(f"\n=== {ch['id']} ({ch['name']}) ===")
        print(prompt)
        if args.dry_run:
            continue
        refs = None
        if args.ref and ch.get("ref_existing"):
            refs = [r for r in ch["ref_existing"] if Path(r).is_file()]
            if refs:
                print(f"  refs: {refs}")
        saved = generate_image(prompt, out_path, size=args.size, refs=refs)
        for s in saved:
            print(f"  saved: {s}")


if __name__ == "__main__":
    main()
