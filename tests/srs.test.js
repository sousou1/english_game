import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, review, retrievability, burst, rarityIndex, RARITY, DAY } from '../js/srs.js';

test('新カードの初回good: Sが数日になり期日が未来', () => {
  const now = Date.now();
  const c = review(newCard(now), 2, now);
  assert.equal(c.reps, 1);
  assert.ok(c.S >= 2 && c.S <= 4);
  assert.ok(c.due > now);
});

test('R(t)は単調減少し、t=SでR≈0.9', () => {
  const now = Date.now();
  const c = review(newCard(now), 2, now); // S≈3
  const r0 = retrievability(c, now + 0.1 * DAY);
  const rS = retrievability(c, now + c.S * DAY);
  const r2S = retrievability(c, now + 2 * c.S * DAY);
  assert.ok(r0 > rS && rS > r2S, '単調減少');
  assert.ok(Math.abs(rS - 0.9) < 0.02, `t=SでR=0.9のはずが ${rS}`);
});

test('成功で安定性が伸びる(期日想起で2倍以上)', () => {
  const now = Date.now();
  let c = review(newCard(now), 2, now);
  const s1 = c.S;
  c = review(c, 2, now + c.S * DAY); // 期日ちょうど(R≈0.9)
  assert.ok(c.S > s1 * 1.8, `S ${s1} -> ${c.S}`);
});

test('忘れかけ(R低)での成功は成長が大きい=望ましい困難', () => {
  const now = Date.now();
  const base = review(newCard(now), 2, now);
  const early = review({ ...base }, 2, now + 0.2 * base.S * DAY); // R高い
  const late = review({ ...base }, 2, now + 2.5 * base.S * DAY);  // R低い
  assert.ok(late.S > early.S, `late ${late.S} > early ${early.S}`);
});

test('失敗でSが縮み難易度が上がる', () => {
  const now = Date.now();
  let c = review(newCard(now), 2, now);
  c = review(c, 2, now + c.S * DAY);
  const sBig = c.S;
  const d0 = c.D;
  c = review(c, 0, now + 10 * DAY);
  assert.ok(c.S < sBig);
  assert.ok(c.D > d0);
  assert.equal(c.lapses, 1);
});

test('Sは365日でキャップ', () => {
  const now = Date.now();
  let c = review(newCard(now), 3, now);
  let t = now;
  for (let i = 0; i < 40; i++) {
    t += c.S * DAY;
    c = review(c, 3, t);
  }
  assert.ok(c.S <= 365);
});

test('再燃バースト: R=0.85でピーク、両端は低い', () => {
  const peak = burst(0.85);
  assert.ok(peak > 3.3 && peak <= 3.5);
  assert.ok(burst(0.99) < peak * 0.6, '覚えたて連打は旨味なし');
  assert.ok(burst(0.5) < 1.05, '放置しすぎも旨味なし');
  assert.ok(burst(0.85, 1.5) > peak, '火種ツールで強化');
});

test('レアリティは安定性で昇格する', () => {
  const now = Date.now();
  assert.equal(rarityIndex(newCard(now)), 0);
  let c = review(newCard(now), 2, now);
  assert.equal(rarityIndex(c), 0); // S≈3 → 錆鉄/青銅境界
  let t = now;
  for (let i = 0; i < 6; i++) { t += c.S * DAY; c = review(c, 2, t); }
  assert.ok(rarityIndex(c) >= 3, `S=${c.S} rarity=${rarityIndex(c)}`);
  assert.equal(RARITY.length, 5);
});
