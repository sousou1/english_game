// 死守インバリアント。自走ループでは“あなたの代わりの品質ゲート”になる(消費者として遊ぶ＝人間レビューなし)。
// ここが緑であるかぎり、エージェントの編集が以下の正典(arc-plot.md §11 / persona-director.md §E / economy・battle不変条件)を
// 黙って壊すことはない。データ/純粋関数だけを検証するので npm test(高速・オフライン)に同居できる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO } from '../js/scenario.js';
import { EVENTS } from '../data/events.js';
import { WORDS } from '../data/words.js';
import { FACILITIES, ownMult, storageCap, IDLE_K, TIER_MULT } from '../js/economy.js';
import { defaultProfile } from '../js/storage.js';
import { BATTLE, enemyHp } from '../js/battle.js';
import { buildIndex, clozeable } from '../js/quiz.js';
import { sublMult } from '../js/mastery.js';

// ── 文体規則(arc-plot §11.1): 1シーン 2〜8行。8行上限は絶対 ──
test('シーンは2〜8行(8行上限は絶対)', () => {
  const bad = SCENARIO.scenes.filter((s) => !Array.isArray(s.lines) || s.lines.length < 2 || s.lines.length > 8);
  assert.equal(bad.length, 0, `行数違反: ${bad.map((s) => `${s.id}(${s.lines?.length})`).join(', ')}`);
});

// ── 灯詞は必ず data/words.js の実在語(§11.7 / persona §E)。固有名詞は対象外 ──
test('イベントの詠唱語(teach/cast.answers)はすべて words.js に実在する', () => {
  const real = new Set(WORDS.map((w) => w.w));
  const offenders = [];
  for (const e of EVENTS) {
    for (const b of e.beats || []) {
      const words = [];
      if (typeof b.teach === 'string') words.push(b.teach);
      else if (Array.isArray(b.teach)) words.push(...b.teach);
      if (b.cast && Array.isArray(b.cast.answers)) words.push(...b.cast.answers);
      for (const w of words) if (!real.has(w)) offenders.push(`${e.id}: "${w}"`);
    }
  }
  assert.equal(offenders.length, 0, `実在しない詠唱語: ${offenders.join(', ')}`);
});

// ── フラグは加算のみ・yui/gaku 限定・負効果ゼロ(§5.1) ──
test('選択肢フラグは加算のみ(yui/gaku +n)で、負効果は存在しない', () => {
  const ok = /^(yui|gaku)\+[1-9]$/;
  // truth は arc-plot §5.1 の正典フラグ(5章末初出・bool)。加算でなく真偽だが「負効果ゼロ」は満たす
  // (一度 true を立てるのみ・何も減じない)。
  const okBool = /^(truth)$/;
  // route は arc-plot §5.1/§5.3 の正典フラグ(7章末確定・enum hero|yui|quiet)。値の設定のみ・何も減じない。
  const okEnum = /^route=(hero|yui|quiet)$/;
  const bad = [];
  let yuiCh1 = 0;
  for (const s of SCENARIO.scenes) {
    for (const o of (s.choice && s.choice.options) || []) {
      const f = o.flag || '';
      if (f === '') continue;
      if (!ok.test(f) && !okBool.test(f) && !okEnum.test(f)) bad.push(`${s.id}:"${f}"`);
      if (s.id.startsWith('c01_') && f.startsWith('yui')) yuiCh1++;
    }
  }
  assert.equal(bad.length, 0, `不正なフラグ(加算のみ/yui|gaku/負効果ゼロ違反): ${bad.join(', ')}`);
  assert.equal(yuiCh1, 3, `第1章のyui加点は計3箇所のはず(現${yuiCh1})`);
});

// ── 経済・戦闘の数値は不変(arc-plot §10「数値は一切変えない」)。スナップショットで凍結 ──
test('経済の正典数値が凍結されている', () => {
  assert.equal(IDLE_K, 0.21, '放置生産係数 IDLE_K が変わった');
  assert.deepEqual(TIER_MULT, [1, 2, 4, 8, 16], 'ティア倍率が変わった');
  // 所持マイルストーン ×2(10/25/50/100/200)
  assert.deepEqual([9, 10, 25, 50, 100, 200].map(ownMult), [1, 2, 4, 8, 16, 32]);
  // 序盤の貯蔵床値60(生産ゼロの既定プロフィール)
  assert.equal(storageCap(defaultProfile()), 60, '貯蔵の床値60が変わった');
  // 施設ティア間コスト ×12(写本機/小妖精)、火の入りコスト10
  const fairy = FACILITIES.find((f) => f.id === 'fairy');
  const scribe = FACILITIES.find((f) => f.id === 'scribe');
  const fire = FACILITIES.find((f) => f.id === 'fire');
  assert.equal(scribe.base / fairy.base, 12, 'ティア間コスト×12が変わった');
  assert.equal(fire.base, 10, '火の入りコストが変わった');
});

test('昇華係数 sublMult: 無昇華で1.0(現行と完全一致)・節目で×2', () => {
  assert.equal(sublMult(0), 1, '無昇華時に経済が変わってはいけない(globalMult 不変)');
  assert.equal(sublMult(4), 1); // 最初の節目(5)未満
  assert.equal(sublMult(5), 2);
  assert.equal(sublMult(100), 32); // 全5節目(×2^5)
});

