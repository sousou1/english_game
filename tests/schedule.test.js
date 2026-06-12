import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextBell, quantizeDue, isDrowsy, startSteps, advanceStep, stepDueNow, isSureRecall } from '../js/schedule.js';
import { newCard, review, DAY } from '../js/srs.js';

const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };

test('鐘: 期日は次の鐘に切り上げられる', () => {
  const due = at(9, 30); // 朝(8:00)の後 → 昼(13:00)へ
  assert.equal(new Date(quantizeDue(due)).getHours(), 13);
  const due2 = at(20, 0); // 夜(19:30)の後 → 翌朝8:00へ
  const q2 = new Date(quantizeDue(due2));
  assert.equal(q2.getHours(), 8);
  const due3 = at(13, 0); // ちょうど鐘 → 当の鐘
  assert.equal(new Date(quantizeDue(due3)).getHours(), 13);
});

test('nextBell は常に未来の鐘を返す', () => {
  for (const h of [0, 7, 8, 12, 13, 19, 23]) {
    const b = nextBell(at(h, 5));
    assert.ok(b.ts > at(h, 5));
  }
});

test('うとうと判定: 量子化した期日が来るまでは眠らない', () => {
  const now = at(9, 0);
  const c = review(newCard(now - 3 * DAY), 2, now - 3 * DAY); // S=2.5 → 期日は過ぎている
  assert.ok(isDrowsy(c, now + DAY));
  const fresh = review(newCard(now), 2, now); // 期日は2.5日後
  assert.ok(!isDrowsy(fresh, now));
});

test('学習ステップ: 招く→3分後step1→次の鐘step2→卒業', () => {
  const now = Date.now();
  let s = startSteps(now);
  assert.equal(s.step, 1);
  assert.ok(!stepDueNow(s, now));
  assert.ok(stepDueNow(s, now + 4 * 60000));

  // step1成功 → step2は最低20分先
  let r = advanceStep(s, { correct: true }, now + 4 * 60000);
  assert.equal(r.state.step, 2);
  assert.ok(r.state.due >= now + 4 * 60000 + 20 * 60000);
  assert.equal(r.graduated, null);

  // step2成功 → 卒業(S=2.5の見習い)
  r = advanceStep(r.state, { correct: true }, r.state.due + 1000);
  assert.ok(r.graduated);
  assert.ok(Math.abs(r.graduated.S - 2.5) < 0.01);

  // ピンときた卒業はS=7(職人スタート)
  let s2 = { step: 2, due: now, mikiri: true };
  const r2 = advanceStep(s2, { correct: true }, now);
  assert.equal(r2.graduated.S, 7);
});

test('ステップ失敗は同ステップを3分後にやり直し(罰なし)', () => {
  const now = Date.now();
  const s = { step: 2, due: now, mikiri: false };
  const r = advanceStep(s, { correct: false }, now);
  assert.equal(r.state.step, 2);
  assert.ok(r.state.due > now);
  assert.equal(r.graduated, null);
});

test('確かな想起: 期日前の連打や失念リハビリ中はカウントしない', () => {
  const now = Date.now();
  const fresh = review(newCard(now), 2, now);
  assert.ok(!isSureRecall({ card: fresh, stepState: null, correct: true, now })); // 期日前
  const old = review(newCard(now - 5 * DAY), 2, now - 5 * DAY);
  assert.ok(isSureRecall({ card: old, stepState: null, correct: true, now })); // 期日後
  const lapsed = { ...old, postLapse: 1 };
  assert.ok(!isSureRecall({ card: lapsed, stepState: null, correct: true, now }));
  assert.ok(!isSureRecall({ card: old, stepState: null, correct: false, now }));
});
