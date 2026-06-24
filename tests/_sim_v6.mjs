// v6難易度シミュレーション: 新語供給をイベント限定(3+48語)にした第1章の進行検証
// 問い: ①c02ゲート(settled S>=3 が40体)に何日で届くか
//       ②語彙51語上限で敵HPカーブ(enemyHp)に対し討伐が詰まらないか
//       ③収集マイルストーン(25/50語)の到達
// モデル: 1日30分アクティブ(タップ0.7/秒=1260タップ)+焚き火復習(全期日消化、正答率85%)
import { newCard, review, retrievability, rarityIndex } from '../js/srs.js';
import { enemyHp } from '../js/battle.js';
import { CURVE, collMult } from '../js/pool.js';
import { sublMult, MASTERY } from '../js/mastery.js';

const DAY = 86400000;
const t0 = Date.parse('2026-06-15T20:00:00');
// 供給タイムライン(シーン読みは無料なので序盤で一気に読む想定)
// day1: チュートリアル3語 + fire/road(16語) day2: gate/work(16語) day3: codex/oath(16語)
const SUPPLY = { 1: 19, 2: 16, 3: 16 };

const cards = []; // {card, taps}
let steps = [];   // 学習ステップ(2回想起で卒業→card化を1日遅れで近似)
let totalDmg = 0, kills = 0, hpNeed = enemyHp(0);
console.log('day | 語彙 | settled(S>=3) | 昇華 | sublMult | tier平均 | 1日ダメージ | 討伐累計 | 次の敵HP');
for (let day = 1; day <= 21; day++) {
  const now = t0 + day * DAY;
  // 供給: ステップ投入 → 翌日卒業してカードへ
  for (const w of steps) cards.push({ card: review(newCard(now - DAY), 2, now - DAY), taps: 0 });
  steps = new Array(SUPPLY[day] || 0).fill(0);
  // 焚き火: 期日が来たカードを全部復習(85%正答)
  for (const c of cards) {
    if (c.card.due <= now) c.card = review(c.card, Math.random() < 0.85 ? 2 : 1, now);
  }
  // 昇華: ans=reps+min(taps,cap) >=閾値 かつ 定着S>=sMin の語を卒業。係数(sublMult)のみ反映。
  // (ローテ除外+10%再出題はD1次段。係数は章ゲート=settledに非干渉なので gate到達日は不変のはず)
  for (const c of cards) {
    if (c.subl) continue;
    const ans = (c.card.reps || 0) + Math.min(c.taps, MASTERY.tapCap);
    if (ans >= MASTERY.ansThreshold && c.card.S >= MASTERY.sMin) c.subl = true;
  }
  const sublCount = cards.filter((c) => c.subl).length;
  const subl = sublMult(sublCount);
  // アクティブ詠唱: 1260タップを語彙に均等配分
  const n = cards.length || 1;
  const coll = collMult(cards.length + steps.length);
  let dmg = 0;
  for (let t = 0; t < 1260; t++) {
    const c = cards[t % n];
    if (!c) break;
    c.taps++;
    let mult = CURVE.tierMult[rarityIndex(c.card)] || 1;
    for (const m of CURVE.milestones) if (c.taps >= m) mult *= CURVE.milestoneMult;
    const combo = 1 + Math.min(40, t) * CURVE.comboStep; // 平均的コンボ
    dmg += CURVE.tapBase * mult * coll * subl * combo * 1.2; // 1.2=鮮度平均。昇華係数 subl を反映(武器/ラッシュは保守的に除外)
  }
  totalDmg += dmg;
  while (totalDmg >= hpNeed) { totalDmg -= hpNeed; kills++; hpNeed = enemyHp(kills); }
  const settled = cards.filter((c) => c.card.S >= 3).length;
  const tierAvg = cards.length ? (cards.reduce((a, c) => a + rarityIndex(c.card), 0) / cards.length).toFixed(2) : '-';
  console.log(`${String(day).padStart(2)} | ${String(cards.length + steps.length).padStart(3)} | ${String(settled).padStart(2)} | ${String(sublCount).padStart(2)} | ×${String(subl).padStart(2)} | ${tierAvg} | ${dmg.toExponential(2)} | ${String(kills).padStart(3)} | ${enemyHp(kills).toExponential(2)}`);
  if (settled >= 40 && day > 3) { console.log(`→ c02ゲート(settled 40)到達: day ${day}`); break; }
}
