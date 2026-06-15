#!/usr/bin/env python3
"""
『ともしび』ヒロイン ユイ を Anima (CircleStone Labs) で生成する自己完結スクリプト。

▼使い方 (image_gen の ComfyUI が立っている前提: docker compose up -d / http://localhost:8188)
    python3 gen_yui_anima.py                  # 3エントリ(12-13/15/18歳)を各1枚
    python3 gen_yui_anima.py --only yui_18     # 1エントリだけ
    python3 gen_yui_anima.py --count 4         # 各エントリ4枚
    python3 gen_yui_anima.py --seed 12345      # シード固定
    python3 gen_yui_anima.py --size 832x1216   # 縦長

▼プロンプトを直したいとき
    下の PROMPTS だけ書き換えれば良い。Anima のタグ規則:
      - quality は "masterpiece, best quality, score_7, safe" を先頭に置く
      - タグは小文字・スペース区切り (score_X 系のみアンダースコア可)
      - アーティスト指定は "@artist_name" のように "@" 必須
      - 文章とタグの混在可。自然言語も効く
    元の自然言語定義は english_game/scripts/imggen/cast.json の yui / yui_15 / yui_18。

生成画像は image_gen/output/ (= /home/tamura/image_gen_data/output) に出る。
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.request
import uuid

# ─────────────────────────────────────────────────────────────
# 採用シード (out/cast/ に反映済みの当たり。再現: --only <id> --seed <seed> --count 1)
#   yui     : 8728725525556916   (12-13歳, 絵本タッチで18と地続き)
#   yui_15  : 1463726859887648   (15歳, 細身スタイル+巨乳)
#   yui_18  : 6182738615312404   (18歳, 大人体型+巨乳, low ponytail)
# ─────────────────────────────────────────────────────────────
# ここを書き換えるだけで生成内容が変わる
# ─────────────────────────────────────────────────────────────

# 全エントリ共通。cast.json の style.base / portrait_framing をタグ寄りに翻案。
COMMON = {
    "quality": "masterpiece, best quality, score_7, safe, soft painterly anime illustration, fantasy storybook, warm amber flame lighting, detailed face, detailed eyes",
    "composition": "1girl, solo, full body, standing, relaxed neutral pose, facing viewer, looking at viewer, clear view of face and outfit",
    "scene": "simple soft warm plain background, even soft lighting, warm amber lamplight, cool dusk tones",
    # 全エントリ共通で弾くもの。各エントリの negative とマージされる。
    "negative": ("worst quality, low quality, score_1, score_2, score_3, artist name, watermark, "
                 "patreon logo, blurry, jpeg artifacts, bad anatomy, bad hands, extra limbs, deformed, "
                 "text, letters, captions, signature, multiple girls, 2girls, modern clothes, zipper, "
                 "buttons, sci-fi, skyscraper, concrete, steel, glass building, gun, photorealism, "
                 "blonde hair, long blonde hair, necklace, earrings, jewelry, hair ornament, gloves, scarf"),
}

PROMPTS = {
    # 第1章・幼少期。childish round face / short crimson hair / 二つの低いサイドテール / 八重歯
    "yui": {
        "character": ("petite young girl, child, childish round face, crimson red hair, short messy hair, "
                      "ahoge, low twintails, two small side tails, blunt bangs, big amber eyes, fang, "
                      "confident cheeky grin, dark grey short hooded cape, deep teal sleeveless tunic dress, "
                      "knee length dress, brown leather work belt, cloth leggings, worn brown leather boots, "
                      "small brass oil lamp on left hip"),
        "negative": "long hair, high twintails, long twintails, single side tail, ponytail, large breasts, mature",
    },
    # 15歳・童→大人の中間。still-youthful face / short-to-medium hair
    "yui_15": {
        "character": ("slim teenage girl, growing up, tall slender figure, long legs, slim waist, youthful face, big breasts, "
                      "crimson red hair, medium messy hair, ahoge, low twintails, two side tails, blunt bangs, "
                      "big amber eyes, fang, confident cheeky grin, dark grey short hooded cape, "
                      "deep teal sleeveless tunic dress, knee length dress, brown leather work belt, "
                      "cloth leggings, worn brown leather boots, small brass oil lamp on left hip"),
        "negative": "chibi, deformed proportions, big head, short, child body, high twintails, long twintails, single side tail, old face",
    },
    # 18歳・成長後。long hair low ponytail / 落ち着いた可愛い大人 / hand on hip
    "yui_18": {
        "character": ("young woman, mature female, tall slender figure, long legs, slim waist, large breasts, big breasts, "
                      "cute charming youthful face, crimson red hair, long hair, low ponytail, side bangs, "
                      "ahoge, big sparkling amber eyes, fang, cute playful smile, light mischievous air, "
                      "hand on hip, dark grey traveler's hooded cape worn open, fitted deep teal tunic dress, "
                      "brown leather work belt, cloth leggings, worn traveling boots, small brass oil lamp at hip"),
        "negative": "child, loli, flat chest, short hair, twintails, two side tails, old face, wrinkles",
    },
}

# ─────────────────────────────────────────────────────────────
# 以降は comfyui_anima.py と同じ生成ロジック (基本いじらない)
# ─────────────────────────────────────────────────────────────

URL = os.environ.get("COMFYUI_URL", "http://localhost:8188")

DEFAULTS = {
    "model": "anima-base-v1.0.safetensors",
    "text_encoder": "qwen_3_06b_base.safetensors",
    "vae": "qwen_image_vae.safetensors",
    "width": 832,
    "height": 1216,   # 全身立ち絵なので縦長を既定に
    "steps": 35,
    "cfg": 4.0,
    "sampler": "er_sde",
    "scheduler": "simple",
    "shift": 3.0,
}

SYSTEM_PREFIX = "You are an assistant designed to generate anime images based on textual prompts. <Prompt Start>\n"


def api_get(path):
    return json.loads(urllib.request.urlopen(f"{URL}{path}").read())


def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{URL}{path}", data=body, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())


def wait_done(prompt_id, timeout=600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = api_get(f"/api/history/{prompt_id}")
            if prompt_id in h:
                for out in h[prompt_id].get("outputs", {}).values():
                    if "images" in out:
                        return out["images"]
                return []
        except Exception:
            pass
        time.sleep(2)
    return None


def build_positive(p):
    parts = [COMMON["quality"], p["character"], COMMON["composition"], COMMON["scene"]]
    return ", ".join(s.strip().rstrip(",") for s in parts if s.strip())


def build_negative(p):
    parts = [COMMON["negative"], p.get("negative", "")]
    return ", ".join(s.strip().rstrip(",") for s in parts if s.strip())


def build_workflow(positive, negative, w, h, steps, cfg, sampler, scheduler, shift, seed, prefix):
    positive_full = SYSTEM_PREFIX + positive
    negative_full = SYSTEM_PREFIX + negative
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": DEFAULTS["model"], "weight_dtype": "default"}},
        "2": {"class_type": "ModelSamplingAuraFlow", "inputs": {"shift": shift, "model": ["1", 0]}},
        "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": DEFAULTS["text_encoder"], "type": "stable_diffusion", "device": "default"}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": DEFAULTS["vae"]}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": positive_full, "clip": ["3", 0]}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_full, "clip": ["3", 0]}},
        "7": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "8": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": sampler, "scheduler": scheduler,
            "denoise": 1.0, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0]}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["4", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["9", 0]}},
    }


def main():
    pa = argparse.ArgumentParser(description="ユイ(ともしび) Anima 生成")
    pa.add_argument("--only", choices=list(PROMPTS), help="このエントリだけ生成 (省略時は全部)")
    pa.add_argument("--size", default=None, help="解像度 WxH (例: 832x1216)")
    pa.add_argument("--steps", type=int, default=None)
    pa.add_argument("--cfg", type=float, default=None)
    pa.add_argument("--sampler", default=None)
    pa.add_argument("--scheduler", default=None)
    pa.add_argument("--shift", type=float, default=None)
    pa.add_argument("--seed", type=int, default=None, help="固定シード (-1/省略でランダム)")
    pa.add_argument("--count", type=int, default=1, help="各エントリの生成枚数")
    args = pa.parse_args()

    steps = args.steps or DEFAULTS["steps"]
    cfg = args.cfg or DEFAULTS["cfg"]
    sampler = args.sampler or DEFAULTS["sampler"]
    scheduler = args.scheduler or DEFAULTS["scheduler"]
    shift = args.shift if args.shift is not None else DEFAULTS["shift"]
    if args.size:
        w, h = (int(x) for x in args.size.split("x"))
    else:
        w, h = DEFAULTS["width"], DEFAULTS["height"]

    targets = [args.only] if args.only else list(PROMPTS)

    print("=" * 60)
    print(f"  Anima | {DEFAULTS['model']}")
    print(f"  {w}x{h} | {steps}step | cfg {cfg} | {sampler}/{scheduler} | shift {shift}")
    print(f"  Targets: {', '.join(targets)} | Count: {args.count}")
    print("=" * 60)

    for key in targets:
        p = PROMPTS[key]
        positive = build_positive(p)
        negative = build_negative(p)
        prefix = f"tomoshibi_{key}_anima"
        print(f"\n■ {key}")
        print(f"  + {positive[:110]}...")

        for i in range(args.count):
            seed = args.seed if (args.seed is not None and args.seed >= 0) else random.randint(0, 2**53)
            if args.seed is not None and args.seed >= 0 and args.count > 1:
                seed = args.seed + i
            print(f"  [{i+1}/{args.count}] seed={seed} ...", end=" ", flush=True)

            wf = build_workflow(positive, negative, w, h, steps, cfg, sampler, scheduler, shift, seed, prefix)
            try:
                result = api_post("/api/prompt", {"prompt": wf, "client_id": str(uuid.uuid4())})
            except Exception as e:
                print(f"ERROR: ComfyUIに接続できません ({e})")
                print("  → image_gen で docker compose up -d してください")
                sys.exit(1)

            if result.get("node_errors"):
                print(f"ERROR: {json.dumps(result['node_errors'], ensure_ascii=False)}")
                continue

            imgs = wait_done(result["prompt_id"])
            if imgs is None:
                print("TIMEOUT")
            elif not imgs:
                print("Done (no output)")
            else:
                for im in imgs:
                    print(f"OK -> output/{im['filename']}")

    print("\n完了!")


if __name__ == "__main__":
    main()
