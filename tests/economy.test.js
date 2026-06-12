import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { idleRate, settle, storageCap, manaCap, productionAt, timeToFull } from '../js/economy.js';
import { newCard, review, DAY } from '../js/srs.js';

const index = buildIndex(WORDS);

function makeProfile(nWords = 5, ageDays = 0) {
  const p = defaultProfile();
  p.facilities.fire = 1;
  const now = Date.now();
  for (const e of WORDS.slice(0, nWords)) {
    p.cards[e.w] = review(newCard(now - ageDays * DAY), 2, now - ageDays * DAY);
  }
  return p;
}

test('生産: 根づいた言霊ほどよく燃える(職位倍率)', () => {
  const e = WORDS[0];
  const now = Date.now();
  let c = review(newCard(now), 2, now); // S=2.5 見習い
  const r1 = idleRate(e, c);
  for (let i = 0, t = now; i < 6; i++) { t += c.S * DAY; c = review(c, 2, t); }
  const r2 = idleRate(e, c); // 黄金以上
  assert.ok(r2 >= r1 * 8, `${r1} -> ${r2}`);
});

test('精算は分割しても結果が同じ(決定論)', () => {
  const now = Date.now();
  const pA = makeProfile(8, 1);
  const pB = JSON.parse(JSON.stringify(pA));
  const span = 6 * 3600 * 1000;
  const whole = settle(pA, index, now - span, now);
  // 3分割
  let lightsB = pB.lights;
  let gainedB = 0;
  for (let i = 0; i < 3; i++) {
    const r = settle(pB, index, now - span + (span / 3) * i, now - span + (span / 3) * (i + 1));
    pB.lights = r.lights;
    for (const [w, m] of Object.entries(r.manaGained)) pB.mana[w] = (pB.mana[w] || 0) + m;
    gainedB += r.gained;
    lightsB = r.lights;
  }
  assert.ok(Math.abs(whole.gained - gainedB) < 1, `${whole.gained} vs ${gainedB}`);
});

test('精算: 棚の上限で止まり、上限を超えない', () => {
  const p = makeProfile(20, 1);
  const now = Date.now();
  const r = settle(p, index, now - 24 * 3600 * 1000, now);
  assert.ok(r.lights <= storageCap(p));
  if (r.lights >= storageCap(p)) assert.ok(r.cappedAt !== null);
});

test('熟成マナ: うとうと中だけ積もり、上限がある', () => {
  const p = makeProfile(3, 5); // 5日放置 → 全員期日超過
  const now = Date.now();
  const r = settle(p, index, now - 12 * 3600 * 1000, now);
  const words = Object.keys(p.cards);
  let total = 0;
  for (const w of words) {
    const m = r.manaGained[w] || 0;
    total += m;
    const e = index.byKey.get(w);
    assert.ok(m <= manaCap(e, p.cards[w]) + 0.01, `${w} mana ${m}`);
  }
  assert.ok(total > 0, 'うとうと中なのにマナが積もらない');
});

test('火がなければ生産ゼロ(不変条件: 灯火は想起の利息)', () => {
  const p = makeProfile(5, 0);
  p.facilities.fire = 0;
  const now = Date.now();
  assert.equal(productionAt(p, index, now).rate, 0);
  const r = settle(p, index, now - 3600 * 1000, now);
  assert.equal(r.gained, 0);
});

test('time-to-full: 生産があれば有限の時間を返す', () => {
  const p = makeProfile(8, 0);
  const now = Date.now();
  const ttf = timeToFull(p, index, now);
  assert.ok(ttf === 0 || (ttf > 0 && ttf < 7 * 24 * 3600 * 1000), `${ttf}`);
});