test('詠唱バトルの正典数値が凍結されている', () => {
  assert.deepEqual(BATTLE.chapterBosses, [20, 50, 90, 140], '章ボス位置が変わった');
  assert.equal(BATTLE.bossEvery, 5, '中ボス間隔が変わった');
  assert.equal(enemyHp(0), 30, '敵HP初期値(検証済み注文式)が変わった');
  // 中ボス(n=5)は直前の通常進行の2倍超のスパイク(×3演出)。ボスでHPは跳ね、直後に通常値へ戻る。
  assert.ok(enemyHp(4) > enemyHp(3) * 2, '中ボスHPスパイクが消えた');
  // 基底カーブは増加(非ボス点で比較。n=multiple of5 や章ボスは×倍率で跳ねるため除外)
  const nonBoss = [0, 1, 2, 5, 6, 10, 20, 30]; // n = k+1 が 5の倍数でも章ボスでもない位置
  for (let i = 1; i < nonBoss.length; i++) {
    assert.ok(enemyHp(nonBoss[i]) > enemyHp(nonBoss[i - 1]), `敵HP基底カーブが増加でない: k=${nonBoss[i]}`);
  }
});

// ── シナリオ整合(章を増やすたびに配線ミスを機械検出。第2章配線で追加) ──
// next・choice.options[].next・ED分岐(branch={値:行き先}・終章 §6)のすべてを辺として辿る
const sceneNexts = (s) => [
  s.next,
  ...((s.choice && s.choice.options) || []).map((o) => o.next),
  ...(s.branch ? Object.values(s.branch) : []),
].filter(Boolean);

test('シーン/イベントの参照がすべて解決する(next・choice.next・event.gate.read)', () => {
  const ids = new Set(SCENARIO.scenes.map((s) => s.id));
  const dangling = [];
  for (const s of SCENARIO.scenes) for (const n of sceneNexts(s)) if (n !== 'end' && !ids.has(n)) dangling.push(`${s.id}->${n}`);
  for (const e of EVENTS) if (e.gate && e.gate.read && !ids.has(e.gate.read)) dangling.push(`${e.id}.gate.read=${e.gate.read}`);
  assert.equal(dangling.length, 0, `未解決の参照: ${dangling.join(', ')}`);
});

test('全シーンが SCENARIO.start から到達可能(孤立島なし=章跨ぎ連結を保証)', () => {
  const seen = new Set();
  const stack = [SCENARIO.start];
  while (stack.length) {
    const id = stack.pop();
    if (id === 'end' || seen.has(id)) continue;
    seen.add(id);
    const s = SCENARIO.scenes.find((x) => x.id === id);
    if (s) for (const n of sceneNexts(s)) stack.push(n);
  }
  const unreached = SCENARIO.scenes.filter((s) => !seen.has(s.id)).map((s) => s.id);
  assert.equal(unreached.length, 0, `到達不能なシーン: ${unreached.join(', ')}`);
});

test('章ゲート(settled)は arc-plot の段を昇順で踏む', () => {
  const CANON = [15, 40, 90, 150, 220, 290, 360, 420, 450]; // arc-plot §4
  const gates = SCENARIO.scenes.filter((s) => s.gate && typeof s.gate.settled === 'number').map((s) => s.gate.settled);
  for (let i = 1; i < gates.length; i++) assert.ok(gates[i] >= gates[i - 1], `章ゲートが昇順でない: ${gates.join(',')}`);
  assert.deepEqual(gates, CANON.slice(0, gates.length), `章ゲート値が正典と不一致: ${gates.join(',')}`);
});

test('各イベントの新語供給はちょうど8語、語は一度しか供給されない(v6・衝突ゼロ)', () => {
  const owner = new Map();
  const dups = [];
  for (const e of EVENTS) {
    const sup = new Set();
    for (const b of e.beats || []) {
      if (typeof b.teach === 'string') sup.add(b.teach);
      else if (Array.isArray(b.teach)) for (const w of b.teach) sup.add(w);
      for (const a of (b.cast && b.cast.answers) || []) sup.add(a);
    }
    assert.equal(sup.size, 8, `${e.id} の供給語が8でない: ${sup.size}`);
    for (const w of sup) { if (owner.has(w)) dups.push(`${w}(${owner.get(w)}&${e.id})`); else owner.set(w, e.id); }
  }
  assert.equal(dups.length, 0, `複数イベントで供給される語(衝突): ${dups.join(', ')}`);
});

// ── 全イベント語は英文cloze可(B2: 1語ずつ英文cloze化の前提。例文に原形が無いと和文に落ちて切替バグになる) ──
test('イベントの新語はすべて clozeable(例文に原形を含む)', () => {
  const idx = buildIndex(WORDS);
  const words = new Set();
  for (const e of EVENTS) for (const b of e.beats || []) {
    if (typeof b.teach === 'string') words.add(b.teach);
    else if (Array.isArray(b.teach)) for (const w of b.teach) words.add(w);
    for (const a of (b.cast && b.cast.answers) || []) words.add(a);
  }
  const bad = [...words].filter((w) => { const e = idx.byKey.get(w); return !e || !clozeable(e); });
  assert.equal(bad.length, 0, `英文clozeにならない語(例文に原形が無い→和文フォールバックで切替バグ): ${bad.join(', ')}`);
});
