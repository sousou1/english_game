#!/usr/bin/env python3
# docs/drafts/ch1.md を「読みもの」として読める自己完結HTMLに変換する。
# 出力: docs/drafts/ch1_reading.html
# - 本文を主役にして読めるレイアウト。台詞/地の文/カンテラの声を描き分け。
# - 演出・挿絵概要・学習接続・分岐は <details> の「演出ノート」に畳む(既定=閉、純粋な読み物)。
# - シーンIDを見出し/アンカーに振り、指摘しやすくする。
import re, html, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "ch1.md")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "ch1_reading.html")

lines = open(SRC, encoding="utf-8").read().splitlines()

# --- パース ---
ILLUST_SCENES = {"c01_010", "c01_040", "c01_060", "c01_140", "c01_180"}
scenes = []          # {id,title,illust,body:[(kind,speaker,text)],notes:{label:text}}
quests = []          # (index_in_scenes, quest_title)
callouts = []        # (after_scene_index, text)  ▶ イベント/さしいれ
intro_lines = []
cur = None
mode = None          # None / 'body' / 'note'
note_label = None
seen_quest = False

def flush_scene():
    global cur
    if cur is not None:
        scenes.append(cur)
        cur = None

i = 0
while i < len(lines):
    ln = lines[i]
    m_q = re.match(r"^## クエスト\s+(.*)", ln)
    m_s = re.match(r"^### (c01_\d+)\s*(.*)$", ln)
    m_note = re.match(r"^\*\*(本文|演出|挿絵概要|学習接続|分岐/フラグ)\*\*\s*[:：]?\s*(.*)$", ln)
    m_call = re.match(r"^>\s*▶\s*(.*)$", ln)

    if m_q:
        flush_scene()
        quests.append((len(scenes), m_q.group(1).strip()))
        mode = None
        i += 1; continue
    if m_s:
        flush_scene()
        sid = m_s.group(1)
        title = m_s.group(2).replace("★挿絵", "").strip()
        cur = {"id": sid, "title": title, "illust": ("★挿絵" in m_s.group(2)) or (sid in ILLUST_SCENES),
               "body": [], "notes": {}}
        mode = None
        i += 1; continue
    if m_call:
        # ▶ コールアウト（イベント/さしいれ）。直前シーンの後に置く。
        txt = m_call.group(1).strip()
        # 連続する > 行を結合
        j = i + 1
        while j < len(lines) and re.match(r"^>\s+", lines[j]) and not re.match(r"^>\s*▶", lines[j]):
            txt += " " + re.sub(r"^>\s+", "", lines[j]).strip()
            j += 1
        callouts.append((len(scenes) - 1, txt))
        i = j; continue
    if m_note and cur is not None:
        label = m_note.group(1)
        if label == "本文":
            mode = "body"
        else:
            mode = "note"; note_label = label
            rest = m_note.group(2).strip()
            cur["notes"][label] = rest
        i += 1; continue

    # 本文の引用行
    if cur is not None and mode == "body" and ln.startswith(">"):
        text = re.sub(r"^>\s?", "", ln).rstrip()
        if text == "":
            i += 1; continue
        # 話者判定
        m_sp = re.match(r"^([^「」]{1,8})「(.*)」\s*$", text)
        if m_sp:
            sp = m_sp.group(1)
            kind = "voice" if sp == "声" else "dialogue"
            cur["body"].append((kind, sp, m_sp.group(2)))
        else:
            cur["body"].append(("narration", "", text))
        i += 1; continue

    # ノート本文の続き（演出等の複数行）
    if cur is not None and mode == "note":
        if ln.strip() == "" or ln.startswith("###") or ln.startswith("##"):
            mode = None
        else:
            cur["notes"][note_label] = (cur["notes"].get(note_label, "") + " " + ln.strip()).strip()
        i += 1; continue

    # イントロ（最初のクエスト前）
    if not quests and cur is None:
        intro_lines.append(ln)
    i += 1

flush_scene()

