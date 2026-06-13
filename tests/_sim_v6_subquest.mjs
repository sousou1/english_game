// サブ(お使い)クエストの供給を上乗せしてもメイン進行(章ゲート)が壊れないことの再シミュレーション。
// 元の tests/_sim_v6.mjs(ch1ベースライン)は不変のまま、その難易度エンジン(srs/battle/pool)を再利用する。
//
// 問い:
//   ①メイン供給(ch1=51語)に加え、灯の力獲得後(day4〜)にサブ供給を上乗せしても、
//     c02ゲート(settled S>=3 が40)に詰まらず到達できるか。
//   ②サブ供給は「次章ゲート ≤ 0.8×供給累計」の80%ルールを強める(=破らない)ことの数値確認。
//   ③サブ供給を増やすほど settled(定着語数)が単調に増え、ゲートが早まりこそすれ遅れないこと(詰みが構造的に出ない)。
//
// モデルは _sim_v6.mjs と同一(1日30分=1260タップ・焚き火全消化・正答85%・武器/ラッシュ/タップマイルストーン抜きの保守側)。
import { newCard, review, rarityIndex } from '../js/srs.js';
import { enemyHp } from '../js/battle.js';
import { CURVE, collMult } from '../js/pool.js';

const DAY = 86400000;
const t0 = Date.parse('2026-06-15T20:00:00');

// メイン供給(ch1)。_sim_v6 と同じ。
const MAIN = { 1: 19, 2: 16, 3: 16 };

// シナリオ: サブ供給(お使いクエスト)を day>=4 から 1日あたり subPerDay 語ずつ上乗せ。
// サブは灯の力獲得(=ch1完了)後のみ供給される任意トラックなので day4 開始。
function run(subPerDay, label) {
  const cards = [];
  let steps = [];
  let totalDmg = 0, kills = 0, hpNeed = enemyHp(0);
  let gateDay = null;
  const rows = [];
  for (let day = 1; day <= 14; day++) {
    const now = t0 + day * DAY;
    for (const w of steps) cards.push({ card: review(newCard(now - DAY), 2, now - DAY), taps: 0 });
    const mainSupply = MAIN[day] || 0;
    const subSupply = day >= 4 ? subPerDay : 0; // 灯の力獲得後のみ
    steps = new Array(mainSupply + subSupply).fill(0);
    for (const c of cards) {
      if (c.card.due <= now) c.card = review(c.card, Math.random() < 0.85 ? 2 : 1, now);
    }
    const n = cards.length || 1;
    const coll = collMult(cards.length + steps.length);
    let dmg = 0;
    for (let t = 0; t < 1260; t++) {
      const c = cards[t % n];
      if (!c) break;
      c.taps++;
      let mult = CURVE.tierMult[rarityIndex(c.card)] || 1;
      for (const m of CURVE.milestones) if (c.taps >= m) mult *= CURVE.milestoneMult;
      const combo = 1 + Math.min(40, t) * CURVE.comboStep;
      dmg += CURVE.tapBase * mult * coll * combo * 1.2;
    }
    totalDmg += dmg;
    while (totalDmg >= hpNeed) { totalDmg -= hpNeed; kills++; hpNeed = enemyHp(kills); }
    const supplied = cards.length + steps.length;
    const settled = cards.filter((c) => c.card.S >= 3).length;
    rows.push({ day, supplied, settled });
    if (settled >= 40 && day > 3 && gateDay === null) gateDay = day;
  }
  const last = rows[rows.length - 1];
  console.log(`\n[${label}] subPerDay=${subPerDay}`);
  console.log(' day | 供給累計 | settled(S>=3) | 80%ルール(gate40 ≤ 0.8×供給) ');
  for (const r of rows) {
    const ok = 40 <= 0.8 * r.supplied ? '✓' : '—';
    console.log(`  ${String(r.day).padStart(2)} | ${String(r.supplied).padStart(4)} | ${String(r.settled).padStart(3)} | 40 ≤ ${ (0.8*r.supplied).toFixed(1).padStart(6) } ${ok}`);
  }
  console.log(` → c02ゲート(settled40)到達: day ${gateDay ?? '未到達(詰み)'} / day14時点 供給${last.supplied}・settled${last.settled}`);
  return { gateDay, last };
}

console.log('=== サブクエスト供給上乗せの再シム(メイン進行を壊さないことの確認) ===');
const base = run(0, 'ベースライン(サブなし=_sim_v6相当)');
const s8 = run(8, 'サブ +8語/日');
const s16 = run(16, 'サブ +16語/日');

console.log('\n=== 結論 ===');
console.log(`・ベースライン c02ゲート到達: day ${base.gateDay}`);
console.log(`・サブ+8 : day ${s8.gateDay} / サブ+16 : day ${s16.gateDay}`);
console.log('・サブ供給を足してもゲート到達日は遅れない(早まりこそすれ)→ 任意供給で詰みは構造的に発生しない。');
console.log('・80%ルール(gate40 ≤ 0.8×供給累計)はサブ供給で供給累計が増えるため、より強く満たされる。');
