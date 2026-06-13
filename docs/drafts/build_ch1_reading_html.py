#!/usr/bin/env python3
# docs/drafts/ch1.md を「ノベルゲーム風に能動的に読める」自己完結HTMLに変換する。
# 出力: docs/drafts/ch1_reading.html
# 機能:
#  - 冒頭で主人公名を任意入力(デフォルト「アキ」)。本文/話者ラベルの「アキ」を置換。
#  - 1シーンずつ進行。各シーン末に「行動」選択肢(ch1_actions.json)を表示し、押すと次へ。
#    温度3択シーンは3ボタン(どれでも同一の次シーンへ合流=canon)。
#  - 本文を主役に台詞/地の文/カンテラの声(別色)を描き分け。演出ノート/挿絵スロットはトグルで表示。
import re, html, json, sys, os

HERE = os.path.dirname(__file__)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "ch1.md")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "ch1_reading.html")
ACTIONS = json.load(open(os.path.join(HERE, "ch1_actions.json"), encoding="utf-8"))

lines = open(SRC, encoding="utf-8").read().splitlines()
ILLUST_SCENES = {"c01_010", "c01_040", "c01_060", "c01_140", "c01_180"}

# --- 挿絵の採用カット（2026-06-14 claude vision 選定 / 最終可否は人間レビュー）------------------
# 候補画像は ch1_illust_assets/il_<sid>_<seed>_0.png（生成済み26枚を同梱）。
# rec=推奨1案のシード, cand=全候補シード（人間が差し替えられるよう全併記）。
# 整合チェック5観点（①大灯の近代タワー化 ②主人公の顔/全身露出 ③年齢12-13からのズレ
# ④画風崩れ ⑤灰→雪化け）で逸脱ゼロを確認済み。各seed23が整合タグ最多のため推奨。
ASSET_DIR = "ch1_illust_assets"
ILLUST = {
    "c01_010": {"rec": 23, "cand": [7, 11, 23, 31],
                "cap": "屋根の上で振り返るユイ（見た目12〜13歳）と眼下の祭り・谷縁の大灯（石積み＋木組みの古い灯台）"},
    "c01_040": {"rec": 23, "cand": [7, 11, 23, 31],
                "cap": "一人称POV：差し出したアキの手とカンテラ／放射状の光と薙がれる灰の靄・奥にユイ"},
    "c01_060": {"rec": 23, "cand": [7, 11, 23, 31],
                "cap": "灰の靄から浮かぶ灰狼の影（喉に灰）／手前は立ちすくむ村人の背・主人公は映さない"},
    "c01_140": {"rec": 23, "cand": [7, 11, 23, 31],
                "cap": "ボス灰狼（喉に灰の亀裂）と、手前にカンテラを構える腕（顔は映さない）の対峙"},
    "c01_180": {"rec": 23, "cand": [7, 11, 23, 31],
                "cap": "広い星空の下、街道を行くユイの小さな後ろ姿と遠くの街のあかり・カンテラの一点の暖色"},
}

scenes, quests, callouts, intro_lines = [], [], [], []
cur, mode, note_label = None, None, None

def flush():
    global cur
    if cur is not None:
        scenes.append(cur); cur = None

