import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { Run } from '../js/game.js';

function makeApp() {
  const p = defaultProfile();
  return { words: WORDS, index: buildIndex(WORDS), profile: p, save() {} };
}

// 1ランを全問正解でプレイし切る
function playRun(app, { correct = () => true } = {}) {
  const run = new Run(app);
  let step = run.startNode();
  let guard = 0;
  while (!step.finished) {
    assert.ok(guard++ < 500, '無限ループ');
    if (step.nodeCleared) {
      step = run.takeReward(step.rewards[0]?.id || null);
      continue;
    }
    const { item } = step;
    if (item.kind === 'study') {
      step = run.advance();
      continue;
    }
    const ok = correct(item);
    const idx = ok
      ? item.q.choices.findIndex((c) => c.correct)
      : item.q.choices.findIndex((c) => !c.correct);
    run.submit({ choiceIdx: idx, timeMs: 1500 });
    step = run.advance();
  }
  return { run, result: step };
}

test('初日: 全問正解でランを完走できる(コールドスタート)', () => {
  const app = makeApp();
  const { result } = playRun(app);
  assert.ok(result.finished);
  assert.ok(result.reviews > 10, `想起した言霊 ${result.reviews}`);
  assert.ok(result.introduced > 10, `新出 ${result.introduced}`);
  const seen = Object.values(app.profile.cards).filter((c) => c.reps > 0);
  assert.ok(seen.length >= result.reviews);
});

test('勝利すると宝箱がもらえて明日開く', () => {
  const app = makeApp();
  app.profile.settings.difficulty = 0;
  const { result } = playRun(app);
  if (result.win) {
    assert.equal(app.profile.chests.length, 1);
    assert.ok(result.chest.openDay > new Date().toISOString().slice(0, 10));
  }
  assert.ok(app.profile.streak.count >= 1);
});

test('誤答すると暴走再挑戦が来て、敗因に記録される', () => {
  const app = makeApp();
  let missed = null;
  const { run, result } = playRun(app, {
    correct: (item) => {
      if (!missed && !item.retry && item.kind === 'q') { missed = item.entry.w; return false; }
      return true;
    },
  });
  assert.ok(missed);
  assert.ok(run.misses.some((m) => m.entry.w === missed));
  const card = app.profile.cards[missed];
  assert.ok(card.lapses >= 0 && card.reps >= 1);
  void result;
});

test('設定したレベル・分野以外から新出は出ない', () => {
  const app = makeApp();
  app.profile.settings.levels = [4, 5];
  app.profile.settings.fields = ['business'];
  const { run } = playRun(app);
  for (const w of run.usedWords) {
    const e = app.index.byKey.get(w);
    assert.ok(e.l >= 4 && e.f === 'business', `${w} (L${e.l} ${e.f})`);
  }
});

test('2日目: 期日の言霊が優先して出題される', () => {
  const app = makeApp();
  playRun(app);
  // 全カードを「昨日学んだ」状態に巻き戻す
  for (const c of Object.values(app.profile.cards)) {
    c.last -= 3 * 86400000;
    c.due -= 3 * 86400000;
  }
  const dueWords = new Set(Object.entries(app.profile.cards).filter(([, c]) => c.due <= Date.now()).map(([w]) => w));
  assert.ok(dueWords.size > 0);
  const run2 = new Run(app);
  const step = run2.startNode();
  assert.ok(step.item, 'アイテムが返る');
  const qWords = run2.queue.filter((i) => i.kind === 'q' && !i.isNew).map((i) => i.entry.w);
  const dueInHand = qWords.filter((w) => dueWords.has(w));
  assert.ok(dueInHand.length >= 3, `期日語が手札に ${dueInHand.length}枚`);
});

test('新出の1日上限が効く(プール確保後)', () => {
  const app = makeApp();
  app.profile.settings.newPerDay = 8;
  playRun(app); // 初日は上限なし(15体まで確保)
  const seen1 = Object.values(app.profile.cards).filter((c) => c.reps > 0).length;
  assert.ok(seen1 >= 15, `初日 ${seen1}体`);
  // 2ラン目: 上限が効くので新出は8体以下に抑えられる
  const before = Object.values(app.profile.cards).filter((c) => c.reps > 0).length;
  playRun(app);
  const after = Object.values(app.profile.cards).filter((c) => c.reps > 0).length;
  assert.ok(after - before <= 8, `2ラン目の新出 ${after - before}`);
});
