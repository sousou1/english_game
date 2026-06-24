import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTERY, masteryAns, canSublimate, pendingS, sublimate,
  isSublimated, sublimatedCount, canUndo, unsublimate, sublimatedWords, pickReviewWord,
} from '../js/mastery.js';

// words: { w: {reps, taps, S} } から最小プロフィールを作る
function P(words = {}) {
  const p = { cards: {}, taps: {}, mastery: { sub: {} } };
  for (const [w, v] of Object.entries(words)) {
    p.cards[w] = { reps: v.reps || 0, S: v.S || 0 };
    if (v.taps) p.taps[w] = v.taps;
  }
  return p;
}

test('習熟回数 ans = reps + min(taps, tapCap)', () => {
  assert.equal(masteryAns(P({ a: { reps: 10, taps: 5 } }), 'a'), 15);
  assert.equal(masteryAns(P({ a: { reps: 5, taps: 50 } }), 'a'), 5 + MASTERY.tapCap); // tapは頭打ち
  // 連打だけ(reps=0)では cap までしか伸びず、閾値30に届かない=SRSを必須化
  assert.ok(masteryAns(P({ a: { reps: 0, taps: 999 } }), 'a') < MASTERY.ansThreshold);
});

test('昇華可否: ans>=30 かつ 定着S>=sMin', () => {
  assert.equal(canSublimate(P({ a: { reps: 30, S: MASTERY.sMin } }), 'a'), true);
  assert.equal(canSublimate(P({ a: { reps: 20, S: 10 } }), 'a'), false); // ans不足
  const p = P({ a: { reps: 30, S: MASTERY.sMin - 4 } });
  assert.equal(canSublimate(p, 'a'), false); // S不足
  assert.equal(pendingS(p, 'a'), true);      // 回数は満ちたが定着待ち
  assert.equal(canSublimate(P({ a: { reps: 0, taps: 50 } }), 'a'), false); // 未学習
});

test('昇華 → 卒業状態・カウント・再昇華不可', () => {
  const p = P({ a: { reps: 30, S: 8 }, b: { reps: 30, S: 8 } });
  assert.equal(sublimate(p, 'a'), true);
  assert.equal(isSublimated(p, 'a'), true);
  assert.equal(sublimatedCount(p), 1);
  assert.equal(canSublimate(p, 'a'), false);          // 昇華済みは再度不可
  assert.equal(sublimate(P({}), 'x'), false);          // 未学習語は昇華不可
  sublimate(p, 'b');
  assert.deepEqual(sublimatedWords(p), ['a', 'b']);
});

test('取消はクールダウン窓(undoMs)内のみ', () => {
  const now = 1000000;
  const p = P({ a: { reps: 30, S: 8 } });
  sublimate(p, 'a', now);
  assert.equal(canUndo(p, 'a', now + 1000), true);
  assert.equal(canUndo(p, 'a', now + MASTERY.undoMs + 1), false);
  assert.equal(unsublimate(p, 'a', now + 1000), true);
  assert.equal(isSublimated(p, 'a'), false);
  const p2 = P({ a: { reps: 30, S: 8 } });
  sublimate(p2, 'a', now);
  assert.equal(unsublimate(p2, 'a', now + MASTERY.undoMs + 1), false); // 窓外は不可
  assert.equal(isSublimated(p2, 'a'), true);
});

test('pickReviewWord: 昇華語から lapses(+1) 重みで抽選(誤りやすい語ほど選ばれやすい)', () => {
  const p = P({ a: { reps: 30, S: 8 }, b: { reps: 30, S: 8 } });
  sublimate(p, 'a'); sublimate(p, 'b');
  const cards = { a: { lapses: 0 }, b: { lapses: 9 } }; // 重み a=1, b=10
  assert.equal(pickReviewWord(p, cards, () => 0), 'a');     // 先頭
  assert.equal(pickReviewWord(p, cards, () => 0.99), 'b');  // 重い側
  assert.equal(pickReviewWord(P({}), {}, () => 0.5), null); // 昇華語なし
});
