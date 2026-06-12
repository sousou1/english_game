import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { idlePerMin, ownMult, totalPower, settle, storageCap, capMinutes, productionAt, timeToFull, FACILITIES, facilityPrice } from '../js/economy.js';
import { newCard, review, DAY } from '../js/srs.js';

const index = buildIndex(WORDS);

function makeProfile({ nWords = 8, ageDays = 0, fairies = 3, vref = 2 } = {}) {
  const p = defaultProfile();
  p.facilities.fire = 1;
  p.facilities.fairy = fairies;
  p.vref = vref;
  const now = Date.now();
  for (const e of WORDS.slice(0, nWords)) {
    p.cards[e.w] = review(newCard(now - ageDays * DAY), 2, now - ageDays * DAY);
  }
  return p;
}

test('放置生産はタップ価値(vref)に従属し、log圧縮される', () => {
  const p = makeProfile({ vref: 2, fairies: 3 });
  const r1 = idlePerMin(p);
  assert.ok(r1 > 0);
  // vrefが10倍なら生産も10倍(比例)
  p.vref = 20;
  assert.ok(Math.abs(idlePerMin(p) - r1 * 10) < 0.001);
  // パワーを100倍にしても生産はlog圧縮でずっと小さい伸び
  p.vref = 2;
  p.facilities.fairy = 300;
  const r2 = idlePerMin(p);
  assert.ok(r2 / r1 < 30, `log圧縮が効いていない: ×${(r2 / r1).toFixed(1)}`);
});

test('火または生産施設がなければ放置生産ゼロ(不変条件)', () => {
  const p = makeProfile();
  p.facilities.fire = 0;
  assert.equal(idlePerMin(p), 0);
  p.facilities.fire = 1;
  p.facilities.fairy = 0;
  assert.equal(idlePerMin(p), 0);
});

test('所持マイルストーン: 10/25/50/100/200台で×2', () => {
  assert.equal(ownMult(9), 1);
  assert.equal(ownMult(10), 2);
  assert.equal(ownMult(25), 4);
  assert.equal(ownMult(200), 32);
  const p = makeProfile({ fairies: 10 });
  assert.equal(totalPower(p), 10 * 1 * 2);
});

test('施設コスト: 等比成長し、ティア間は約×12', () => {
  const fairy = FACILITIES.find((f) => f.id === 'fairy');
  const scribe = FACILITIES.find((f) => f.id === 'scribe');
  assert.ok(Math.abs(facilityPrice(fairy, 5) / (fairy.base * Math.pow(1.10, 5)) - 1) < 0.01);
  assert.ok(scribe.base / fairy.base >= 10 && scribe.base / fairy.base <= 14);
});

test('貯蔵上限は生産に比例(満タンまでの時間を買う)、小規模では床値60', () => {
  const small = makeProfile();
  assert.equal(storageCap(small), 60, '序盤の床値が効いていない');
  const p = makeProfile({ vref: 10, fairies: 20 });
  assert.ok(Math.abs(storageCap(p) - idlePerMin(p) * capMinutes(p)) <= 1);
  p.facilities.shelf = 1;
  assert.ok(capMinutes(p) > 45 * 2, '棚で満タン時間が伸びない');
});

test('精算は分割しても結果が同じ(決定論)', () => {
  const now = Date.now();
  const pA = makeProfile({ nWords: 8, ageDays: 1 });
  const pB = JSON.parse(JSON.stringify(pA));
  const span = 6 * 3600 * 1000;
  const whole = settle(pA, index, now - span, now);
  let gainedB = 0;
  for (let i = 0; i < 3; i++) {
    const r = settle(pB, index, now - span + (span / 3) * i, now - span + (span / 3) * (i + 1));
    pB.lights = r.lights;
    for (const [w, m] of Object.entries(r.manaGained)) pB.mana[w] = (pB.mana[w] || 0) + m;
    gainedB += r.gained;
  }
  assert.ok(Math.abs(whole.gained - gainedB) < 1, `${whole.gained} vs ${gainedB}`);
});

test('精算: 棚の上限で止まる', () => {
  const p = makeProfile({ nWords: 8, ageDays: 1 });
  const now = Date.now();
  const r = settle(p, index, now - 24 * 3600 * 1000, now);
  assert.ok(r.lights <= storageCap(p) + 0.01);
  assert.ok(r.cappedAt !== null, '24時間放置で棚が満ちないのは設計外');
});

test('熟成マナ: うとうとの取り分が積もり、上限がある', () => {
  const p = makeProfile({ nWords: 5, ageDays: 5 }); // 全員期日超過
  const now = Date.now();
  const r = settle(p, index, now - 12 * 3600 * 1000, now);
  const total = Object.values(r.manaGained).reduce((a, b) => a + b, 0);
  assert.ok(total > 0, 'マナが積もらない');
  const perCap = (idlePerMin(p) * 0.4 / 5) * 420;
  for (const m of Object.values(r.manaGained)) assert.ok(m <= perCap + 0.01);
});

test('アクティブ:アイドル比が帯域内(タップ10分 vs 放置8時間)', () => {
  // vref=平均タップ価値。10分=420タップ(0.7/秒)×vref×1.5(コンボ平均)
  const p = makeProfile({ vref: 10, fairies: 20 });
  const active10min = 0.7 * 600 * p.vref * 1.5;
  const idle8h = idlePerMin(p) * 480;
  const ratio = active10min / idle8h;
  assert.ok(ratio > 0.3 && ratio < 30, `A/I比が帯域外: ${ratio.toFixed(2)}`);
});

test('timeToFull: 生産があれば有限', () => {
  const p = makeProfile();
  const ttf = timeToFull(p, index, Date.now());
  assert.ok(ttf === 0 || (ttf > 0 && ttf < 48 * 3600 * 1000));
});
