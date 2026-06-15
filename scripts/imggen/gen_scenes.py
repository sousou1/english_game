#!/usr/bin/env python3
"""
gen_scenes.py — scenes.json を読み、各シーン挿絵を gpt-image-2 で本生成する。

設計:
  - 舞台は scenes.json の stages[scene.stage] (+ stage_extra) で背景を確定。
  - 構図は scene.en (英語の構図プロンプト) で指定。
  - 登場キャラ ref_chars の確定立ち絵 out/cast/<id>.png を images.edit に参照添付
    (最大4枚)。同一人物・同一絵柄を担保する。
  - 装飾品のブレ防止ガード: cast.json の scene_lock_preamble + 各キャラの lock を
    必ずプロンプトへ注入する (参照画像だけでは向き・構図で装飾品がブレるため)。
  - POV ルール: pov=true のシーンは主人公アキの顔・全身を映さない
    (手＋カンテラ / 肩越し / 画面外)。POV_TEXT を注入。

生成物 -> out/scenes/<id>.png 。build_scene_gallery.py で一覧 HTML を作る。

使い方:
  python gen_scenes.py                       # 全シーン
  python gen_scenes.py --only c01_010 c02_040
  python gen_scenes.py --chapter 1
  python gen_scenes.py --n 2                  # 1シーンにつき複数案 (左右選別用)
  python gen_scenes.py --dry-run
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from gptimg import generate_image

HERE = Path(__file__).resolve().parent
SCENES = HERE / "scenes.json"
CAST = HERE / "cast.json"
CAST_OUT = HERE / "out" / "cast"
OUT = HERE / "out" / "scenes"

POV_TEXT = (
    "This is a first-person / over-the-shoulder shot of the UNSEEN protagonist Aki: "
    "show at most his own hand and forearm holding the old brass kantera lantern, or "
    "the back of his head and shoulder in the foreground. NEVER show his face or his "
    "full body; he is the viewer, not a depicted character."
)

# シーンは立ち絵(クリーンなアニメ調)と画風を揃えるため、cast.json の style.base
# (＝"painterly"を含み敵モチーフだと半リアルに流れる)は使わず、専用のクリーン指定を使う。
SCENE_STYLE = (
    "Soft, clean, warm Japanese ANIME illustration with smooth cel shading, gentle clean "
    "linework and bright appealing colors — modern anime key-visual / mobile-game quality. "
    "A pre-modern medieval mountain-valley world lit by warm flames; warm amber lamplight "
    "against cool dusk tones."
)

SCENE_NEGATIVE = (
    "Keep it wholesome and modestly dressed. Render everything in the clean anime style above. "
    "Avoid: a dark semi-realistic painterly concept-art style, photorealism, a heavy oil-painting "
    "render, intricate realistic textures, text, letters, captions, watermark, signature, modern "
    "clothes, zippers, buttons, modern or sci-fi elements, cars, power lines, guns, a Japanese "
    "gassho-style village."
)


def build(scene: dict, stages: dict, style: dict, preamble: str, by_id: dict):
    """(prompt, refs) を返す。"""
    parts = [
        SCENE_STYLE,
        "A single story scene illustration, cinematic composition, warm storybook lighting.",
    ]
    # 舞台
    parts.append("Setting: " + stages[scene["stage"]])
    for ex in scene.get("stage_extra", []):
        parts.append(stages[ex])
    # 構図
    parts.append("Scene: " + scene.get("en", scene.get("cap", "")))
    # POV
    if scene.get("pov"):
        parts.append(POV_TEXT)
    # キャラ ref + lock ガード
    refs: list[str] = []
    locks: list[str] = []
    for cid in scene.get("ref_chars", []):
        ch = by_id.get(cid)
        if not ch:
            continue
        img = CAST_OUT / f"{cid}.png"
        if img.is_file():
            refs.append(str(img))
        if ch.get("lock"):
            locks.append(f"{ch['name']} — {ch['lock']}")
    if locks:
        parts.append(preamble + " " + "  ".join(locks))
    parts.append(SCENE_NEGATIVE)
    return " ".join(p.strip() for p in parts if p and p.strip()), refs[:4]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--only", nargs="*", default=None, help="生成する scene id")
    p.add_argument("--chapter", type=int, default=None, help="この章だけ生成")
    p.add_argument("--n", type=int, default=1, help="1シーンの案数")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    sdata = json.loads(SCENES.read_text(encoding="utf-8"))
    cdata = json.loads(CAST.read_text(encoding="utf-8"))
    stages = sdata["stages"]
    scenes = sdata["scenes"]
    style = cdata["style"]
    preamble = cdata["scene_lock_preamble"]
    by_id = {c["id"]: c for c in cdata["characters"]}

    if args.only:
        scenes = [s for s in scenes if s["id"] in set(args.only)]
    if args.chapter is not None:
        scenes = [s for s in scenes if s.get("chapter") == args.chapter]

    OUT.mkdir(parents=True, exist_ok=True)
    for sc in scenes:
        prompt, refs = build(sc, stages, style, preamble, by_id)
        out_path = OUT / f"{sc['id']}.png"
        print(f"\n=== {sc['id']} [{sc.get('size')}] pov={sc.get('pov')} refs={[Path(r).stem for r in refs]} ===")
        print(prompt)
        if args.dry_run:
            continue
        saved = generate_image(
            prompt, out_path, size=sc.get("size", "1536x864"), n=args.n,
            refs=refs or None,
        )
        for s in saved:
            print(f"  saved: {s}")


if __name__ == "__main__":
    main()
