// 完結ステータス台帳ジェネレータ。
// 目的: 自走ループが「完結に到達したか」を“読める”機械可読な目的地を作る。
//   arc-plot.md(全章プロット=物語の正典)で定義された「完結」の到達度を、実データ
//   (js/scenario.js / data/events.js / data/words.js / assets/img)から機械算出し、
//   docs/goals/STATUS.md を生成する。AI多ペルソナ・レビュー等の非データ項目は
//   docs/goals/STATUS.state.json(任意)から読む(無ければ pending)。
//
// 完結の定義(ユーザ確定 2026-06-16):
//   全9章 + 3本+隠し1本のエンディング + さしいれ24通 + 語彙DB 5,000語。
//   レビュー = AI多ペルソナ・レビュー(high-issues-zero)で担保。
//   人間の創作レビューは撤廃(ユーザは消費者として遊ぶ)。
//   挿絵は当面 local 生成、最終差し替えは gpt-image-2(後段)。
//
// 実行: npm run status   (= node scripts/status.mjs)。--check で未完なら exit 1。

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SCENARIO } from '../js/scenario.js';
import { EVENTS } from '../data/events.js';
import { WORDS } from '../data/words.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'goals', 'STATUS.md');
const STATE_FILE = path.join(ROOT, 'docs', 'goals', 'STATUS.state.json');

// ---- 完結の目的地(arc-plot.md §4/§4.1/§6/§12 由来。数値は正典の写し) ----
const VOCAB_TARGET = 5000;        // ユーザ確定。arc-plot原文782語は物語の芯、残りはサブ供給(vocab-growth-design.md)
const SCENE_BUDGET = 250;         // ハードキャップ(§12)。想定総量 ~218
const SASHIIRE_TARGET = 24;       // ユイのさしいれ(§12)
const CH = [
  { n: 1, title: '灯が消えた夜', gate: 15, events: 6, supply: 48, scenes: 25, day: '1–2' },
  { n: 2, title: '追われて、街道', gate: 40, events: 6, supply: 48, scenes: 16, day: '3–4' },
  { n: 3, title: '灯札の街', gate: 90, events: 8, supply: 64, scenes: 20, day: '7' },
  { n: 4, title: '禁書の灯', gate: 150, events: 9, supply: 72, scenes: 20, day: '11' },
  { n: 5, title: '声のない町', gate: 220, events: 9, supply: 72, scenes: 18, day: '15–16' },
  { n: 6, title: '帰れない村', gate: 290, events: 10, supply: 80, scenes: 16, day: '20–21' },
  { n: 7, title: '都の取引', gate: 360, events: 11, supply: 88, scenes: 24, day: '25' },
  { n: 8, title: '灰都へ', gate: 420, events: 11, supply: 88, scenes: 22, day: '28–29' },
  { n: 9, title: 'きみの名前で(終章)', gate: 450, events: 5, supply: 40, scenes: 14, day: '30–31' },
];
const ENDINGS = [
  { key: 'hero', label: '王道「めぐる灯」', cond: 'route=hero' },
  { key: 'yui', label: '幼馴染「おかえりの灯」', cond: 'route=yui (yui≥6)' },
  { key: 'quiet', label: '静かな「灰の底で」', cond: 'route=quiet' },
  { key: 'friend', label: '隠し「friend」', cond: '全END後+語り部級50語' },
];

// ---- 任意の状態ファイル(AIパイプラインが更新する“ティック”) ----
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const chState = (n) => (state.chapters && state.chapters[n]) || {};
const endState = (k) => (state.endings && state.endings[k]) || {};

// ---- 機械算出ヘルパ ----
const prefix = (n) => `c${String(n).padStart(2, '0')}_`;
const artFiles = existsSync(path.join(ROOT, 'assets', 'img'))
  ? readdirSync(path.join(ROOT, 'assets', 'img'))
  : [];

