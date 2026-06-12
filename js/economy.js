// 工房の経済: 言霊の生産・熟成マナ・貯蔵・施設。
// 不変条件: 灯火を生むのは過去の想起(=卒業した言霊)だけ。放置生産はその利息。
import { retrievability, rarityIndex } from './srs.js';
import { quantizeDue } from './schedule.js';

export const TIER_NAMES = ['見習い', '職人', '親方', '長老', '語り部'];
export const TIER_MULT = [1, 2, 4, 8, 16];

// 1分あたりの生産(覚醒時)。レベルが高い言葉ほど、根づいた言葉ほどよく燃える
export function idleRate(entry, card) {
  if (!card || !card.reps) return 0;
  const tier = rarityIndex(card);
  return 0.15 * (1 + 0.35 * ((entry.l || 1) - 1)) * TIER_MULT[tier];
}

// うとうと中は生産×0.6。失われた0.4は熟成マナとして籠に積もる(上限7時間ぶん)
export const DROWSY_FACTOR = 0.6;
export function manaCap(entry, card) {
  return idleRate(entry, card) * 420;
}

// 学習ステップ中の語のわずかな生産(初想起の実績はあるので嘘ではない)
export const STEP_RATE = 0.06;

export const FACILITIES = [
  { id: 'fire', name: '火をおこす', icon: '🔥', base: 10, growth: 1, max: 1, desc: '言霊たちが働きはじめる(放置生産)' },
  { id: 'shelf', name: '棚', icon: '🗄️', base: 25, growth: 2.5, max: 8, desc: '灯火の置き場が増える(貯蔵上限×2.2)' },
  { id: 'dorm', name: '寮', icon: '🏠', base: 80, growth: 2.0, max: 10, desc: '言霊の住める数 +6' },
  { id: 'bell', name: '鐘楼', icon: '🔔', base: 120, growth: 1, max: 1, desc: '朝・昼・夜の鐘の時刻が見える' },
  { id: 'voice', name: '声の燈', icon: '🕯️', base: 150, growth: 1, max: 1, desc: 'ことばが声を持つ(聴き取りの想起)' },
  { id: 'vault', name: '灯火庫', icon: '🏺', base: 220, growth: 2.8, max: 6, desc: '貯蔵上限×2.5。満タンまでの時間が見える' },
  { id: 'bellows', name: '機じかけのふいご', icon: '⚙️', base: 400, growth: 1, max: 1, desc: '風が自動で吹く(常時 生産+15%)' },
];

export function facilityPrice(f, owned) {
  return Math.round(f.base * Math.pow(f.growth, owned));
}

export function storageCap(profile) {
  const shelf = profile.facilities.shelf || 0;
  const vault = profile.facilities.vault || 0;
  return Math.round(60 * Math.pow(2.2, shelf) * Math.pow(2.5, vault));
}

export function dormCap(profile) {
  return 8 + (profile.facilities.dorm || 0) * 6;
}

// 現在の総生産レート(/分)。boost はアクティブ時のふいご倍率(精算=オフラインでは常に1)
export function productionAt(profile, index, now, boost = 1) {
  if (!profile.facilities.fire) return { rate: 0, drowsyCount: 0 };
  let rate = 0;
  let drowsyCount = 0;
  for (const w of Object.keys(profile.steps || {})) {
    if (index.byKey.has(w)) rate += STEP_RATE;
  }
  for (const [w, card] of Object.entries(profile.cards)) {
    const entry = index.byKey.get(w);
    if (!entry || !card.reps) continue;
    const r = idleRate(entry, card);
    if (now >= quantizeDue(card.due)) {
      rate += r * DROWSY_FACTOR;
      drowsyCount++;
    } else {
      rate += r;
    }
  }
  const passive = profile.facilities.bellows ? 1.15 : 1;
  return { rate: rate * passive * boost, drowsyCount };
}

// 区間 [fromTs, toTs] の精算。5分刻みの決定論的シミュレーション。
// オンラインの毎秒ティックも同じ関数を使う(数字は嘘をつかない)
export function settle(profile, index, fromTs, toTs) {
  const MAXSPAN = 24 * 3600 * 1000;
  let from = Math.max(fromTs, toTs - MAXSPAN);
  const cap = storageCap(profile);
  let lights = profile.lights;
  let gained = 0;
  let cappedAt = null;
  const manaGained = {};

  if (!profile.facilities.fire || toTs <= from) {
    return { lights, gained: 0, cappedAt: null, manaGained };
  }

  const STEP = 5 * 60 * 1000;
  let t = from;
  while (t < toTs) {
    const dt = Math.min(STEP, toTs - t);
    const mins = dt / 60000;
    const mid = t + dt / 2;
    let stepRate = 0;
    for (const w of Object.keys(profile.steps || {})) {
      if (index.byKey.has(w)) stepRate += STEP_RATE;
    }
    for (const [w, card] of Object.entries(profile.cards)) {
      const entry = index.byKey.get(w);
      if (!entry || !card.reps) continue;
      const r = idleRate(entry, card);
      if (mid >= quantizeDue(card.due)) {
        stepRate += r * DROWSY_FACTOR;
        // 取りこぼした分が熟成マナに積もる
        const mc = manaCap(entry, card);
        const cur = (profile.mana[w] || 0) + (manaGained[w] || 0);
        const add = Math.min(r * (1 - DROWSY_FACTOR) * mins, Math.max(0, mc - cur));
        if (add > 0) manaGained[w] = (manaGained[w] || 0) + add;
      } else {
        stepRate += r;
      }
    }
    if (profile.facilities.bellows) stepRate *= 1.15;
    const add = stepRate * mins;
    if (lights + add >= cap) {
      if (cappedAt === null && add > 0) {
        const room = cap - lights;
        const frac = stepRate > 0 ? room / add : 0;
        cappedAt = t + dt * Math.min(1, Math.max(0, frac));
      }
      gained += Math.max(0, cap - lights);
      lights = cap;
    } else {
      lights += add;
      gained += add;
    }
    t += dt;
  }
  return { lights, gained, cappedAt, manaGained };
}

// 棚が満タンになるまでの時間(ミリ秒)。生産ゼロなら null
export function timeToFull(profile, index, now) {
  const { rate } = productionAt(profile, index, now);
  if (rate <= 0) return null;
  const room = storageCap(profile) - profile.lights;
  if (room <= 0) return 0;
  return (room / rate) * 60000;
}
