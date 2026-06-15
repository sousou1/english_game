#!/usr/bin/env python3
"""
build_scene_gallery.py — out/scenes/ の生成物を scenes.json の定義(章・構図・登場キャラ)と
並べたレビュー用 HTML(out/scene_gallery.html) を作る。章ごとに並べる。

  python build_scene_gallery.py
人間レビュー用。採否はここでは行わない。
"""
from __future__ import annotations

import html
import json
from collections import OrderedDict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCENES = HERE / "scenes.json"
OUT_DIR = HERE / "out" / "scenes"
GALLERY = HERE / "out" / "scene_gallery.html"


def card(sc: dict) -> str:
    img = OUT_DIR / f"{sc['id']}.png"
    rel = img.relative_to(GALLERY.parent).as_posix() if img.exists() else None
    img_html = (
        f'<img src="{rel}" alt="{html.escape(sc["id"])}">'
        if rel
        else '<div class="missing">未生成</div>'
    )
    refs = ", ".join(sc.get("ref_chars", [])) or "—"
    pov = "POV" if sc.get("pov") else ""
    return f"""
    <div class="card">
      <div class="imgbox">{img_html}</div>
      <div class="meta">
        <h2>{html.escape(sc['id'])} <span class="pov">{pov}</span></h2>
        <p class="cap">{html.escape(sc.get('cap',''))}</p>
        <p class="en">{html.escape(sc.get('en',''))}</p>
        <p class="ref">登場: {html.escape(refs)} / 舞台: {html.escape(sc.get('stage',''))}</p>
      </div>
    </div>"""


def main() -> None:
    data = json.loads(SCENES.read_text(encoding="utf-8"))
    scenes = data["scenes"]

    groups: "OrderedDict[str, list]" = OrderedDict()
    for s in scenes:
        groups.setdefault(f"第{s.get('chapter','?')}章", []).append(s)

    sections = []
    for gname, gs in groups.items():
        cards = "".join(card(s) for s in gs)
        sections.append(f'<h2 class="group">{html.escape(gname)}</h2><div class="grid">{cards}</div>')

    page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>ともしび シーン挿絵 (gpt-image-2)</title>
<style>
  body {{ font-family: system-ui, sans-serif; background:#1a1714; color:#eee; margin:0; padding:24px; }}
  h1 {{ font-size:20px; }}
  .note {{ color:#bba; font-size:13px; margin-bottom:20px; max-width:900px; }}
  .group {{ font-size:17px; color:#fc9; border-bottom:1px solid #4a3c2c; padding-bottom:6px; margin:28px 0 14px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(440px,1fr)); gap:18px; }}
  .card {{ background:#262019; border-radius:10px; overflow:hidden; border:1px solid #3a3026; }}
  .imgbox {{ background:#000; text-align:center; }}
  .imgbox img {{ width:100%; height:auto; display:block; }}
  .missing {{ padding:80px 0; color:#a55; text-align:center; }}
  .meta {{ padding:12px; }}
  .meta h2 {{ font-size:15px; margin:0 0 4px; }}
  .pov {{ color:#9bd; font-size:11px; font-weight:normal; }}
  .cap {{ color:#dca; font-size:13px; margin:2px 0; }}
  .en {{ color:#bbb; font-size:11px; margin:4px 0; }}
  .ref {{ color:#888; font-size:11px; margin-top:6px; }}
</style></head><body>
<h1>『ともしび』シーン挿絵 — gpt-image-2 本生成 (キャラ ref＋世界観)</h1>
<p class="note">各シーンは確定キャラ立ち絵(out/cast/)を参照添付し、装飾品ブレ防止の lock を注入して生成しています。
POV シーンは主人公アキを映さない設計です。採否は人間レビュー。左右の入れ替わり等が出たカットは再生成してください。</p>
{''.join(sections)}
</body></html>"""
    GALLERY.write_text(page, encoding="utf-8")
    print(f"wrote: {GALLERY}")


if __name__ == "__main__":
    main()
