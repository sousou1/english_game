#!/usr/bin/env python3
"""
gen_world.py — world.json を読み、世界観イラスト(舞台・敵勢力)を 1カット1枚ずつ
gpt-image-2 で生成する。シーン挿絵の前段の「世界観確立画」を作るためのもの。

各カットのプロンプト =
    style.base + style.establishing_framing + label/desc + style.negative

世界観カットは人物なしの情景なので、参照画像(out/cast/)は添付しない
(= プロンプトのみで背景・世界を再構築する。ユーザー制約)。

生成物 -> out/world/<id>.png 。生成後 build_world_gallery.py で一覧 HTML を作る。

使い方:
  python gen_world.py                       # world.json の全カットを生成
  python gen_world.py --only w_nagi_village_day w_great_lamp_lit
  python gen_world.py --dry-run             # プロンプトのみ表示
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from gptimg import generate_image

HERE = Path(__file__).resolve().parent
WORLD = HERE / "world.json"
OUT = HERE / "out" / "world"


def build_prompt(style: dict, cut: dict) -> str:
    parts = [
        style["base"],
        style["establishing_framing"],
        f"Scene: {cut['label']}.",
        cut.get("desc", ""),
        style["negative"],
    ]
    return " ".join(p.strip() for p in parts if p and p.strip())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--only", nargs="*", default=None, help="生成する cut id")
    p.add_argument("--dry-run", action="store_true", help="プロンプトのみ表示")
    args = p.parse_args()

    data = json.loads(WORLD.read_text(encoding="utf-8"))
    style = data["style"]
    cuts = data["cuts"]
    if args.only:
        cuts = [c for c in cuts if c["id"] in set(args.only)]

    OUT.mkdir(parents=True, exist_ok=True)
    for cut in cuts:
        prompt = build_prompt(style, cut)
        out_path = OUT / f"{cut['id']}.png"
        size = cut.get("size", "1536x864")
        print(f"\n=== {cut['id']} ({cut['label']}) [{size}] ===")
        print(prompt)
        if args.dry_run:
            continue
        saved = generate_image(prompt, out_path, size=size)
        for s in saved:
            print(f"  saved: {s}")


if __name__ == "__main__":
    main()