# --- HTML 生成 ---
def esc(s): return html.escape(s)

def inline_md(s):
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    return s

NOTE_ORDER = ["演出", "挿絵概要", "学習接続", "分岐/フラグ"]

# クエスト境界マップ
quest_at = {idx: title for idx, title in quests}
callout_at = {}
for idx, txt in callouts:
    callout_at.setdefault(idx, []).append(txt)

parts = []
for si, sc in enumerate(scenes):
    if si in quest_at:
        parts.append(f'<h2 class="quest">{inline_md(quest_at[si])}</h2>')
    body_html = []
    for kind, sp, text in sc["body"]:
        if kind == "narration":
            body_html.append(f'<p class="narration">{esc(text)}</p>')
        elif kind == "voice":
            body_html.append(f'<p class="line voice"><span class="who">{esc(sp)}</span>「{esc(text)}」</p>')
        else:
            body_html.append(f'<p class="line"><span class="who">{esc(sp)}</span>「{esc(text)}」</p>')
    star = '<span class="ill" title="節目の挿絵シーン">★挿絵</span>' if sc["illust"] else ""
    notes_html = []
    for lab in NOTE_ORDER:
        if lab in sc["notes"] and sc["notes"][lab]:
            notes_html.append(f'<div class="note"><span class="nlabel">{esc(lab)}</span>{inline_md(sc["notes"][lab])}</div>')
    notes_block = ""
    if notes_html:
        notes_block = (f'<details class="notes"><summary>演出ノート（{esc(sc["id"])}）</summary>'
                       + "".join(notes_html) + "</details>")
    illust_slot = ""
    if sc["illust"]:
        illust_slot = f'<div class="illust-slot" data-sid="{esc(sc["id"])}">挿絵スロット（{esc(sc["id"])}）— 生成後に組み込み</div>'
    parts.append(
        f'<section class="scene" id="{esc(sc["id"])}">'
        f'<h3 class="shead"><a href="#{esc(sc["id"])}" class="anchor">#</a> <span class="sid">{esc(sc["id"])}</span> {inline_md(sc["title"])} {star}</h3>'
        f'{illust_slot}'
        f'<div class="body">{"".join(body_html)}</div>'
        f'{notes_block}'
        "</section>"
    )
    for txt in callout_at.get(si, []):
        parts.append(f'<aside class="callout">▶ {inline_md(txt)}</aside>')

intro_html = ""
# イントロは要点だけ（先頭の見出しと舞台行）を畳んで載せる
intro_join = "\n".join(intro_lines)
title_m = re.search(r"^# (.*)$", intro_join, re.M)
chapter_title = title_m.group(1).strip() if title_m else "第1章"
# 読みもの用に簡潔化（「…素案 ―…」以降を落とす）
chapter_title = re.split(r"\s*素案", chapter_title)[0].strip()

body_doc = "".join(parts)

