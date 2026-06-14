// セーブ移行(マイグレーション)の検証。
// 要件: (a) 今回は一度だけリセット可(v < RESET_BELOW は破棄)。
//       (b) 以後のアップデートでは消えない=旧profileを前方マイグレートし学習データを保持。
//       (c) defaultProfile に項目を足してもデータが消えない(backfill が既定補完)。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultProfile, migrate, backfill, migrateOrReset,
  SCHEMA_VERSION, RESET_BELOW, DEFAULT_PLAYER_NAME,
} from '../js/storage.js';

// 学習データを持つ現行(v6)プロフィールを組む
function seeded() {
  const p = defaultProfile();
  p.cards = { water: { reps: 3, due: 111, last: 100 }, sun: { reps: 1, due: 222, last: 200 } };
  p.steps = { apple: { step: 1, due: 333, mikiri: 0 } };
  p.mana = { water: 42 };
  p.lights = 7;
  p.totalLights = 19;
  p.surely = 5;
  p.streak = { count: 4, best: 9, lastDay: '2026-06-10' };
  p.stats = { recalls: 30, correct: 25, byDay: { '2026-06-10': { r: 5, c: 4, new: 2 } } };
  p.playerName = 'ボブ';
  p.scenario = { scene: 'c01_040', flags: { yui: 2 }, chapter: 1, read: { c01_010: 1 } };
  return p;
}

test('新規/壊れデータは defaultProfile を返す', () => {
  assert.equal(migrateOrReset(null).v, SCHEMA_VERSION);
  assert.equal(migrateOrReset(undefined).v, SCHEMA_VERSION);
  assert.equal(migrateOrReset('garbage').v, SCHEMA_VERSION);
  assert.equal(migrateOrReset([]).v, SCHEMA_VERSION);
  assert.equal(migrateOrReset({}).v, SCHEMA_VERSION); // v 無し=0 < RESET_BELOW
});

test('今回限りの全消し: RESET_BELOW 未満(旧 v5 等)は破棄して新規', () => {
  const old = { v: RESET_BELOW - 1, cards: { water: { reps: 9 } }, lights: 999 };
  const got = migrateOrReset(old);
  assert.equal(got.v, SCHEMA_VERSION);
  assert.deepEqual(got.cards, {}, '旧 v5 の学習データは今回だけ破棄される');
  assert.equal(got.lights, 0);
});

test('現行版(v6)の学習データは migrateOrReset で完全保持される', () => {
  const got = migrateOrReset(seeded());
  assert.equal(got.v, SCHEMA_VERSION);
  assert.deepEqual(got.cards, { water: { reps: 3, due: 111, last: 100 }, sun: { reps: 1, due: 222, last: 200 } });
  assert.deepEqual(got.steps, { apple: { step: 1, due: 333, mikiri: 0 } });
  assert.deepEqual(got.mana, { water: 42 });
  assert.equal(got.lights, 7);
  assert.equal(got.totalLights, 19);
  assert.equal(got.surely, 5);
  assert.equal(got.streak.count, 4);
  assert.equal(got.stats.correct, 25);
  assert.equal(got.playerName, 'ボブ');
  assert.equal(got.scenario.flags.yui, 2);
});

test('backfill: 新項目を足しても既存学習データは消えない(未知フィールド既定補完)', () => {
  // 「将来 defaultProfile に項目が増えた」状況を模す: いまの p から新項目を抜いておく
  const p = seeded();
  delete p.feedback;       // 後から増えた項目
  delete p.named;
  delete p.taps;
  const got = backfill(p);
  // 既存データは保持
  assert.deepEqual(got.cards.water, { reps: 3, due: 111, last: 100 });
  assert.equal(got.mana.water, 42);
  // 欠けていた新項目は既定で補完
  assert.deepEqual(got.feedback, []);
  assert.equal(got.named, false);
  assert.deepEqual(got.taps, {});
});

test('backfill: settings は既定とマージ(新設定キーが補完され、既存値は維持)', () => {
  const p = seeded();
  p.settings = { rate: 1.1 }; // 旧来 rate だけ持っていた想定
  const got = backfill(p);
  assert.equal(got.settings.rate, 1.1, '既存値は維持');
  assert.deepEqual(got.settings.levels, [1, 2], '欠けたキーは既定で補完');
  assert.equal(got.settings.listen, true);
});

test('playerName のフォールバック: 空/非文字列は既定名へ', () => {
  for (const bad of ['', '   ', null, undefined, 42]) {
    const p = seeded();
    p.playerName = bad;
    assert.equal(backfill(p).playerName, DEFAULT_PLAYER_NAME);
  }
});

test('前方マイグレーション(将来 v7)で学習データが保持される', () => {
  // 「次のアップデートで v7 にし、新フィールド coins を導入する」を模擬。
  // 破壊的変換が要る場合の per-version migrator をテスト用に渡す。
  const futureMigrators = {
    6: (p) => { p.coins = (p.lights || 0) * 2; }, // v6->v7 変換例: lights から派生
  };
  const p = seeded();
  migrate(p, futureMigrators, 7);
  assert.equal(p.v, 7);
  assert.equal(p.coins, 14, 'migrator が走り新フィールドが算出される');
  // 学習データは触られていない
  assert.deepEqual(p.cards.water, { reps: 3, due: 111, last: 100 });
  assert.equal(p.streak.count, 4);
});

test('migrate: 既知 migrator が無い版差は版番号だけ進める(データ非破壊)', () => {
  const p = seeded();
  migrate(p, {}, 9); // migrator 無しで v6->v9
  assert.equal(p.v, 9);
  assert.equal(p.lights, 7, '値は一切変わらない');
});

test('defaultProfile と版定数の整合', () => {
  assert.equal(defaultProfile().v, SCHEMA_VERSION);
  assert.ok(RESET_BELOW <= SCHEMA_VERSION);
});
