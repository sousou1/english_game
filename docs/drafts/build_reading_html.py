#!/usr/bin/env python3
# 章の素案 md を「ノベルゲーム風に能動的に読める」自己完結HTMLに変換する汎用ビルダー（全章共用）。
#   使い方:  python3 build_reading_html.py <章md> [出力html]
#   例:      python3 build_reading_html.py ch2.md ch2_reading_review.html
#
# 機能（workflow §5 / §5.1 準拠・サーバ不要の「貼り戻し方式」）:
#  - 章md(### cNN_xxx 形式)を1シーンずつVN式に読み進める。台詞/地の文/カンテラの声を描き分け。
#  - 演出ノート/挿絵スロットはトグル表示。行動は <章>_actions.json があれば使用、無ければ「▶ つづける」。
#  - 【ストーリーチェック】各シーンに「指摘」(タイプのチェック＋自由記述コメント)を付け、
#    右下「指摘をコピー」で {story:{sid:{tags,comment}}, illust:{...}, _overall} の構造化JSONを書き出す。
#  - 【挿絵レビュー】<章>_illust.json があれば各挿絵シーンに 推奨1案＋全候補ラジオ＋再生成依頼＋微修正＋コメントを出す。
import re, html, json, sys, os

HERE = os.path.dirname(__file__)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "ch1.md")
if not os.path.isabs(SRC):
    SRC = os.path.join(HERE, SRC)
BASE = re.sub(r"\.md$", "", os.path.basename(SRC))           # 例: ch2
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, f"{BASE}_reading_review.html")
if not os.path.isabs(OUT):
    OUT = os.path.join(HERE, OUT)

