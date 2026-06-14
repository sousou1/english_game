#!/usr/bin/env python3
"""
build_world_gallery.py — out/world/ の生成物を world.json の定義と並べた
レビュー用 HTML(out/world_gallery.html) を作る。グループ(舞台/敵勢力)別に並べる。

  python build_world_gallery.py
人間レビュー用。採否はここでは行わない(人間が画像を見て決める)。
"""
from __future__ import annotations

import html
import json
from collections import OrderedDict
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORLD = HERE / "world.json"
OUT_DIR = HERE / "out" / "world"
GALLERY = HERE / "out" / "world_gallery.html"


def card(cut: dict) -> str:
    img = OUT_DIR / f"{cut['id']}.png"
    rel = img.relative_to(GALLERY.parent).as_posix() if img.exists() else None
    img_html = (
        f'<img src="{rel}" alt="{html.escape(cut["id"])}">'
        if rel
        else '<div class="missing">未生成</div>'
    )
    return f"""
    <div class="card">
      <div class="imgbox">{img_html}</div>
      <div class="meta">
        <h2>{html.escape(cut['label'])} <span class="id">{html.escape(cut['id'])}</span></h2>
        <p class="size">{html.escape(cut.get('size',''))}</p>
        <p class="desc">{html.escape(cut.get('desc',''))}</p>
      </div>
    </div>"""


def main() -> None:
    data = json.loads(WORLD.read_text(encoding="utf-8"))
    cuts = data["cuts"]

    groups: "OrderedDict[str, list]" = OrderedDict()
    for c in cuts:
        groups.setdefault(c.get("group", "その他"), []).append(c)

    sections = []
    for gname, gcuts in groups.items():
        cards = "".join(card(c) for c in gcuts)
        sections.append(
            f'<h2 class="group">{html.escape(gname)}</h2><div class="grid">{cards}</div>'
        )

    page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>ともしび 世界観イラスト (gpt-image-2)</title>
<style>
  body {{ font-family: system-ui, sans-serif; background:#1a1714; color:#eee; margin:0; padding:24px; }}
  h1 {{ font-size:20px; }}
  .note {{ color:#bba; font-size:13px; margin-bottom:20px; max-width:880px; }}
  .group {{ font-size:17px; color:#fc9; border-bottom:1px solid #4a3c2c; padding-bottom:6px; margin:28px 0 14px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); gap:18px; }}
  .card {{ background:#262019; border-radius:10px; overflow:hidden; border:1px solid #3a3026; }}
  .imgbox {{ background:#000; text-align:center; }}
  .imgbox img {{ width:100%; height:auto; display:block; }}
  .missing {{ padding:80px 0; color:#a55; }}
  .meta {{ padding:12px; }}
  .meta h2 {{ font-size:15px; margin:0 0 4px; }}
  .id {{ color:#c9a; font-size:11px; font-weight:normal; }}
  .size {{ color:#9bd; font-size:11px; margin:2px 0; }}
  .desc {{ color:#cbb; font-size:12px; margin:4px 0; }}
</style></head><body>
<h1>『ともしび』世界観イラスト — gpt-image-2 案 (舞台・敵勢力)</h1>
<p class="note">シーン挿絵の前段の「世界観確立画」です。村・大灯・街道・隊商・交易街などの舞台と、翳り(灰)・敵勢力の雰囲気を確立します。
採否は人間レビュー。OKのカットを次フェーズでシーン挿絵の世界観土台(構図・色・建築の参照)にします。人物はあえて入れていません(情景確立が目的)。</p>
{''.join(sections)}
</body></html>"""
    GALLERY.write_text(page, encoding="utf-8")
    print(f"wrote: {GALLERY}")


if __name__ == "__main__":
    main()
