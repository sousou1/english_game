import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { buildIndex } from '../js/quiz.js';
import { defaultProfile } from '../js/storage.js';
import { Battle, BATTLE, enemyHp, isMidBoss, isChapterBoss, levelOf, hpMax, bossAtk } from '../js/battle.js';
import { armoryMult } from '../js/armory.js';

function makeApp() {
  const p = defaultProfile();
  return { words: WORDS, index: buildIndex(WORDS), profile: p, save() {} };
}

test('敵HP=旧注文式の完全リスキン(5体ごと×3、章ボス計×5)', () => {
  assert.equal(enemyHp(0), 30);
  assert.ok(Math.abs(enemyHp(1) - 30 * 1.35) <= 1);
  assert.ok(isMidBoss(4), '5体目が中ボスでない');
  assert.ok(Math.abs(enemyHp(4) / (30 * Math.pow(1.35, 4)) - 3) < 0.05, '中ボス×3でない');
  assert.ok(isChapterBoss(19), '20体目が章ボスでない');
  assert.ok(Math.abs(enemyHp(19) / (30 * Math.pow(1.35, 19)) - 5) < 0.1, '章ボス計×5でない');
});

test('雑魚討伐: ダメージ永続、倒すとゴールドとEXP', () => {
  const app = makeApp();
  const b = new Battle(app);
  const hp = enemyHp(0);
  const r1 = b.applyDamage(hp - 5);
  assert.ok(!r1.kill);
  assert.equal(app.profile.battle.dmg, hp - 5);
  const r2 = b.applyDamage(10);
  assert.ok(r2.kill);
  assert.equal(r2.gold, Math.round(hp * 0.5));
  assert.equal(app.profile.battle.kills, 1);
  assert.equal(app.profile.battle.dmg, 0);
  assert.ok(app.profile.gold > 0);
  assert.ok(app.profile.exp > 0);
});

test('ボス: 結界75%→討伐チャンス(プレイヤー起点)→本体撃破', () => {
  const app = makeApp();
  app.profile.battle.kills = 4; // 5体目=中ボス
  const b = new Battle(app);
  assert.ok(b.isBossNow());
  assert.ok(!b.engageBoss(), '結界が残っているのに挑めてしまう');
  b.applyDamage(b.barrierMax());
  assert.ok(b.engageBoss(), '結界破壊後に挑めない');
  assert.ok(app.profile.boss.engaged);
  const r = b.applyDamage(b.bodyMax() + 10);
  assert.ok(r.kill, 'ボスが倒れない');
  assert.equal(app.profile.battle.kills, 5);
});

test('撤退=無損失+傷痕で本体上限が削れる(最大-30%)', () => {
  const app = makeApp();
  app.profile.battle.kills = 4;
  app.profile.gold = 500;
  const b = new Battle(app);
  b.applyDamage(b.barrierMax());
  const body0 = b.bodyMax();
  b.engageBoss();
  b.retreat();
  assert.equal(app.profile.gold, 500, '撤退でゴールドが減った');
  assert.ok(app.profile.battle.dmg >= b.barrierMax(), '結界が回復してしまった');
  assert.ok(b.bodyMax() < body0, '傷痕が付かない');
  for (let i = 0; i < 10; i++) { b.engageBoss(); b.retreat(); }
  assert.ok(b.bodyMax() >= body0 * 0.69, '傷痕が-30%を超えた');
});

test('ボスの攻撃: 一定間隔で実ダメージ、HP0で自動撤退(没収なし)', () => {
  const app = makeApp();
  app.profile.battle.kills = 4;
  const b = new Battle(app);
  b.applyDamage(b.barrierMax());
  b.engageBoss();
  app.profile.boss.hp = 1; // 瀕死
  app.profile.boss.nextAtk = Date.now() - 1;
  const r = b.tick();
  assert.ok(r.attacked);
  assert.ok(r.defeated, '撃破されない');
  assert.ok(!app.profile.boss.engaged, '撤退していない');
});

test('レベル: EXPでHPと会心だけが伸びる(攻撃力には乗らない=学習が火力)', () => {
  const app = makeApp();
  const b = new Battle(app);
  const atk0 = armoryMult(app.profile);
  for (let i = 0; i < 200; i++) b.addExp('tap');
  const { level } = levelOf(app.profile.exp);
  assert.ok(level >= 2);
  assert.ok(hpMax(level) > hpMax(1));
  assert.equal(armoryMult(app.profile), atk0, 'EXPで攻撃が伸びてしまった');
});

test('討伐チャンスopts: 手紙HP+15%・装備の被ダメ軽減が効く', () => {
  const app = makeApp();
  app.profile.battle.kills = 4;
  const b = new Battle(app);
  b.applyDamage(b.barrierMax());
  const L = b.level().level;
  b.engageBoss({ hpBonus: 0.15, dmgReduce: 0.25 });
  assert.equal(app.profile.boss.hp, Math.round(hpMax(L) * 1.15), '手紙のHPボーナスが乗らない');
  assert.equal(app.profile.boss.dmgReduce, 0.25);
  app.profile.boss.hp = 10000;
  app.profile.boss.nextAtk = Date.now() - 1;
  const r = b.tick();
  assert.equal(r.dmg, Math.round(bossAtk(1) * 0.75), '被ダメ軽減が効かない');
  b.retreat();
  // 軽減はキャップ0.5
  b.engageBoss({ dmgReduce: 0.9 });
  assert.equal(app.profile.boss.dmgReduce, 0.5, '被ダメ軽減がキャップを超えた');
});

test('開発者モード: ゴールドとEXPが倍率に従う', () => {
  const app = makeApp();
  app.profile.dev = { mult: 100 };
  const b = new Battle(app);
  const hp = enemyHp(0);
  const r = b.applyDamage(hp);
  assert.ok(r.kill);
  assert.equal(r.gold, Math.round(hp * 0.5) * 100, 'devモードでゴールドが増えない');
});

test('ボス攻撃力: 順調ペースのLvなら約13発(65秒)耐えられる正規化', () => {
  // 初ボス(5体目)はDay1〜2 ≈ Lv4、10体目ボスはDay3 ≈ Lv8 が順調ペース
  const hits1 = Math.floor(hpMax(4) / bossAtk(1));
  const hits2 = Math.floor(hpMax(8) / bossAtk(2));
  assert.ok(hits1 >= 9, `初ボスで${hits1}発しか耐えない`);
  assert.ok(hits2 >= 9, `2体目ボスで${hits2}発しか耐えない`);
});
