// サブクエスト(任意供給トラック)の死守インバリアント。vocab-growth-design.md §4.2/§4.3 をコードで固定する。
// ここが緑なら: サブはメイン供給と衝突せず・実在語のみ・8語/本・章バインドが厳密・物語フラグ非干渉。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUBQUESTS } from '../data/subquests.js';
import { EVENTS } from '../data/events.js';
import { WORDS } from '../data/words.js';
import { SCENARIO } from '../js/scenario.js';

const teachOf = (ev) => ev.beats.flatMap((b) => (b.teach ? (Array.isArray(b.teach) ? b.teach : [b.teach]) : []));
const DB = new Set(WORDS.map((w) => w.w));
const SCENES = new Set(SCENARIO.scenes.map((s) => s.id));
const MAIN_SUPPLY = new Set(EVENTS.flatMap(teachOf)); // メイン cNN_* の供給語(衝突回避の母集合)
const FLAG_KEYS = ['yui', 'gaku', 'truth', 'route', 'ch', 'setFlag', 'flags', 'branch', 'branchOn'];

test('サブ: id 名前空間 sub_ ・別ファイル(EVENTSに混ざらない)', () => {
  const eventIds = new Set(EVENTS.map((e) => e.id));
  for (const s of SUBQUESTS) {
    assert.ok(s.id.startsWith('sub_'), `${s.id} は sub_ 始まりでない`);
    assert.ok(!eventIds.has(s.id), `${s.id} がメイン EVENTS と衝突`);
    assert.equal(s.track, 'sub');
  }
});

test('サブ: 章バインド厳密(chapter / unlockAfter / placementBefore が実在シーン)', () => {
  for (const s of SUBQUESTS) {
    assert.ok(Number.isInteger(s.chapter) && s.chapter >= 1 && s.chapter <= 9, `${s.id} chapter 不正`);
    assert.ok(SCENES.has(s.unlockAfter), `${s.id} unlockAfter=${s.unlockAfter} が未実在シーン`);
    assert.ok(SCENES.has(s.placementBefore), `${s.id} placementBefore=${s.placementBefore} が未実在シーン`);
    // unlockAfter は当該章、placementBefore は次章以降(=その進行度の物語に再生する窓)
    const ch2 = String(s.chapter).padStart(2, '0');
    assert.ok(s.unlockAfter.startsWith('c' + ch2), `${s.id} unlockAfter が章 ${s.chapter} 外`);
    assert.ok(s.unlockAfter < s.placementBefore, `${s.id} 窓が逆順`);
  }
});

test('サブ: 供給語=8語/本・実在語・本内重複なし', () => {
  for (const s of SUBQUESTS) {
    const t = teachOf(s);
    assert.equal(t.length, 8, `${s.id} 供給語が8語でない(${t.length})`);
    assert.equal(new Set(t).size, 8, `${s.id} 本内で供給語が重複`);
    for (const w of t) assert.ok(DB.has(w), `${s.id} 供給語 "${w}" が data/words.js に不在`);
  }
});

test('サブ: メイン供給語と衝突ゼロ(プール分割)', () => {
  for (const s of SUBQUESTS) {
    for (const w of teachOf(s)) {
      assert.ok(!MAIN_SUPPLY.has(w), `${s.id} 供給語 "${w}" がメイン cNN_* と衝突`);
    }
  }
});

test('サブ全体: 供給語はサブ間でも一意(プール分割の自己整合)', () => {
  const seen = new Set();
  for (const s of SUBQUESTS) {
    for (const w of teachOf(s)) {
      assert.ok(!seen.has(w), `供給語 "${w}" が複数サブで重複(${s.id})`);
      seen.add(w);
    }
  }
});

test('サブ: 物語フラグを増減しない(独立挿話)', () => {
  for (const s of SUBQUESTS) {
    const json = JSON.stringify(s);
    for (const k of FLAG_KEYS) {
      assert.ok(!json.includes(`"${k}"`), `${s.id} に物語フラグ系キー "${k}" が混入`);
    }
  }
});
