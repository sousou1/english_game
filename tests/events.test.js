import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { newCard, review } from '../js/srs.js';
import { EventRun } from '../js/events.js';
import { enemyHp } from '../js/battle.js';

function makeApp() {
  const p = defaultProfile();
  return { words: WORDS, index: buildIndex(WORDS), profile: p, save() {} };
}

const FIXTURE = {
  id: 'ev_test', chapter: 1, title: 'テスト', art: 'ev_test', tier: 1,
  gate: { read: 'c01_010' },
  intro: ['導入1', '導入2'],
  beats: [
    { lines: ['場面1'], teach: 'water', cast: { jp: '水よ来い', answer: 'water' } },
    { lines: ['場面2'], teach: 'walk', cast: { jp: '歩け', answer: 'walk' } },
    { lines: ['場面3'], review: true, castLine: 'おぼえた言葉で道を開く' },
  ],
  outro: ['結び'],
};

test('イベント: ステップ線形化(intro→teach→cast→…→clear)と進捗', () => {
  const app = makeApp();
  const run = new EventRun(app, FIXTURE);
  const kinds = run.steps.map((s) => s.t);
  assert.equal(kinds[0], 'lines');
  assert.ok(kinds.includes('teach'));
  assert.equal(kinds[kinds.length - 1], 'clear');
  // 既習語ゼロ → reviewビートは静かに飛ぶ(序盤救済)
  assert.equal(run.steps.filter((s) => s.t === 'cast').length, 2);
  assert.equal(run.progress().total, 2);
});

test('イベント: 誤答はその場でやり直し(ペナルティなし)、正答だけ前進', () => {
  const app = makeApp();
  const run = new EventRun(app, FIXTURE);
  while (run.cur().t !== 'cast') run.next();
  const idx = run.idx;
  const r1 = run.answer('wrong_word');
  assert.equal(r1.correct, false);
  assert.equal(run.idx, idx, '誤答で進んでしまった');
  const r2 = run.answer(run.cur().entries[0].w);
  assert.equal(r2.correct, true);
  assert.ok(run.idx > idx);
});

test('イベント: 選択肢に正解がちょうど1つ・4択', () => {
  const app = makeApp();
  const run = new EventRun(app, FIXTURE);
  for (const s of run.steps.filter((x) => x.t === 'cast')) {
    assert.equal(s.choices.length, 4);
    assert.equal(s.choices.filter((c) => c.w === s.entries[0].w).length, 1);
  }
});

test('イベント: tier2は6択', () => {
  const app = makeApp();
  const run = new EventRun(app, { ...FIXTURE, tier: 2 });
  const cast = run.steps.find((s) => s.t === 'cast');
  assert.equal(cast.choices.length, 6);
});

test('イベント: 反芻は既習語から抽選されSRSに書き込まない', () => {
  const app = makeApp();
  const p = app.profile;
  const t0 = Date.now() - 3 * 86400000;
  for (const w of ['apple', 'angry', 'always']) p.cards[w] = review(newCard(t0), 2, t0);
  const before = JSON.stringify(p.cards);
  const run = new EventRun(app, FIXTURE);
  const reviews = run.steps.filter((s) => s.t === 'cast' && s.review);
  assert.equal(reviews.length, 1, '反芻ビートが立たない');
  assert.ok(['apple', 'angry', 'always'].includes(reviews[0].entries[0].w));
  run.answer; // 走らせても…
  for (const s of run.steps) if (s.t === 'cast') { run.idx = run.steps.indexOf(s); run.answer(s.entries[0].w); }
  assert.equal(JSON.stringify(p.cards), before, '反芻がSRSカードに書き込んだ');
});

test('イベント: 複数語ビート(りんごを食べる=apple+eat)を順に埋める', () => {
  const app = makeApp();
  const multi = { ...FIXTURE, beats: [
    { lines: ['ノノがりんごをほおばる'], teach: ['apple', 'eat'],
      cast: { jp: 'ノノが「___」を「___」', answers: ['apple', 'eat'] } },
  ] };
  const run = new EventRun(app, multi);
  while (run.cur().t !== 'cast') run.next();
  const s = run.cur();
  assert.equal(s.entries.length, 2);
  assert.ok(s.choices.length >= 4, '選択肢が少なすぎる');
  assert.equal(run.answer('eat').correct, false, '順序を無視して埋まった');
  const r1 = run.answer('apple');
  assert.ok(r1.correct && r1.partial, '1語目で部分正解にならない');
  const r2 = run.answer('eat');
  assert.ok(r2.correct && !r2.partial, '2語目で完了しない');
  const r = run.finish();
  assert.equal(r.words.length, 2, '2語とも学習ステップに入らない');
});

test('イベント: 初回クリアで gold+新語が学習ステップへ、再演は無報酬', () => {
  const app = makeApp();
  const p = app.profile;
  const run = new EventRun(app, FIXTURE);
  const r = run.finish();
  assert.equal(r.already, false);
  assert.equal(r.gold, Math.round(enemyHp(0) * 1.5));
  assert.equal(r.words.length, 2);
  assert.ok(p.steps.water && p.steps.walk, '新語がステップに入らない');
  assert.ok(p.events.cleared.ev_test);
  // 2回目(再演)
  const run2 = new EventRun(app, FIXTURE, { replay: true });
  const r2 = run2.finish();
  assert.equal(r2.already, true);
  assert.equal(r2.gold, 0);
});

test('イベント: 既習語は再追加しない', () => {
  const app = makeApp();
  const p = app.profile;
  const t0 = Date.now();
  p.cards.water = review(newCard(t0), 2, t0);
  const cardBefore = JSON.stringify(p.cards.water);
  const run = new EventRun(app, FIXTURE);
  const r = run.finish();
  assert.equal(r.words.length, 1, '既習のwaterまで追加された');
  assert.equal(r.words[0].w, 'walk');
  assert.ok(!p.steps.water);
  assert.equal(JSON.stringify(p.cards.water), cardBefore);
});

test('イベント: 開発者モードでgoldが倍率に従う', () => {
  const app = makeApp();
  app.profile.dev = { mult: 10 };
  const run = new EventRun(app, FIXTURE);
  const r = run.finish();
  assert.equal(r.gold, Math.round(enemyHp(0) * 1.5) * 10);
});