doc = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(chapter_title)}</title>
<style>
:root{{--bg:#14110f;--panel:#1d1916;--ink:#ece5db;--dim:#9a8f81;--accent:#e0a85a;--voice:#7fb6c4;--line:#2a241f;}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Mincho ProN","Yu Mincho",serif;line-height:1.95;}}
.wrap{{max-width:760px;margin:0 auto;padding:48px 22px 120px;}}
header.top{{text-align:center;border-bottom:1px solid var(--line);padding-bottom:26px;margin-bottom:10px;}}
header.top h1{{font-size:1.9rem;letter-spacing:.06em;margin:.2em 0;}}
header.top .sub{{color:var(--dim);font-size:.9rem;font-family:sans-serif;}}
.toolbar{{position:sticky;top:0;background:rgba(20,17,15,.92);backdrop-filter:blur(4px);z-index:5;display:flex;gap:14px;align-items:center;justify-content:center;padding:10px;border-bottom:1px solid var(--line);font-family:sans-serif;font-size:.84rem;}}
.toolbar label{{color:var(--dim);cursor:pointer;user-select:none;}}
h2.quest{{font-size:1.15rem;color:var(--accent);font-family:sans-serif;letter-spacing:.05em;margin:64px 0 8px;border-left:3px solid var(--accent);padding-left:12px;}}
section.scene{{padding:22px 0 8px;border-bottom:1px dotted var(--line);}}
.shead{{font-size:.82rem;font-family:sans-serif;font-weight:600;color:var(--dim);margin:0 0 14px;letter-spacing:.02em;}}
.shead .sid{{color:var(--accent);opacity:.8;}}
.shead .anchor{{color:var(--line);text-decoration:none;}}
.shead:hover .anchor{{color:var(--accent);}}
.ill{{color:#caa15e;border:1px solid #5a4a2e;border-radius:4px;padding:0 6px;font-size:.7rem;margin-left:6px;}}
.body{{font-size:1.08rem;}}
p{{margin:.1em 0 .55em;}}
p.narration{{text-indent:1em;color:var(--ink);}}
p.line{{margin-left:.2em;}}
p.line .who{{color:var(--accent);font-family:sans-serif;font-size:.78rem;margin-right:.15em;opacity:.95;}}
p.voice{{color:var(--voice);font-style:italic;opacity:.92;}}
p.voice .who{{color:var(--voice);}}
.callout{{background:var(--panel);border:1px solid var(--line);border-left:3px solid #6a5a3a;color:var(--dim);font-family:sans-serif;font-size:.8rem;line-height:1.7;padding:10px 14px;margin:14px 0;border-radius:6px;}}
.illust-slot{{background:repeating-linear-gradient(45deg,#1d1916,#1d1916 10px,#211c18 10px,#211c18 20px);border:1px dashed #4a3f30;color:var(--dim);font-family:sans-serif;font-size:.78rem;text-align:center;padding:34px 10px;border-radius:8px;margin:6px 0 16px;}}
details.notes{{margin:8px 0 4px;border:1px solid var(--line);border-radius:6px;background:#191512;}}
details.notes summary{{cursor:pointer;color:var(--dim);font-family:sans-serif;font-size:.76rem;padding:7px 12px;list-style:none;}}
details.notes summary::-webkit-details-marker{{display:none}}
details.notes summary:before{{content:"▸ ";color:var(--accent);}}
details.notes[open] summary:before{{content:"▾ ";}}
.note{{font-family:sans-serif;font-size:.78rem;line-height:1.7;color:#b8ac9c;padding:6px 14px;border-top:1px solid var(--line);}}
.note .nlabel{{display:inline-block;color:var(--accent);font-weight:600;margin-right:8px;}}
code{{font-family:ui-monospace,monospace;font-size:.85em;background:#241d17;color:#d7b486;padding:0 4px;border-radius:3px;}}
body.hidenotes details.notes{{display:none;}}
body.hidenotes .illust-slot{{display:none;}}
footer{{color:var(--dim);font-family:sans-serif;font-size:.78rem;text-align:center;margin-top:60px;border-top:1px solid var(--line);padding-top:20px;}}
</style></head>
<body class="hidenotes">
<div class="toolbar">
  <label><input type="checkbox" id="t-notes"> 演出ノート・挿絵スロットを表示</label>
</div>
<div class="wrap">
<header class="top">
  <h1>{esc(chapter_title)}</h1>
  <div class="sub">『ともしび』第1章 ／ 読みもの評価用（本文中心・演出ノートは既定で非表示）</div>
</header>
{body_doc}
<footer>読みもの評価用ビルド ／ 本文＝<code>docs/drafts/ch1.md</code> から自動生成。<br>
挿絵スロットは生成後にシーン絵を組み込む位置（組み合わせ評価は別途）。</footer>
</div>
<script>
document.getElementById('t-notes').addEventListener('change',function(e){{
  document.body.classList.toggle('hidenotes', !e.target.checked);
}});
</script>
</body></html>"""

open(OUT, "w", encoding="utf-8").write(doc)
print(f"scenes={len(scenes)} quests={len(quests)} callouts={len(callouts)} -> {OUT}")
