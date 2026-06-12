import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { Pool, CURVE } from '../js/pool.js';
import { newCard, review, DAY } from '../js/srs.js';

function makeApp(nWords = 10, tier = 0) {
  const p = defaultProfile();
  const now = Date.now();
  for (const e of WORDS.slice(0, nWords)) {
    let c = review(newCard(now), tier >= 1 ? 3 : 2, now); // tier1ならS=7(職人)
    if (tier >= 3) c = { ...c, S: 40 }; // 黄金相当
    p.cards[e.w] = c;
  }
  return { words: WORDS, index: buildIndex(WORDS), profile: p, save() {} };
}

test('覚えた語が3未満ならプールは開かない(言葉がなければ配れない)', () => {
  const app = makeApp(2);
  const pool = new Pool(app);
  assert.ok(!pool.available());
  pool.refill();
  assert.equal(pool.cue, null);
});

test('プール: お題は必ずタイルの中にあり、正タップだけが進む', () => {
  const app = makeApp(12);
  const pool = new Pool(app);
  pool.refill();
  assert.ok(pool.tiles.some((e) => e.w === pool.cue.w), 'お題がプールにいない');
  const wrong = pool.tiles.find((e) => e.w !== pool.cue.w);
  const r1 = pool.tap(wrong.w);
  assert.ok(!r1.correct);
  assert.equal(r1.gain, 0);
  const r2 = pool.tap(pool.cue.w);
  assert.ok(r2.correct);
  assert.ok(r2.gain >= 1);
  assert.ok(pool.tiles.some((e) => e.w === pool.cue.w), '次のお題がプールにいない');
});

test('誤タップはコンボが切れるだけ(SRSカードに書き込まない)', () => {
  const app = makeApp(10);
  const pool = new Pool(app);
  pool.refill();
  const before = JSON.stringify(app.profile.cards);
  pool.tap(pool.cue.w);
  const wrong = pool.tiles.find((e) => e.w !== pool.cue.w);
  pool.tap(wrong.w);
  assert.equal(pool.combo, 0);
  assert.equal(JSON.stringify(app.profile.cards), before, 'タップがSRSを汚した');
});

test('語の価値: 職位とタップマイルストーンで増える(インフレのエンジン=語彙)', () => {
  const appLow = makeApp(5, 0);
  const poolLow = new Pool(appLow);
  const e = WORDS[0];
  const v0 = poolLow.wordValue(e);
  // 職位が上がると増える
  const appHigh = makeApp(5, 3);
  const poolHigh = new Pool(appHigh);
  assert.ok(poolHigh.wordValue(e) >= v0 * 8, '職位倍率が効いていない');
  // タップマイルストーンで×2
  appLow.profile.taps[e.w] = CURVE.milestones[0];
  assert.equal(poolLow.wordValue(e), v0 * CURVE.milestoneMult);
});

test('コンボとフィーバー: 連続正解で倍率が伸び、上限がある', () => {
  const app = makeApp(12);
  const pool = new Pool(app);
  pool.refill();
  let fevered = false;
  for (let i = 0; i < 60; i++) {
    const r = pool.tap(pool.cue.w);
    assert.ok(r.correct);
    if (r.fever) fevered = true;
  }
  assert.ok(fevered, 'フィーバーが発火しない');
  assert.ok(pool.comboMult() <= (1 + CURVE.comboCap * CURVE.comboStep) * CURVE.feverMult + 0.01);
});

test('注文: 仕事量(獲得灯火)で進み、5注文ごとに大注文(要求×3)が来る', () => {
  const app = makeApp(12);
  const pool = new Pool(app);
  pool.refill();
  const t0 = pool.orderTarget();
  let done = null;
  for (let i = 0; i < 2000 && !done; i++) {
    const r = pool.tap(pool.cue.w);
    if (r.orderDone) done = r.orderDone;
  }
  assert.ok(done, '注文が完了しない');
  assert.ok(done.reward >= Math.round(t0 * 0.5) - 1, '報酬が要求の50%でない');
  assert.ok(pool.orderTarget() > t0, '次の注文が大きくない');
  // 5注文目は大注文(要求×3)
  app.profile.order.n = 4; // 次が5番目
  const big = pool.orderTarget();
  app.profile.order.n = 5;
  const normal6 = pool.orderTarget();
  assert.ok(big > normal6, `大注文(${big})が直後の通常注文(${normal6})より小さい`);
});

test('V_ref: タップするほど放置生産の参照値が追随して伸びる', () => {
  const app = makeApp(12, 3); // 高職位
  const pool = new Pool(app);
  pool.refill();
  const v0 = app.profile.vref;
  for (let i = 0; i < 200; i++) pool.tap(pool.cue.w);
  assert.ok(app.profile.vref > v0, `vrefが伸びない: ${v0} -> ${app.profile.vref}`);
});
