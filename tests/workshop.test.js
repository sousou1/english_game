import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile, dayStat } from '../js/storage.js';
import { Workshop } from '../js/workshop.js';
import { newCard, review, DAY } from '../js/srs.js';

function makeApp() {
  const p = defaultProfile();
  return { words: WORDS, index: buildIndex(WORDS), profile: p, save() {} };
}

function answerCorrect(ws) {
  const q = ws.openChoices();
  return ws.submitRecall(q.choices.findIndex((c) => c.correct));
}

test('導入: 3語の超易問があり、正解するとステップに入って灯火が生まれる', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  const intro = ws.introQueue();
  assert.equal(intro.length, 3);
  ws.openRecall(intro[0]);
  const res = answerCorrect(ws);
  assert.ok(res.correct);
  assert.ok(res.reward > 0);
  assert.ok(app.profile.steps[intro[0]], 'ステップに入っていない');
  assert.ok(app.profile.lights > 0);
  assert.equal(dayStat(app.profile).new, 1, '新出の消費が数えられていない');
});

test('招く: 設定レベル・分野のみ、1日上限と寮の空きで制限', () => {
  const app = makeApp();
  app.profile.settings.levels = [3];
  app.profile.settings.fields = ['nature'];
  app.profile.settings.newPerDay = 2;
  const ws = new Workshop(app);
  const cands = ws.inviteCandidates(3);
  assert.ok(cands.length > 0);
  for (const e of cands) { assert.equal(e.l, 3); assert.equal(e.f, 'nature'); }
  assert.ok(ws.invite(cands[0].w));
  assert.ok(ws.invite(cands[1].w));
  assert.equal(ws.inviteCapToday(), 0);
  assert.ok(!ws.invite(cands[2].w), '上限を超えて招けてしまう');
});

test('ステップ→卒業→火をおこすと放置生産が動く', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  const w = ws.introQueue()[0];
  // 導入の初想起 = step1。正解で step2(次の鐘)へ
  ws.openRecall(w);
  answerCorrect(ws);
  assert.equal(app.profile.steps[w].step, 2);
  // step2: 鐘の後 → 卒業
  app.profile.steps[w].due = Date.now() - 1000;
  ws.openRecall(w);
  const res = answerCorrect(ws);
  assert.ok(res.graduated, '卒業していない');
  assert.ok(app.profile.cards[w].reps >= 1);
  // 火をおこす+生産施設(火守りの小妖精)
  app.profile.lights = 300;
  assert.ok(ws.buy('fire'));
  assert.equal(ws.snapshot().rate, 0, '施設なしで生産が動いてしまう');
  assert.ok(ws.buy('fairy'));
  assert.ok(ws.snapshot().rate > 0, '生産が動いていない');
});

test('うとうとの言霊を起こすと熟成マナが弾けて灯火になる', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  const now = Date.now();
  const e = WORDS[10];
  app.profile.facilities.fire = 1;
  app.profile.cards[e.w] = review(newCard(now - 10 * DAY), 2, now - 10 * DAY); // とっくに期日超過
  app.profile.mana[e.w] = 40;
  ws.openRecall(e.w);
  const res = answerCorrect(ws);
  assert.ok(res.correct);
  assert.equal(res.manaReleased, 40);
  assert.equal(app.profile.mana[e.w], 0);
  assert.ok(res.burstM > 1, '再燃バーストが効いていない');
  assert.ok(app.profile.lights >= 40);
});

test('誤答は罰なし: マナは残り、灯火は減らない', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  const now = Date.now();
  const e = WORDS[10];
  app.profile.facilities.fire = 1;
  app.profile.lights = 100;
  app.profile.cards[e.w] = review(newCard(now - 10 * DAY), 2, now - 10 * DAY);
  app.profile.mana[e.w] = 30;
  ws.openRecall(e.w);
  const q = ws.openChoices();
  const wrongIdx = q.choices.findIndex((c) => !c.correct);
  const res = ws.submitRecall(wrongIdx);
  assert.ok(!res.correct);
  assert.equal(app.profile.mana[e.w], 30, 'マナが没収された');
  assert.equal(Math.floor(app.profile.lights), 100, '灯火が減った');
});

test('ピンときた: 検証は6択になり、成功はeasy級の効果', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  const now = Date.now();
  const e = WORDS[20];
  app.profile.cards[e.w] = review(newCard(now - 10 * DAY), 2, now - 10 * DAY);
  const before = app.profile.cards[e.w].S;
  ws.openRecall(e.w);
  ws.declareMikiri();
  const q = ws.openChoices();
  assert.equal(q.choices.length, 6, 'ピンときたが6択になっていない');
  const res = ws.submitRecall(q.choices.findIndex((c) => c.correct));
  assert.ok(res.correct);
  assert.ok(app.profile.cards[e.w].S > before * 2);
});

test('宝箱: 3体招いた日に作れて、翌日ひらける', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  app.profile.settings.levels = [1, 2, 3];
  for (const e of ws.inviteCandidates(3)) ws.invite(e.w);
  assert.ok(ws.canMakeChest());
  const chest = ws.makeChest();
  assert.ok(chest && chest.words.length >= 3);
  assert.ok(!ws.canOpenChest(), '今日のうちにひらけてしまう');
  assert.ok(ws.canOpenChest(Date.now() + 86400000), '翌日にひらけない');
});

test('確かな想起: 期日後の正答だけが増える', () => {
  const app = makeApp();
  const ws = new Workshop(app);
  const now = Date.now();
  const e = WORDS[30];
  app.profile.cards[e.w] = review(newCard(now - 10 * DAY), 2, now - 10 * DAY);
  ws.openRecall(e.w);
  answerCorrect(ws);
  assert.equal(app.profile.surely, 1);
  // 直後にもう一度(期日前)→ 増えない
  ws.openRecall(e.w);
  answerCorrect(ws);
  assert.equal(app.profile.surely, 1, '期日前の連打で確かな想起が増えた');
});
