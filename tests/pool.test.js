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

test('詠唱ラッシュ: 25連でゲージ満タン→手動点火→正解で延長→終了後に残り火と余韻', () => {
  const app = makeApp(12);
  const pool = new Pool(app);
  pool.refill();
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const r = pool.tap(pool.cue.w);
    if (r.gaugeReady) ready = true;
  }
  assert.ok(ready, 'ゲージが満タンにならない');
  assert.equal(pool.mode, 'ready');
  assert.ok(pool.ignite(), '点火できない');
  assert.ok(pool.rushActive(), 'ラッシュ中でない');
  const end0 = pool.rushEndsAt;
  const r = pool.tap(pool.cue.w);
  assert.ok(r.rush && r.rush.mult >= CURVE.fever.mult, 'ラッシュ倍率が乗らない');
  assert.ok(pool.rushEndsAt > end0, '正解で延長されない');
  // 強制終了→残り火・余韻・連鎖窓
  pool.rushEndsAt = Date.now() - 1;
  const t = pool.tickSecond();
  assert.ok(t.rushEnded);
  assert.equal(pool.g, CURVE.fever.emberG);
  assert.ok(pool.afterglow(), '余韻が始まらない');
  assert.ok(pool.chainWindowUntil > Date.now(), '連鎖窓が開かない');
});



test('V_ref: タップするほど放置生産の参照値が追随して伸びる', () => {
  const app = makeApp(12, 3); // 高職位
  const pool = new Pool(app);
  pool.refill();
  const v0 = app.profile.vref;
  for (let i = 0; i < 200; i++) pool.tap(pool.cue.w);
  assert.ok(app.profile.vref > v0, `vrefが伸びない: ${v0} -> ${app.profile.vref}`);
});