function chapterStatus(c) {
  const pre = prefix(c.n);
  const scenes = SCENARIO.scenes.filter((s) => s.id.startsWith(pre));
  const events = EVENTS.filter((e) => e.id.startsWith('ev_' + pre));
  const supply = new Set();
  for (const e of events) for (const b of e.beats || []) {
    const t = b.teach;
    if (typeof t === 'string') supply.add(t);
    else if (Array.isArray(t)) for (const x of t) supply.add(x);
    for (const a of (b.cast && b.cast.answers) || []) supply.add(a);
  }
  const gateScene = scenes.find((s) => s.gate && typeof s.gate.settled === 'number');
  const gateOk = !!gateScene && gateScene.gate.settled === c.gate;
  const art = artFiles.filter((f) => f.startsWith('scene_' + pre) && f.endsWith('.webp')).length;
  const st = chState(c.n);
  const reviewed = !!st.reviewed;      // AI多ペルソナ・レビュー high0 合格
  const artFinal = !!st.artFinal;      // gpt-image-2 への最終差し替え済み
  // 機械配線: シーン8割以上 & 全イベント供給済 & ゲート一致
  const wired = scenes.length >= Math.ceil(c.scenes * 0.8) && events.length >= c.events && gateOk;
  const done = wired && reviewed;
  const sym = done ? '✅' : (scenes.length > 0 || events.length > 0 ? '🚧' : '⬜');
  return { ...c, sceneN: scenes.length, eventN: events.length, supplyN: supply.size, gateOk, art, reviewed, artFinal, wired, done, sym };
}

const rows = CH.map(chapterStatus);
const sumScenes = SCENARIO.scenes.length;
const sumSupply = rows.reduce((a, r) => a + r.supplyN, 0);
const chaptersDone = rows.filter((r) => r.done).length;
const chaptersWired = rows.filter((r) => r.wired).length;
const chaptersStarted = rows.filter((r) => r.sceneN > 0 || r.eventN > 0).length;
const endingsDone = ENDINGS.filter((e) => endState(e.key).inCode).length;
const sashiireN = state.sashiire || 0;
const vocabN = WORDS.length;

// ---- 次に“機械的に”着手できるギャップ(人間の創作判断を要さない順) ----
function nextGaps() {
  const g = [];
  for (const r of rows) {
    if (r.sceneN === 0 && r.eventN === 0) { g.push(`第${r.n}章「${r.title}」: 配線ゼロ。素案を scenario.js/events.js へ組込み(目標 ${r.scenes}シーン/${r.events}イベント/供給${r.supply}語, ゲート settled≥${r.gate})`); }
    else if (!r.wired) { g.push(`第${r.n}章「${r.title}」: 配線途中(現${r.sceneN}/${r.scenes}シーン・${r.eventN}/${r.events}イベント・ゲート${r.gateOk ? 'OK' : '未'})`); }
    else if (!r.reviewed) { g.push(`第${r.n}章「${r.title}」: 配線済・AIレビュー(high0)未通過`); }
  }
  if (endingsDone < ENDINGS.length) g.push(`エンディング分岐ロジック未実装(現${endingsDone}/4)。route フラグ確定(7章末)+ ED ルーティングをコード化`);
  if (vocabN < VOCAB_TARGET) g.push(`語彙DB拡張: ${vocabN}→${VOCAB_TARGET}語(残${VOCAB_TARGET - vocabN}・vocab-growth-design.md)`);
  if (sashiireN < SASHIIRE_TARGET) g.push(`さしいれ: ${sashiireN}/${SASHIIRE_TARGET}通`);
  return g.slice(0, 6);
}

const pct = (a, b) => `${Math.round((a / b) * 100)}%`;
// 日時は自動スタンプしない(再生成を冪等に保ち git 差分を汚さない)。鮮度は git ログ参照。
const stamp = process.env.STATUS_DATE || '再生成: npm run status(鮮度は git ログ参照)';