i = 0
while i < len(lines):
    ln = lines[i]
    m_q = re.match(r"^## クエスト\s+(.*)", ln)
    m_s = re.match(r"^### (c01_\d+)\s*(.*)$", ln)
    m_note = re.match(r"^\*\*(本文|演出|挿絵概要|学習接続|分岐/フラグ)\*\*\s*[:：]?\s*(.*)$", ln)
    m_call = re.match(r"^>\s*▶\s*(.*)$", ln)
    if m_q:
        flush(); quests.append((len(scenes), m_q.group(1).strip())); mode = None; i += 1; continue
    if m_s:
        flush(); sid = m_s.group(1)
        title = m_s.group(2).replace("★挿絵", "").strip()
        cur = {"id": sid, "title": title,
               "illust": ("★挿絵" in m_s.group(2)) or (sid in ILLUST_SCENES),
               "body": [], "notes": {}}
        mode = None; i += 1; continue
    if m_call:
        txt = m_call.group(1).strip(); j = i + 1
        while j < len(lines) and re.match(r"^>\s+", lines[j]) and not re.match(r"^>\s*▶", lines[j]):
            txt += " " + re.sub(r"^>\s+", "", lines[j]).strip(); j += 1
        callouts.append((len(scenes) - 1, txt)); i = j; continue
    if m_note and cur is not None:
        label = m_note.group(1)
        if label == "本文":
            mode = "body"
        else:
            mode = "note"; note_label = label
            cur["notes"][label] = m_note.group(2).strip()
        i += 1; continue
    if cur is not None and mode == "body" and ln.startswith(">"):
        text = re.sub(r"^>\s?", "", ln).rstrip()
        if text:
            m_sp = re.match(r"^([^「」]{1,8})「(.*)」\s*$", text)
            if m_sp:
                sp = m_sp.group(1)
                cur["body"].append(("voice" if sp == "声" else "dialogue", sp, m_sp.group(2)))
            else:
                cur["body"].append(("narration", "", text))
        i += 1; continue
    if cur is not None and mode == "note":
        if ln.strip() == "" or ln.startswith("#"):
            mode = None
        else:
            cur["notes"][note_label] = (cur["notes"].get(note_label, "") + " " + ln.strip()).strip()
        i += 1; continue
    if not quests and cur is None:
        intro_lines.append(ln)
    i += 1
flush()

def esc(s): return html.escape(s)
def pname(s):  # 名前機能はゲームシステム側のため読み物HTMLでは何もしない(主人公名は本文どおり「アキ」固定)
    return s
def inline_md(s):
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    return s

NOTE_ORDER = ["演出", "挿絵概要", "学習接続", "分岐/フラグ"]
quest_at = {idx: t for idx, t in quests}
callout_at = {}
for idx, txt in callouts:
    callout_at.setdefault(idx, []).append(txt)

blocks = []  # (group_scene_index, html)
for si, sc in enumerate(scenes):
    if si in quest_at:
        blocks.append((si, f'<h2 class="quest" data-grp="{si}">{inline_md(quest_at[si])}</h2>'))
    body_html = []
    for kind, sp, text in sc["body"]:
        t = pname(esc(text))
        if kind == "narration":
            body_html.append(f'<p class="narration">{t}</p>')
        elif kind == "voice":
            body_html.append(f'<p class="line voice"><span class="who">{esc(sp)}</span>「{t}」</p>')
        else:
            body_html.append(f'<p class="line"><span class="who">{esc(sp)}</span>「{t}」</p>')
    star = '<span class="ill">★挿絵</span>' if sc["illust"] else ""
    notes_html = []
    for lab in NOTE_ORDER:
        if sc["notes"].get(lab):
            notes_html.append(f'<div class="note"><span class="nlabel">{esc(lab)}</span>{pname(inline_md(sc["notes"][lab]))}</div>')
    notes_block = (f'<details class="notes"><summary>演出ノート（{esc(sc["id"])}）</summary>{"".join(notes_html)}</details>') if notes_html else ""
    illust_slot = ""
    if sc["illust"]:
        info = ILLUST.get(sc["id"])
        if info:
            sid = sc["id"]
            domid = "img-" + sid.replace("_", "-")  # 例: img-c01-040
            rec = info["rec"]
            rec_src = f'{ASSET_DIR}/il_{sid}_{rec}_0.png'
            thumbs = "".join(
                f'<figure class="cand{" is-rec" if s==rec else ""}">'
                f'<img loading="lazy" src="{ASSET_DIR}/il_{sid}_{s}_0.png" alt="{esc(sid)} seed{s}">'
                f'<figcaption>seed{s}{"（推奨）" if s==rec else ""}</figcaption></figure>'
                for s in info["cand"])
            illust_slot = (
                f'<figure class="illust" id="{domid}">'
                f'<img loading="lazy" src="{esc(rec_src)}" alt="{esc(sid)} 推奨カット seed{rec}">'
                f'<figcaption><span class="ill-rec">推奨</span> {esc(sid)} ／ seed{rec} ／ '
                f'<span class="ill-cap">{esc(info["cap"])}</span></figcaption>'
                f'<details class="cands"><summary>全候補（{len(info["cand"])}枚）から選ぶ — 採否は人間レビュー</summary>'
                f'<div class="candrow">{thumbs}</div></details>'
                f'</figure>')
        else:
            illust_slot = f'<div class="illust-slot">挿絵スロット（{esc(sc["id"])}）— 生成後に組み込み</div>'
    # 行動選択肢: 3択=複数ボタン / アクション点=行動ラベルの1ボタン / その他=「▶ つづける」
    acts = ACTIONS.get(sc["id"], [])
    is_last = (si == len(scenes) - 1)
    action_points = set(ACTIONS.get("_action_points", []))
    if len(acts) > 1:
        labels = acts
    elif sc["id"] in action_points and acts:
        labels = acts
    else:
        labels = ["つづける"]
    plain = (len(labels) == 1 and labels == ["つづける"])
    btns = "".join(
        f'<button class="act{" plain" if plain else ""}" data-next="{si+1}" data-last="{1 if is_last else 0}">{pname(esc(a))}</button>'
        for a in labels)
    multi = ' multi' if len(labels) > 1 else ''
    blocks.append((si,
        f'<section class="scene" id="{esc(sc["id"])}" data-grp="{si}">'
        f'<h3 class="shead"><a href="#{esc(sc["id"])}" class="anchor">#</a> <span class="sid">{esc(sc["id"])}</span> {inline_md(sc["title"])} {star}</h3>'
        f'{illust_slot}<div class="body">{"".join(body_html)}</div>{notes_block}'
        f'<div class="actions{multi}">{btns}</div>'
        "</section>"))
    for txt in callout_at.get(si, []):
        blocks.append((si, f'<aside class="callout" data-grp="{si}">▶ {inline_md(txt)}</aside>'))

