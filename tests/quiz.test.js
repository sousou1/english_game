import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex, makeQuestion, pickDistractors, clozeable, clozeText } from '../js/quiz.js';

const index = buildIndex(WORDS);
const settings = { listen: false, levels: [1, 2, 3, 4, 5], fields: [] };

test('語彙データの体裁', () => {
  assert.ok(WORDS.length >= 700, `${WORDS.length}語`);
  const seen = new Set();
  for (const e of WORDS) {
    assert.ok(e.w && e.j && e.p && e.l >= 1 && e.l <= 5 && e.f, JSON.stringify(e));
    assert.ok(!seen.has(e.w), `重複: ${e.w}`);
    seen.add(e.w);
  }
});

test('ディストラクタ: 3つ、意味の重複なし', () => {
  for (const e of WORDS.filter((_, i) => i % 37 === 0)) {
    const ds = pickDistractors(e, index, 3);
    assert.equal(ds.length, 3, `${e.w}: ${ds.length}個しか取れない`);
    const js = new Set([e.j, ...ds.map((d) => d.j)]);
    assert.equal(js.size, 4, `${e.w}: 意味が重複 ${[...js]}`);
    assert.ok(!ds.some((d) => d.w === e.w));
  }
});

test('makeQuestion: 全タイプで正解がちょうど1つ', () => {
  const e = WORDS.find((x) => clozeable(x));
  for (const type of ['e2j', 'j2e', 'cloze']) {
    const q = makeQuestion(e, { reps: 5 }, index, settings, type);
    assert.equal(q.choices.length, 4);
    assert.equal(q.choices.filter((c) => c.correct).length, 1);
    assert.equal(q.answer, q.choices.findIndex((c) => c.correct));
    if (type === 'cloze') {
      assert.ok(q.prompt.includes('____'), q.prompt);
      assert.ok(!q.prompt.toLowerCase().includes(e.w), '空所に答えが残っている');
    }
  }
});

test('cloze: 例文に単語が含まれる語のみ・置換が効く', () => {
  let n = 0;
  for (const e of WORDS) {
    if (clozeable(e)) {
      n++;
      assert.ok(clozeText(e).includes('____'), e.w);
    }
  }
  assert.ok(n > WORDS.length * 0.7, `clozeable ${n}/${WORDS.length}`);
});

test('新カードはe2jのみ(初見でリスニングは出ない)', () => {
  const e = WORDS[0];
  for (let i = 0; i < 20; i++) {
    const q = makeQuestion(e, undefined, index, { ...settings, listen: true });
    assert.equal(q.type, 'e2j');
  }
});
