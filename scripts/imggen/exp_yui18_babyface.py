#!/usr/bin/env python3
"""
ユイ18歳「童顔巨乳・ノベルゲー(ギャルゲ/エロゲ原画)調」探索。アーティストタグ20種を同一シードで振る。
使い捨て。出力は image_gen/output/ に exp_yui18_<variant>_ で出る。
    python3 exp_yui18_babyface.py [seed]
"""
import random, sys, uuid
import gen_yui_anima as G

# 童顔巨乳ベース。reference: Elizabeth Bathory風 (童顔・長ツインテ・巨乳)。衣装はともしび世界のまま。
CHARACTER = (
    "young woman, baby face, cute round childish youthful face, large breasts, big breasts, "
    "curvy figure, slim waist, wide hips, crimson red hair, long hair, twin tails, side bangs, "
    "ahoge, big sparkling amber eyes, fang, cute playful smile, light mischievous air, hand on hip, "
    "dark grey traveler's hooded cape worn open, fitted deep teal tunic dress, brown leather work belt, "
    "cloth leggings, worn traveling boots, small brass oil lamp at hip"
)
NEGATIVE_EXTRA = "flat chest, small breasts, old face, mature face, wrinkles, short hair"

# ノベルゲー調を押す共通クオリティ。{artist} に各タグが入る。
QUALITY_FMT = "masterpiece, best quality, score_7, safe, {artist}visual novel cg, galge, soft anime illustration, warm flame lighting, detailed face, detailed eyes"

# 20名。先頭10=思いつき(VN/ギャルゲ/エロゲ原画)、後半10=ネット調査(BugBug人気エロゲンガー等)。
# Anima は danbooru系59,676アーティストを学習済み。タグは danbooru 表記・小文字・スペース区切り。
ARTISTS = {
    # --- 思いつき10 ---
    "tony_taka":      "@tony taka",
    "carnelian":      "@carnelian",
    "kobuichi":       "@kobuichi",
    "sayori":         "@sayori (neko works)",
    "nishimata_aoi":  "@nishimata aoi",
    "hinoue_itaru":   "@hinoue itaru",
    "na-ga":          "@na-ga",
    "ugetsu_hakua":   "@ugetsu hakua",
    "suzuhira_hiro":  "@suzuhira hiro",
    "kantoku":        "@kantoku",
    # --- ネット調査10 ---
    "bekkankou":      "@bekkankou",
    "muririn":        "@muririn",
    "komori_kei":     "@komori kei",
    "izumi_tsubasu":  "@izumi tsubasu",
    "sumeragi_kohaku":"@sumeragi kohaku",
    "komatsuzaki_rui":"@komatsuzaki rui",
    "nanao_naru":     "@nanao naru",
    "mitha":          "@mitha",
    "nardack":        "@nardack",
    "mibu_natsuki":   "@mibu natsuki",
}

W, H, STEPS, CFG = 832, 1216, 35, 4.0
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 2**53)
print(f"seed={SEED} / {len(ARTISTS)} variants\n")

for name, artist in ARTISTS.items():
    q = QUALITY_FMT.format(artist=f"{artist}, " if artist else "")
    positive = ", ".join([q, CHARACTER, G.COMMON["composition"], G.COMMON["scene"]])
    negative = ", ".join([G.COMMON["negative"], NEGATIVE_EXTRA])
    prefix = f"exp_yui18_{name}"
    wf = G.build_workflow(positive, negative, W, H, STEPS, CFG, "er_sde", "simple", 3.0, SEED, prefix)
    r = G.api_post("/api/prompt", {"prompt": wf, "client_id": str(uuid.uuid4())})
    if r.get("node_errors"):
        print(f"■ {name:18s} ERR {r['node_errors']}"); continue
    imgs = G.wait_done(r["prompt_id"])
    print(f"■ {name:18s} -> {[im['filename'] for im in (imgs or [])]}")
print("\n完了")