// ---- Markdown 生成 ----
const md = `# 完結ステータス台帳 ―『ともしび』

> **自動生成**: \`npm run status\`(\`scripts/status.mjs\`)。手で編集しない。
> 非データ項目(AIレビュー合否・art最終差し替え)は \`docs/goals/STATUS.state.json\` を編集して反映。
> 生成日時: ${stamp}

## 完結の定義(ユーザ確定 2026-06-16)
全 **9章** + **3本+隠し1本**のエンディング + **さしいれ${SASHIIRE_TARGET}通** + 語彙DB **${VOCAB_TARGET.toLocaleString()}語**。
- **レビュー = AI多ペルソナ・レビュー(high-issues-zero)** で担保。**人間の創作レビューは撤廃**(ユーザは消費者として遊ぶ)。
- 挿絵は当面 local 生成、最終差し替えは **gpt-image-2**(後段)。
- 正典: \`docs/drafts/arc-plot.md\`(物語) / \`economy-spec.md\`・\`v6-multiword-spec.md\`(機構=不変)。

## サマリ
| 軸 | 現在 | 目標 | 到達 |
|---|---|---|---|
| 章(配線済) | ${chaptersWired} | 9 | ${pct(chaptersWired, 9)} |
| 章(レビュー込・完了) | ${chaptersDone} | 9 | ${pct(chaptersDone, 9)} |
| 物語供給語(イベント) | ${sumSupply} | 603 | ${pct(sumSupply, 603)} |
| エンディング(コード実装) | ${endingsDone} | 4 | ${pct(endingsDone, 4)} |
| さしいれ | ${sashiireN} | ${SASHIIRE_TARGET} | ${pct(sashiireN, SASHIIRE_TARGET)} |
| シーン総数 | ${sumScenes} | ~218 (cap ${SCENE_BUDGET}) | ${pct(sumScenes, 218)} |
| 語彙DB | ${vocabN} | ${VOCAB_TARGET} | ${pct(vocabN, VOCAB_TARGET)} |

## 章別
凡例: ✅完了(配線+AIレビュー) / 🚧着手 / ⬜未着手。「配線」=シーン8割+全イベント供給+ゲート一致(機械判定)。
| 章 | 題 | 状態 | シーン | イベント | 供給語 | ゲート | 挿絵 | AIレビュー | 想定日 |
|---|---|:--:|---|---|---|:--:|---|:--:|---|
${rows.map((r) => `| ${r.n} | ${r.title} | ${r.sym} | ${r.sceneN}/${r.scenes} | ${r.eventN}/${r.events} | ${r.supplyN}/${r.supply} | ${r.gateOk ? '✓' : '—'}(≥${r.gate}) | ${r.art} | ${r.reviewed ? '✓' : '—'} | ${r.day} |`).join('\n')}

## エンディング(§6)
| END | 条件 | コード実装 |
|---|---|:--:|
${ENDINGS.map((e) => `| ${e.label} | ${e.cond} | ${endState(e.key).inCode ? '✓' : '—'} |`).join('\n')}

## 次に機械的に着手できるギャップ(人間の創作判断不要な順)
${nextGaps().map((g, i) => `${i + 1}. ${g}`).join('\n') || '(なし — 完結条件を満たした)'}

---
*この台帳は自走ループの停止条件(=完結検出)を担う。全章 ✅ かつ エンディング4/4 かつ 語彙${VOCAB_TARGET} で完結。*
`;

writeFileSync(OUT, md);
console.log(`✔ ${path.relative(ROOT, OUT)} を生成`);
console.log(`  章 配線 ${chaptersWired}/9・完了 ${chaptersDone}/9 / ED ${endingsDone}/4 / 語彙 ${vocabN}/${VOCAB_TARGET} / シーン ${sumScenes}`);
const complete = chaptersDone === 9 && endingsDone === 4 && vocabN >= VOCAB_TARGET && sashiireN >= SASHIIRE_TARGET;
console.log(complete ? '🎉 完結条件を満たしている' : `… 完結まで: ${nextGaps()[0] || ''}`);
if (process.argv.includes('--check') && !complete) process.exitCode = 1;