def load_json(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return default

# 行動定義（任意）。無い章は全シーン「▶ つづける」。
ACTIONS = load_json(os.path.join(HERE, f"{BASE}_actions.json"), {})
# 挿絵採用カット（任意）。{"asset_dir":..., "scenes":{sid:{rec,cand,cap}}}。無ければストーリーチェックのみ。
_illust_cfg = load_json(os.path.join(HERE, f"{BASE}_illust.json"), {})
ASSET_DIR = _illust_cfg.get("asset_dir", f"{BASE}_illust_assets")
ILLUST = _illust_cfg.get("scenes", {})

# ストーリーチェックの指摘タイプ（workflow §1.1/§2 の評価軸に対応）
FB_TAGS = ["説明不足", "会話不足", "違和感・矛盾", "テンプレ臭", "中だるみ(飛ばす)", "キャラ声", "学習接続", "文章表現"]

lines = open(SRC, encoding="utf-8").read().splitlines()

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
    m_s = re.match(r"^### (c\d+_\d+)\s*(.*)$", ln)
    m_note = re.match(r"^\*\*(本文|演出|挿絵概要|学習接続|分岐/フラグ)\*\*\s*[:：]?\s*(.*)$", ln)
    m_call = re.match(r"^>\s*▶\s*(.*)$", ln)
    if m_q:
        flush(); quests.append((len(scenes), m_q.group(1).strip())); mode = None; i += 1; continue
    if m_s:
        flush(); sid = m_s.group(1)
        title = m_s.group(2).replace("★挿絵", "").strip()
        cur = {"id": sid, "title": title,
               "illust": ("★挿絵" in m_s.group(2)) or (sid in ILLUST),
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

# 章番号・タイトル
chap_no = 1
if scenes:
    mno = re.match(r"^c(\d+)_", scenes[0]["id"])
    if mno:
        chap_no = int(mno.group(1))
title_m = re.search(r"^# (.*)$", "\n".join(intro_lines), re.M)
chapter_title = re.split(r"\s*素案", (title_m.group(1).strip() if title_m else f"第{chap_no}章"))[0].strip()
n_scenes = len(scenes)
has_illust_ui = any(sc["illust"] and sc["id"] in ILLUST for sc in scenes)

def story_fb(sid):
    # 各シーンのストーリー指摘ウィジェット（チェック＋コメント・常設・折りたたみ）
    chips = "".join(
        f'<label class="fbtag"><input type="checkbox" data-tag value="{esc(t)}"> {esc(t)}</label>'
        for t in FB_TAGS)
    return (f'<details class="fb-scene" data-sid="{esc(sid)}"><summary>✎ この場面に指摘する（{esc(sid)}）</summary>'
            f'<div class="fbtags">{chips}</div>'
            f'<textarea data-scmt rows="2" placeholder="気づき・違和感・直してほしい点を自由記述（任意）"></textarea>'
            f'</details>')

blocks = []  # (group_scene_index, html)
for si, sc in enumerate(scenes):
    if si in quest_at:
        blocks.append((si, f'<h2 class="quest" data-grp="{si}">{inline_md(quest_at[si])}</h2>'))
    body_html = []
    for kind, sp, text in sc["body"]:
        t = esc(text)
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
            notes_html.append(f'<div class="note"><span class="nlabel">{esc(lab)}</span>{inline_md(sc["notes"][lab])}</div>')
    notes_block = (f'<details class="notes"><summary>演出ノート（{esc(sc["id"])}）</summary>{"".join(notes_html)}</details>') if notes_html else ""
    illust_slot = ""
    if sc["illust"]:
        info = ILLUST.get(sc["id"])
        if info:
            sid = sc["id"]
            domid = "img-" + sid.replace("_", "-")  # 例: img-c02-040
            rec = info["rec"]
            rec_src = f'{ASSET_DIR}/il_{sid}_{rec}_0.png'
            thumbs = "".join(
                f'<label class="cand{" is-rec" if s==rec else ""}">'
                f'<input type="radio" name="sel-{sid}" value="{s}"{" checked" if s==rec else ""}>'
                f'<img loading="lazy" src="{ASSET_DIR}/il_{sid}_{s}_0.png" alt="{esc(sid)} seed{s}">'
                f'<span class="cap">seed{s}{"（推奨）" if s==rec else ""}</span></label>'
                for s in info["cand"])
            thumbs += (f'<label class="cand regen"><input type="radio" name="sel-{sid}" value="regen">'
                       f'<span class="cap">⟳ どれでもない（再生成を依頼）</span></label>')
            fb = (f'<div class="fb">'
                  f'<label class="fbminor"><input type="checkbox" data-minor> 微修正で対応（軽微な修正依頼）</label>'
                  f'<textarea data-cmt rows="2" placeholder="この絵への指摘・修正指示（理由）を自由記述 — 例: ランプの位置 / 色 / 表情 など"></textarea>'
                  f'</div>')
            illust_slot = (
                f'<figure class="illust" id="{domid}" data-sid="{esc(sid)}" data-dir="{ASSET_DIR}" data-rec="{rec}">'
                f'<img class="mainimg" src="{esc(rec_src)}" alt="{esc(sid)} 採用カット seed{rec}">'
                f'<figcaption><span class="ill-rec" data-sel-label>推奨</span> {esc(sid)} ／ '
                f'<span class="ill-seed">seed<b data-sel-seed>{rec}</b></span> ／ '
                f'<span class="ill-cap">{esc(info["cap"])}</span></figcaption>'
                f'<details class="cands"><summary>全候補（{len(info["cand"])}枚）から選ぶ／再生成依頼・コメント — ラジオで選択すると上の大画像が切替（採否は人間／下の「指摘をコピー」で書き出し）</summary>'
                f'<div class="candrow">{thumbs}</div>{fb}</details>'
                f'</figure>')
        else:
            illust_slot = f'<div class="illust-slot">挿絵スロット（{esc(sc["id"])}）— 生成後に組み込み（挿絵概要はノートに記載）</div>'
    # 行動選択肢
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
        f'<button class="act{" plain" if plain else ""}" data-next="{si+1}" data-last="{1 if is_last else 0}">{esc(a)}</button>'
        for a in labels)
    multi = ' multi' if len(labels) > 1 else ''
    blocks.append((si,
        f'<section class="scene" id="{esc(sc["id"])}" data-grp="{si}">'
        f'<h3 class="shead"><a href="#{esc(sc["id"])}" class="anchor">#</a> <span class="sid">{esc(sc["id"])}</span> {inline_md(sc["title"])} {star}</h3>'
        f'{illust_slot}<div class="body">{"".join(body_html)}</div>{notes_block}'
        f'{story_fb(sc["id"])}'
        f'<div class="actions{multi}">{btns}</div>'
        "</section>"))
    for txt in callout_at.get(si, []):
        blocks.append((si, f'<aside class="callout" data-grp="{si}">▶ {inline_md(txt)}</aside>'))

body_doc = "".join(h for _, h in blocks)

copy_label = "指摘をコピー"
selbar_hint = "ストーリー＆挿絵の指摘：" if has_illust_ui else "ストーリーの指摘："

doc = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(chapter_title)}</title>
<style>
:root{{--bg:#14110f;--panel:#1d1916;--ink:#ece5db;--dim:#9a8f81;--accent:#e0a85a;--voice:#7fb6c4;--line:#2a241f;--flag:#c98f6a;}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Mincho ProN","Yu Mincho",serif;line-height:1.95;}}
.wrap{{max-width:760px;margin:0 auto;padding:20px 22px 200px;}}
header.top{{text-align:center;border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:6px;}}
header.top h1{{font-size:1.8rem;letter-spacing:.06em;margin:.2em 0;}}
header.top .sub{{color:var(--dim);font-size:.86rem;font-family:sans-serif;}}
.toolbar{{position:sticky;top:0;background:rgba(20,17,15,.93);backdrop-filter:blur(4px);z-index:5;display:flex;gap:16px;align-items:center;justify-content:center;padding:9px;border-bottom:1px solid var(--line);font-family:sans-serif;font-size:.82rem;flex-wrap:wrap;}}
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
label.cand{{display:block;margin:0;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#14110f;cursor:pointer;position:relative;}}
label.cand.is-rec{{border-color:#6a5a3a;}}
label.cand>input{{position:absolute;top:6px;left:6px;z-index:2;accent-color:var(--accent);width:18px;height:18px;}}
label.cand>img{{display:block;width:100%;height:auto;}}
label.cand>.cap{{display:block;font-family:sans-serif;font-size:.7rem;color:var(--dim);text-align:center;padding:4px 2px;}}
label.cand:has(input:checked){{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset;}}
label.cand:has(input:checked)>.cap{{color:var(--accent);font-weight:700;}}
label.cand.regen{{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:9px 12px;background:#1b1611;}}
label.cand.regen>input{{position:static;}}
label.cand.regen:has(input:checked){{border-color:#d98a5a;box-shadow:0 0 0 1px #d98a5a inset;}}
label.cand.regen:has(input:checked)>.cap{{color:#e89a6a;}}
.fb{{display:flex;flex-direction:column;gap:7px;padding:4px 14px 14px;}}
.fb .fbminor{{font-family:sans-serif;font-size:.76rem;color:#b8ac9c;cursor:pointer;display:flex;align-items:center;gap:6px;}}
.fb .fbminor input{{accent-color:#7fb6c4;width:15px;height:15px;}}
.fb textarea{{width:100%;background:#14110f;color:var(--ink);border:1px solid var(--line);border-radius:6px;font-family:sans-serif;font-size:.8rem;line-height:1.5;padding:7px 9px;resize:vertical;}}
.fb textarea:focus{{outline:none;border-color:var(--accent);}}
figure.illust.regen-req{{box-shadow:0 0 0 2px #d98a5a inset;}}
figure.illust.regen-req .ill-rec{{background:#d98a5a;}}
/* ストーリー指摘ウィジェット（各シーン） */
details.fb-scene{{margin:10px 0 2px;border:1px solid var(--line);border-radius:7px;background:#191512;}}
details.fb-scene>summary{{cursor:pointer;color:var(--dim);font-family:sans-serif;font-size:.76rem;padding:7px 12px;list-style:none;}}
details.fb-scene>summary::-webkit-details-marker{{display:none}}
details.fb-scene[open]>summary,details.fb-scene.has-fb>summary{{color:var(--flag);}}
details.fb-scene.has-fb{{border-color:var(--flag);box-shadow:0 0 0 1px var(--flag) inset;}}
.fbtags{{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 4px;border-top:1px solid var(--line);}}
label.fbtag{{font-family:sans-serif;font-size:.74rem;color:#b8ac9c;border:1px solid var(--line);border-radius:14px;padding:3px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}}
label.fbtag input{{accent-color:var(--flag);width:14px;height:14px;margin:0;}}
label.fbtag:has(input:checked){{border-color:var(--flag);color:var(--flag);background:#221a14;}}
details.fb-scene textarea{{width:calc(100% - 24px);margin:6px 12px 12px;background:#14110f;color:var(--ink);border:1px solid var(--line);border-radius:6px;font-family:sans-serif;font-size:.8rem;line-height:1.5;padding:7px 9px;resize:vertical;}}
details.fb-scene textarea:focus{{outline:none;border-color:var(--flag);}}
.overall{{margin:34px 0 0;border:1px solid var(--line);border-radius:8px;background:#191512;padding:12px 14px;}}
.overall label{{font-family:sans-serif;font-size:.82rem;color:var(--accent);display:block;margin-bottom:7px;}}
.overall textarea{{width:100%;min-height:70px;background:#14110f;color:var(--ink);border:1px solid var(--line);border-radius:6px;font-family:sans-serif;font-size:.82rem;line-height:1.6;padding:8px 10px;resize:vertical;}}
.selbar{{position:fixed;right:14px;bottom:14px;z-index:20;display:flex;gap:8px;align-items:center;background:rgba(20,17,15,.95);border:1px solid #4a3f2c;border-radius:10px;padding:8px 10px;font-family:sans-serif;font-size:.8rem;box-shadow:0 4px 18px rgba(0,0,0,.5);}}
.selbar button{{font-family:sans-serif;font-size:.8rem;color:#14110f;background:var(--accent);border:none;border-radius:7px;padding:7px 13px;cursor:pointer;font-weight:700;}}
.selbar button:hover{{background:#efbd6e;}}
.selbar .hint{{color:var(--dim);}}
.selbar .cnt{{color:var(--flag);font-weight:700;}}
.selbar.ok{{border-color:var(--accent);}}
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
body:not(.js) .toolbar,body:not(.js) .selbar{{display:none;}}
.endcard{{display:none;text-align:center;color:var(--accent);font-family:sans-serif;margin:40px 0;font-size:1.1rem;letter-spacing:.1em;}}
.endcard.shown{{display:block;}}
footer{{color:var(--dim);font-family:sans-serif;font-size:.76rem;text-align:center;margin-top:50px;border-top:1px solid var(--line);padding-top:18px;}}
</style></head>
<body>
<div class="toolbar">
  <span class="meta">レビュー用 ／ {n_scenes}シーン</span>
  <label><input type="checkbox" id="t-notes"> 演出ノート・挿絵概要を表示</label>
  <button id="t-all">最後まで一気に表示</button>
</div>
<div class="wrap">
<header class="top">
  <h1>{esc(chapter_title)}</h1>
  <div class="sub">『ともしび』第{chap_no}章 ／ 読み進めながら各場面に「✎ 指摘」を残せます（ストーリーチェック）</div>
</header>
{body_doc}
<div class="overall" data-grp="{max(n_scenes-1,0)}">
  <label for="overall-cmt">章全体への総評・気づき（任意）</label>
  <textarea id="overall-cmt" placeholder="掴み/ペーシング/キャラ/伏線/学習接続 など、章全体のコメントを自由記述"></textarea>
</div>
<div class="endcard" id="endcard">― 第{chap_no}章 了 ―</div>
<footer>本文＝<code>docs/drafts/{esc(BASE)}.md</code> から自動生成（汎用ビルダー <code>build_reading_html.py</code>）。指摘は「{copy_label}」でJSON書き出し。</footer>
</div>
<div class="selbar" id="selbar">
  <span class="hint">{selbar_hint}</span><span class="cnt" id="fb-count"></span>
  <button id="copy-sel">{copy_label}</button>
</div>
<script>
document.body.classList.add('js');
const groups = {n_scenes};
function show(grp){{ document.querySelectorAll('[data-grp="'+grp+'"]').forEach(function(el){{ el.classList.add('shown'); }}); }}
let cur = 0;
function reveal(upto){{ for(let g=0; g<=upto; g++) show(g); cur = Math.max(cur, upto); }}
function advance(next, isLast, btn){{
  const acts = btn.parentNode;
  acts.querySelectorAll('.act').forEach(function(b){{ b.classList.add(b===btn?'chosen':'faded'); }});
  if(isLast){{ document.getElementById('endcard').classList.add('shown'); show(groups-1); return; }}
  show(next); if(next>cur) cur = next;
  const sec = document.querySelector('section[data-grp="'+next+'"]');
  if(sec) sec.scrollIntoView({{behavior:'smooth', block:'start'}});
}}
reveal(0);
document.querySelectorAll('.act').forEach(function(b){{
  b.addEventListener('click', function(){{ advance(parseInt(b.dataset.next), b.dataset.last==='1', b); }});
}});
document.getElementById('t-notes').addEventListener('change', function(e){{ document.body.classList.toggle('shownotes', e.target.checked); }});
document.getElementById('t-all').addEventListener('click', function(){{
  for(let g=0; g<groups; g++) show(g);
  document.querySelectorAll('.act').forEach(function(b){{ if(b.dataset.last!=='1') b.classList.add('chosen'); }});
  document.getElementById('endcard').classList.add('shown');
}});

// --- 挿絵選択（貼り戻し方式）: ラジオ選択で大画像を切替 ---
document.querySelectorAll('figure.illust').forEach(function(fig){{
  const sid = fig.dataset.sid, dir = fig.dataset.dir, rec = fig.dataset.rec;
  const main = fig.querySelector('.mainimg');
  const seedEl = fig.querySelector('[data-sel-seed]');
  const labelEl = fig.querySelector('[data-sel-label]');
  fig.querySelectorAll('input[type=radio]').forEach(function(r){{
    r.addEventListener('change', function(){{
      if(!r.checked) return;
      if(r.value === 'regen'){{ fig.classList.add('regen-req'); seedEl.textContent='—'; labelEl.textContent='再生成依頼'; labelEl.style.background='#d98a5a'; return; }}
      fig.classList.remove('regen-req');
      main.src = dir + '/il_' + sid + '_' + r.value + '_0.png';
      seedEl.textContent = r.value;
      const isRec = (r.value === rec);
      labelEl.textContent = isRec ? '推奨' : '選択';
      labelEl.style.background = isRec ? 'var(--accent)' : '#7fb6c4';
    }});
  }});
}});

// --- ストーリー指摘: チェック/コメントのあるシーンを強調＋件数表示 ---
function sceneFb(det){{
  const tags = Array.from(det.querySelectorAll('input[data-tag]:checked')).map(function(c){{return c.value;}});
  const cmt = det.querySelector('textarea[data-scmt]');
  const comment = (cmt && cmt.value.trim()) || '';
  return {{tags: tags, comment: comment, any: (tags.length>0 || comment!=='')}};
}}
function refreshCount(){{
  let n = 0;
  document.querySelectorAll('details.fb-scene').forEach(function(det){{
    const f = sceneFb(det);
    det.classList.toggle('has-fb', f.any);
    if(f.any) n++;
  }});
  const el = document.getElementById('fb-count');
  el.textContent = n ? ('指摘 '+n+'件') : '';
}}
document.querySelectorAll('details.fb-scene').forEach(function(det){{
  det.addEventListener('input', refreshCount);
  det.addEventListener('change', refreshCount);
}});

// --- 「指摘をコピー」: story + illust + 総評 を構造化JSONで ---
function collectAll(){{
  const story = {{}};
  document.querySelectorAll('details.fb-scene').forEach(function(det){{
    const f = sceneFb(det);
    if(f.any) story[det.dataset.sid] = {{tags: f.tags, comment: f.comment}};
  }});
  const illust = {{}};
  document.querySelectorAll('figure.illust').forEach(function(fig){{
    const r = fig.querySelector('input[type=radio]:checked');
    const minor = fig.querySelector('input[data-minor]');
    const cmt = fig.querySelector('textarea[data-cmt]');
    const v = r ? r.value : null;
    illust[fig.dataset.sid] = {{
      seed: (v === 'regen' || v === null) ? v : parseInt(v),
      regen: (v === 'regen'),
      minorFix: !!(minor && minor.checked),
      comment: (cmt && cmt.value.trim()) || ''
    }};
  }});
  const overall = (document.getElementById('overall-cmt').value || '').trim();
  const out = {{chapter: "{esc(BASE)}", story: story}};
  if(Object.keys(illust).length) out.illust = illust;
  if(overall) out._overall = overall;
  return out;
}}
document.getElementById('copy-sel').addEventListener('click', function(){{
  const data = collectAll();
  const txt = '第{chap_no}章 レビュー結果（貼り戻し用）\\n'
    + '// story={{sid:{{tags,comment}}}} の指摘 / illust=挿絵採否(seed,regen,minorFix,comment) / _overall=章総評\\n'
    + JSON.stringify(data, null, 2);
  const bar = document.getElementById('selbar');
  function done(){{ bar.classList.add('ok'); const b=document.getElementById('copy-sel'); const o=b.textContent; b.textContent='コピーしました ✓'; setTimeout(function(){{b.textContent=o;bar.classList.remove('ok');}},1800); }}
  if(navigator.clipboard && navigator.clipboard.writeText){{
    navigator.clipboard.writeText(txt).then(done, function(){{ window.prompt('この内容をコピーして貼り戻してください', txt); }});
  }} else {{ window.prompt('この内容をコピーして貼り戻してください', txt); }}
}});
</script>
</body></html>"""
open(OUT, "w", encoding="utf-8").write(doc)
print(f"chapter={BASE} scenes={len(scenes)} quests={len(quests)} illust_ui={has_illust_ui} -> {OUT}")