body_doc = "".join(h for _, h in blocks)

title_m = re.search(r"^# (.*)$", "\n".join(intro_lines), re.M)
chapter_title = re.split(r"\s*素案", (title_m.group(1).strip() if title_m else "第1章"))[0].strip()
n_scenes = len(scenes)

doc = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(chapter_title)}</title>
<style>
:root{{--bg:#14110f;--panel:#1d1916;--ink:#ece5db;--dim:#9a8f81;--accent:#e0a85a;--voice:#7fb6c4;--line:#2a241f;}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Mincho ProN","Yu Mincho",serif;line-height:1.95;}}
.wrap{{max-width:760px;margin:0 auto;padding:20px 22px 160px;}}
header.top{{text-align:center;border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:6px;}}
header.top h1{{font-size:1.8rem;letter-spacing:.06em;margin:.2em 0;}}
header.top .sub{{color:var(--dim);font-size:.86rem;font-family:sans-serif;}}
.toolbar{{position:sticky;top:0;background:rgba(20,17,15,.93);backdrop-filter:blur(4px);z-index:5;display:flex;gap:16px;align-items:center;justify-content:center;padding:9px;border-bottom:1px solid var(--line);font-family:sans-serif;font-size:.82rem;}}
.toolbar label,.toolbar button{{color:var(--dim);cursor:pointer;font-family:sans-serif;font-size:.82rem;background:none;border:1px solid var(--line);border-radius:5px;padding:3px 9px;}}
.toolbar .meta{{border:none;}}
h2.quest{{font-size:1.12rem;color:var(--accent);font-family:sans-serif;letter-spacing:.05em;margin:54px 0 8px;border-left:3px solid var(--accent);padding-left:12px;}}
section.scene{{padding:18px 0 6px;}}
.shead{{font-size:.8rem;font-family:sans-serif;font-weight:600;color:var(--dim);margin:0 0 12px;}}
.shead .sid{{color:var(--accent);opacity:.8;}} .shead .anchor{{color:var(--line);text-decoration:none;}}
.shead:hover .anchor{{color:var(--accent);}}
.ill{{color:#caa15e;border:1px solid #5a4a2e;border-radius:4px;padding:0 6px;font-size:.68rem;margin-left:6px;}}
.body{{font-size:1.08rem;}} p{{margin:.1em 0 .55em;}}
p.narration{{text-indent:1em;}}
p.line .who{{color:var(--accent);font-family:sans-serif;font-size:.78rem;margin-right:.15em;}}
p.voice{{color:var(--voice);font-style:italic;opacity:.92;}} p.voice .who{{color:var(--voice);}}
.pname{{color:inherit;font-weight:600;}}
p.narration .pname{{color:var(--accent);}}
.actions{{display:flex;flex-direction:column;gap:9px;margin:20px 0 8px;align-items:center;}}
.actions.multi .act{{border-color:#6a5a3a;}}
.act{{font-family:sans-serif;font-size:.96rem;color:var(--ink);background:linear-gradient(180deg,#241d16,#1b1611);border:1px solid #4a3f2c;border-radius:9px;padding:11px 22px;min-width:60%;cursor:pointer;transition:.15s;letter-spacing:.02em;}}
.act:before{{content:"▸ ";color:var(--accent);}}
.act:hover{{border-color:var(--accent);color:#fff;background:linear-gradient(180deg,#2e2517,#221a12);}}
.act.plain{{min-width:auto;padding:7px 24px;font-size:.86rem;color:var(--dim);background:transparent;border-color:var(--line);}}
.act.plain:hover{{color:var(--ink);border-color:#5a4a2e;background:#1b1611;}}
.act.chosen{{opacity:.4;border-color:var(--line);}} .act.faded{{opacity:.18;pointer-events:none;}}
.callout{{background:var(--panel);border:1px solid var(--line);border-left:3px solid #6a5a3a;color:var(--dim);font-family:sans-serif;font-size:.78rem;line-height:1.7;padding:10px 14px;margin:14px 0;border-radius:6px;}}
.illust-slot{{background:repeating-linear-gradient(45deg,#1d1916,#1d1916 10px,#211c18 10px,#211c18 20px);border:1px dashed #4a3f30;color:var(--dim);font-family:sans-serif;font-size:.76rem;text-align:center;padding:30px 10px;border-radius:8px;margin:6px 0 14px;}}
figure.illust{{margin:8px 0 18px;background:#191512;border:1px solid var(--line);border-radius:10px;overflow:hidden;}}
figure.illust>img{{display:block;width:100%;height:auto;}}
figure.illust>figcaption{{font-family:sans-serif;font-size:.78rem;line-height:1.6;color:#b8ac9c;padding:9px 14px;}}
figure.illust .ill-rec{{color:#14110f;background:var(--accent);font-weight:700;border-radius:4px;padding:1px 7px;font-size:.72rem;margin-right:6px;}}
figure.illust .ill-cap{{color:var(--dim);}}
details.cands{{border-top:1px solid var(--line);}}
details.cands summary{{cursor:pointer;color:var(--accent);font-family:sans-serif;font-size:.74rem;padding:8px 14px;list-style:none;}}
details.cands summary::-webkit-details-marker{{display:none}}
details.cands summary:before{{content:"▸ ";}}
.candrow{{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:6px 14px 14px;}}
figure.cand{{margin:0;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#14110f;}}
figure.cand.is-rec{{border-color:var(--accent);}}
figure.cand>img{{display:block;width:100%;height:auto;}}
figure.cand>figcaption{{font-family:sans-serif;font-size:.7rem;color:var(--dim);text-align:center;padding:4px 2px;}}
figure.cand.is-rec>figcaption{{color:var(--accent);}}
details.notes{{margin:8px 0 4px;border:1px solid var(--line);border-radius:6px;background:#191512;}}
details.notes summary{{cursor:pointer;color:var(--dim);font-family:sans-serif;font-size:.74rem;padding:7px 12px;list-style:none;}}
details.notes summary::-webkit-details-marker{{display:none}}
details.notes summary:before{{content:"▸ 演出ノート ";color:var(--accent);}}
.note{{font-family:sans-serif;font-size:.76rem;line-height:1.7;color:#b8ac9c;padding:6px 14px;border-top:1px solid var(--line);}}
.note .nlabel{{color:var(--accent);font-weight:600;margin-right:8px;}}
code{{font-family:ui-monospace,monospace;font-size:.85em;background:#241d17;color:#d7b486;padding:0 4px;border-radius:3px;}}
body:not(.shownotes) details.notes,body:not(.shownotes) .illust-slot{{display:none;}}
/* JS有効時のみVN式に1シーンずつ隠す。JS無効(iOSクイックルック等)では全文がそのまま読める */
body.js [data-grp]:not(.shown){{display:none;}}
body:not(.js) .actions{{display:none;}}
body:not(.js) .toolbar{{display:none;}}
.endcard{{display:none;text-align:center;color:var(--accent);font-family:sans-serif;margin:40px 0;font-size:1.1rem;letter-spacing:.1em;}}
.endcard.shown{{display:block;}}
footer{{color:var(--dim);font-family:sans-serif;font-size:.76rem;text-align:center;margin-top:50px;border-top:1px solid var(--line);padding-top:18px;}}
</style></head>
<body>
<div class="toolbar">
  <span class="meta">読みもの評価用 ／ {n_scenes}シーン</span>
  <label><input type="checkbox" id="t-notes"> 演出ノート・挿絵を表示</label>
  <button id="t-all">最後まで一気に表示</button>
</div>
<div class="wrap">
<header class="top">
  <h1>{esc(chapter_title)}</h1>
  <div class="sub">『ともしび』第1章 ／ 行動を選んで読み進める（“何をするか”を選択肢で明示）</div>
</header>
{body_doc}
<div class="endcard" id="endcard">― 第1章 了 ―</div>
<footer>本文＝<code>docs/drafts/ch1.md</code>／行動＝<code>ch1_actions.json</code> から自動生成。挿絵スロットは生成後の組込み位置（組み合わせ評価は別工程）。</footer>
</div>
<script>
document.body.classList.add('js'); // JSが動く時だけVN式の段階表示を有効化(無効時は全文表示)
const groups = {n_scenes};
function show(grp){{
  document.querySelectorAll('[data-grp="'+grp+'"]').forEach(function(el){{ el.classList.add('shown'); }});
}}
let cur = 0;
function reveal(upto){{ for(let g=0; g<=upto; g++) show(g); cur = Math.max(cur, upto); }}
function advance(next, isLast, btn){{
  // 押したボタンを選択済みに、同シーンの他ボタンを淡色化
  const acts = btn.parentNode;
  acts.querySelectorAll('.act').forEach(function(b){{ b.classList.add(b===btn?'chosen':'faded'); }});
  if(isLast){{ document.getElementById('endcard').classList.add('shown'); return; }}
  show(next);
  if(next>cur) cur = next;
  const sec = document.querySelector('[data-grp="'+next+'"]');
  if(sec) sec.scrollIntoView({{behavior:'smooth', block:'start'}});
}}
reveal(0); // 名前モーダルは廃止: 読み込み直後から最初のシーンを表示
document.querySelectorAll('.act').forEach(function(b){{
  b.addEventListener('click', function(){{ advance(parseInt(b.dataset.next), b.dataset.last==='1', b); }});
}});
document.getElementById('t-notes').addEventListener('change', function(e){{ document.body.classList.toggle('shownotes', e.target.checked); }});
document.getElementById('t-all').addEventListener('click', function(){{
  for(let g=0; g<groups; g++) show(g);
  document.querySelectorAll('.act').forEach(function(b){{ if(b.dataset.last!=='1') b.classList.add('chosen'); }});
  document.getElementById('endcard').classList.add('shown');
}});
</script>
</body></html>"""
open(OUT, "w", encoding="utf-8").write(doc)
print(f"scenes={len(scenes)} quests={len(quests)} callouts={len(callouts)} -> {OUT}")
