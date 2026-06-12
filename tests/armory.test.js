import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { ARMORY } from '../data/weapons.js';
import {
  gradeMult, weaponMult, armoryMult, codexMult, equipped, equippedEffects,
  dropRoll, pushBox, openDrop, enhance, enhanceCost, salvage, weaponDef,
} from '../js/armory.js';
import { JOBS, currentJob, jobMod, jobUnlocked } from '../js/jobs.js';
import { letterAvailable, readLetter, consumeLetterBuff, nonoJoined } from '../js/party.js';

function makeApp() {
  const p = defaultProfile();
  return { words: WORDS, index: buildIndex(WORDS), profile: p, save() {} };
}

test('グレード曲線: 旧武器曲線と同一勾配(×2が5段→×1.5)', () => {
  assert.equal(gradeMult(0), 1);
  assert.equal(gradeMult(1), 2);
  assert.equal(gradeMult(5), 32);
  assert.equal(gradeMult(6), 48);
  assert.equal(gradeMult(7), 72);
});

test('武器倍率: レア基礎×グレード×(1+0.02Lv)', () => {
  const w = { wid: 'w_oak', rar: 'SSR', grade: 2, lv: 10 };
  assert.ok(Math.abs(weaponMult(w) - 1.30 * 4 * 1.2) < 1e-9);
});

test('初期プロフィール: 樫の杖N装備・図鑑1件・armoryMultは有限', () => {
  const p = defaultProfile();
  const eq = equipped(p);
  assert.ok(eq, '初期装備がない');
  assert.equal(eq.wid, 'w_oak');
  assert.equal(codexMult(p), 1 + ARMORY.codex.perEntry);
  assert.ok(Math.abs(armoryMult(p) - 0.85 * codexMult(p)) < 1e-9);
});

test('天井: ドロップ25回でSSR確定・カウンタはリセット', () => {
  const p = defaultProfile();
  p.armory.pity = ARMORY.dropTable.pity - 1;
  const roll = dropRoll(p, 'mid'); // midは100%ドロップ
  assert.ok(roll, '中ボスでドロップしない');
  assert.equal(roll.rar, 'SSR', '天井でSSRにならない');
  assert.equal(p.armory.pity, 0, '天井後にカウンタが残る');
});

test('ドロップ: グレードは討伐数/10で焼き込み・章ボス枠は高レア', () => {
  const p = defaultProfile();
  p.battle.kills = 37;
  const roll = dropRoll(p, 'mid');
  assert.equal(roll.grade, 3);
  for (let i = 0; i < 20; i++) {
    const c = dropRoll(p, 'chapter', 0);
    assert.ok(['SR', 'SSR'].includes(c.rar), '章ボス1枠目がSR未満');
  }
});

test('レア下限: SSR専用銘はN/Rドロップに混ざらない', () => {
  const p = defaultProfile();
  for (let i = 0; i < 60; i++) {
    p.armory.pity = 0;
    const roll = dropRoll(p, 'mid');
    if (roll.rar === 'N' || roll.rar === 'R') {
      const def = weaponDef(roll.wid);
      assert.ok(!def.rarMin || def.rarMin === 'R', `${roll.rar}で${def.id}が出た`);
    }
  }
});

test('回収箱: FIFOで10件まで・開封で初期サブステ付与+図鑑登録', () => {
  const p = defaultProfile();
  for (let i = 0; i < 12; i++) pushBox(p, { wid: 'w_bluefire', rar: 'SSR', grade: 0 });
  assert.equal(p.armory.box.length, ARMORY.inventory.box, '箱が10件を超えた');
  const uid = p.armory.box[0].uid;
  const r = openDrop(p, uid);
  assert.ok(r.isNew, '初入手なのに図鑑が増えない');
  assert.equal(r.item.subs.length, ARMORY.rarities.SSR.subInit, 'SSRの初期サブステが3でない');
  assert.ok(p.armory.codex.includes('w_bluefire:SSR'));
  assert.equal(p.armory.box.length, ARMORY.inventory.box - 1);
});

