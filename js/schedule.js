// 鐘(朝・昼・夜)と学習ステップ。srs.js は無改造のままラップする。
// - FSRSの復習期日は「次の鐘」に切り上げ量子化される → 想起時のRが完熟帯(0.85-0.90)に自然に入る
// - 新出語は 招く(提示のみ) → step1(+3分) → step2(次の鐘) → 卒業(初めて srs.review が走り S確定)
import { newCard, review, retrievability } from './srs.js';

export const BELLS = [
  { h: 8, m: 0, name: '朝の鐘' },
  { h: 13, m: 0, name: '昼の鐘' },
  { h: 19, m: 30, name: '夜の鐘' },
];

export const STEP1_DELAY = 3 * 60 * 1000; // 招いた3分後にもう一度

function bellTimesOf(dayTs) {
  const d = new Date(dayTs);
  return BELLS.map((b) => {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), b.h, b.m, 0, 0);
    return { ts: t.getTime(), name: b.name };
  });
}

// after より後の最初の鐘
export function nextBell(after = Date.now()) {
  for (const dayOffset of [0, 1]) {
    const bells = bellTimesOf(after + dayOffset * 86400000);
    for (const b of bells) if (b.ts > after) return b;
  }
  return bellTimesOf(after + 86400000)[0];
}

// 期日を「期日以降の最初の鐘」に切り上げる(期日がちょうど鐘なら当の鐘)
export function quantizeDue(due) {
  for (const dayOffset of [0, 1]) {
    const bells = bellTimesOf(due + dayOffset * 86400000);
    for (const b of bells) if (b.ts >= due) return b.ts;
  }
  return bellTimesOf(due + 86400000)[0].ts;
}

// 卒業済みカードが「うとうと」しているか(鐘で量子化した期日が来ているか)
export function isDrowsy(card, now = Date.now()) {
  if (!card || !card.reps) return false;
  return now >= quantizeDue(card.due);
}

// ---- 学習ステップ(卒業前の語の状態機械) ----
// stepState: { step: 1|2, due: ts, mikiri: bool }  … profile.steps[w] に保存

export function startSteps(now = Date.now()) {
  return { step: 1, due: now + STEP1_DELAY, mikiri: false };
}

// ステップ中の想起結果を反映。卒業したら {graduated: card} を返す
export function advanceStep(state, { correct, mikiri }, now = Date.now()) {
  if (!correct) {
    // 失敗: 同じステップを3分後にやり直す。罰ではなく再会
    return { state: { ...state, due: now + STEP1_DELAY, mikiri: false }, graduated: null };
  }
  if (state.step === 1) {
    // step2 は次の鐘(最低でも20分は空ける)
    const due = Math.max(quantizeDue(now + 1), now + 20 * 60 * 1000);
    return { state: { step: 2, due, mikiri: state.mikiri || !!mikiri }, graduated: null };
  }
  // step2 成功 → 卒業。ピンときた経歴があれば easy スタート(青銅=職人)、なければ good(見習い)
  const rating = state.mikiri || mikiri ? 3 : 2;
  const card = review(newCard(now), rating, now);
  return { state: null, graduated: card };
}

export function stepDueNow(state, now = Date.now()) {
  return !!state && now >= state.due;
}

// 「確かな想起」: 期日が来た後の正答で、失念リハビリ中でないもの。
// アンロック・章ゲートはすべてこの数で進む(当てずっぽう連打では進まない)
export function isSureRecall({ card, stepState, correct, now = Date.now() }) {
  if (!correct) return false;
  if (stepState) return now >= stepState.due; // ステップも期日後なら確か
  if (!card || !card.reps) return false;
  return isDrowsy(card, now) && !(card.postLapse > 0);
}

export { retrievability };
