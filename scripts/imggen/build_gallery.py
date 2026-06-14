#!/usr/bin/env python3
"""
build_gallery.py — out/cast/ の生成物を cast.json の定義と並べたレビュー用 HTML を作る。

  python build_gallery.py            # out/cast_gallery.html を生成
人間レビュー用。採否はここでは行わない(人間が画像を見て決める)。
"""
from __future__ import annotations

import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
CAST = HERE / "cast.json"
OUT_DIR = HERE / "out" / "cast"
GALLERY = HERE / "out" / "cast_gallery.html"


def main() -> None:
    data = json.loads(CAST.read_text(encoding="utf-8"))
    chars = data["characters"]

    cards = []
    for ch in chars:
        img = OUT_DIR / f"{ch['id']}.png"
        rel = img.relative_to(GALLERY.parent).as_posix() if img.exists() else None
        img_html = (
            f'<img src="{rel}" alt="{html.escape(ch["id"])}">'
            if rel
            else '<div class="missing">未生成</div>'
        )
        ref = ", ".join(ch.get("ref_existing", [])) or "—"
        cards.append(f"""
        <div class="card">
          <div class="imgbox">{img_html}</div>
          <div class="meta">
            <h2>{html.escape(ch['name'])} <span class="id">{html.escape(ch['id'])}</span></h2>
            <p class="role">{html.escape(ch.get('role',''))}</p>
            <p class="policy">表示方針: {html.escape(ch.get('show_policy',''))}</p>
            <p class="desc">{html.escape(ch.get('appearance',''))}</p>
            <p class="outfit">{html.escape(ch.get('outfit',''))}</p>
            <p class="ref">旧Anima参照: {html.escape(ref)}</p>
          </div>
        </div>""")

    page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>ともしび キャスト (gpt-image-2)</title>
<style>
  body {{ font-family: system-ui, sans-serif; background:#1a1714; color:#eee; margin:0; padding:24px; }}
  h1 {{ font-size:20px; }}
  .note {{ color:#bba; font-size:13px; margin-bottom:20px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:18px; }}
  .card {{ background:#262019; border-radius:10px; overflow:hidden; border:1px solid #3a3026; }}
  .imgbox {{ background:#000; text-align:center; }}
  .imgbox img {{ width:100%; height:auto; display:block; }}
  .missing {{ padding:80px 0; color:#a55; }}
  .meta {{ padding:12px; }}
  .meta h2 {{ font-size:16px; margin:0 0 4px; }}
  .id {{ color:#c9a; font-size:12px; font-weight:normal; }}
  .role {{ color:#dca; font-size:13px; margin:2px 0; }}
  .policy {{ color:#9bd; font-size:12px; margin:2px 0; }}
  .desc, .outfit {{ color:#cbb; font-size:12px; margin:4px 0; }}
  .ref {{ color:#888; font-size:11px; margin-top:6px; word-break:break-all; }}
</style></head><body>
<h1>『ともしび』登場人物 — gpt-image-2 キャスト案 (各1枚)</h1>
<p class="note">採否は人間レビュー。各画像が cast.json の容姿・色・装備の正典と合っているか確認してください。OKのものは以降シーン挿絵の参照画像(ref)になります。</p>
<div class="grid">{''.join(cards)}</div>
</body></html>"""
    GALLERY.write_text(page, encoding="utf-8")
    print(f"wrote: {GALLERY}")


if __name__ == "__main__":
    main()