test('強化: Lv4の倍数でサブステイベント・コストは漸増', () => {
  const p = defaultProfile();
  p.gold = 1e9;
  pushBox(p, { wid: 'w_oak', rar: 'N', grade: 0 });
  const { item } = openDrop(p, p.armory.box[0].uid);
  const c0 = enhanceCost(p, item);
  assert.ok(c0 >= 10);
  let subEvents = 0;
  for (let i = 0; i < 8; i++) {
    const r = enhance(p, item.uid);
    assert.ok(r, `Lv${i + 1}強化に失敗`);
    if (r.sub) subEvents++;
  }
  assert.equal(item.lv, 8);
  assert.equal(subEvents, 2, 'Lv4/Lv8のサブステイベントが起きない');
  assert.ok(enhanceCost(p, item) > c0, '強化コストが増えない');
});

test('分解: 装備中は不可・砥石+投資30%返却・図鑑は残る', () => {
  const p = defaultProfile();
  assert.equal(salvage(p, p.armory.equip), null, '装備中の武器を分解できてしまう');
  p.gold = 1e9;
  pushBox(p, { wid: 'w_dagger', rar: 'SR', grade: 0 });
  const { item } = openDrop(p, p.armory.box[0].uid);
  for (let i = 0; i < 4; i++) enhance(p, item.uid);
  const goldBefore = p.gold;
  const r = salvage(p, item.uid);
  assert.equal(r.whet, ARMORY.rarities.SR.whet);
  assert.equal(p.gold - goldBefore, Math.round(item.spent * ARMORY.salvage.goldRefund));
  assert.ok(p.armory.codex.includes('w_dagger:SR'), '分解で図鑑が消えた');
  assert.ok(!p.armory.inv.find((w) => w.uid === item.uid));
});

test('装備効果キャップ: 被ダメ−50%・ゴールド+100%・ラッシュ+8秒で頭打ち', () => {
  const p = defaultProfile();
  pushBox(p, { wid: 'w_dragonbone', rar: 'SSR', grade: 0 });
  const { item } = openDrop(p, p.armory.box[0].uid);
  item.subs = [
    { id: 'bossGuard', rolls: [1, 1, 1, 1, 1, 1, 1] },   // 0.56 + 特性0.25
    { id: 'goldGain', rolls: Array(15).fill(1) },          // 1.5
    { id: 'rushExt', rolls: Array(12).fill(1) },           // 12秒
  ];
  p.armory.equip = item.uid;
  const fx = equippedEffects(p);
  assert.equal(fx.bossGuard, ARMORY.caps.dmgReduce);
  assert.equal(fx.goldGain, ARMORY.caps.goldBonus);
  assert.equal(fx.rushExt, ARMORY.caps.rushExtMs / 1000);
});

test('ジョブ: 初期は剣士・解禁条件・jobModフォールバック', () => {
  const p = defaultProfile();
  assert.equal(currentJob(p).id, 'swordsman');
  assert.equal(jobMod(p, 'comboCap', 50), 70);
  assert.equal(jobMod(p, 'gaugeMax', 25), 25, 'フォールバックが効かない');
  const mage = JOBS.find((j) => j.id === 'mage');
  assert.ok(!jobUnlocked(p, mage, 0));
  p.battle.kills = 20;
  assert.ok(jobUnlocked(p, mage, 0));
  const hunter = JOBS.find((j) => j.id === 'hunter');
  assert.ok(!jobUnlocked(p, hunter, 89));
  assert.ok(jobUnlocked(p, hunter, 90));
});

test('ノノの文通: 加入後は日に1通・バフは一度きり消費', () => {
  const p = defaultProfile();
  assert.ok(!nonoJoined(p));
  assert.ok(!letterAvailable(p), '未加入で手紙が来た');
  p.battle.kills = 20;
  assert.ok(nonoJoined(p));
  assert.ok(letterAvailable(p));
  const text = readLetter(p);
  assert.ok(text && text.includes('ノノ'));
  assert.ok(!letterAvailable(p), '同日に2通読めてしまう');
  assert.equal(consumeLetterBuff(p), 0.15);
  assert.equal(consumeLetterBuff(p), 0, 'バフが2回消費できてしまう');
});
