// 工房の経済(インフレ研究準拠)。
// 核心: 放置生産はタップ価値V_refに従属し、log2で圧縮される:
//   CpM = V_ref × IDLE_K × log2(1 + P_total)   (P_total=施設パワー)
// → 放置がタップ(=学習)を追い越して学習が無意味化する事故が数式上起きない。
// 不変条件: 灯火のミントは「ことばの運用(タップ)」と「想起(起こす)」だけ。施設はその増幅器。
import { rarityIndex } from './srs.js';
import { quantizeDue } from './schedule.js';

export const TIER_NAMES = ['見習い', '職人', '親方', '長老', '語り部'];
export const TIER_MULT = [1, 2, 4, 8, 16];

export const IDLE_K = 0.21; // 分あたり(研究値0.0035/秒×60)

// 施設: 生産ティア(コスト×12/パワー×3、係数1.07〜1.10 = AdCap/CC実測帯)+ 役物
export const FACILITIES = [
  { id: 'fire', name: '火をおこす', kind: 'gate', base: 10, growth: 1, max: 1, desc: '工房に火が入る。すべての始まり' },
  { id: 'fairy', name: '火守りの小妖精', kind: 'power', q: 1, base: 100, growth: 1.10, max: 400, desc: '放置生産の働き手(パワー1)' },
  { id: 'scribe', name: '絡繰り写本機', kind: 'power', q: 3, base: 1200, growth: 1.09, max: 400, desc: 'ことばを写して灯にする(パワー3)' },
  { id: 'kamado', name: '言霊の竈', kind: 'power', q: 9, base: 14000, growth: 1.08, max: 400, desc: '言霊の熱を蓄える(パワー9)' },
  { id: 'still', name: '想いの蒸留器', kind: 'power', q: 27, base: 170000, growth: 1.08, max: 400, desc: '想いを灯火に変える(パワー27)' },
  { id: 'shelf', name: '棚', kind: 'util', base: 25, growth: 2.5, max: 6, desc: '留守の蓄えが長くもつ(時間×2.5)' },
  { id: 'dorm', name: '修行場', kind: 'util', base: 80, growth: 2.0, max: 10, desc: '修行で一度に起こせる数 +4' },
  { id: 'ring', name: '呼び込みの鈴', kind: 'util', base: 150, growth: 5, max: 8, desc: '灯し場のタップ価値 ×2' },
  { id: 'bell', name: '鐘楼', kind: 'util', base: 120, growth: 1, max: 1, desc: '朝・昼・夜の鐘の時刻が見える' },
  { id: 'voice', name: '声の燈', kind: 'util', base: 150, growth: 1, max: 1, desc: 'ことばが声を持つ(聴き取りの想起)' },
  { id: 'helper', name: 'からくりの手', kind: 'util', base: 25000, growth: 8, max: 3, desc: '見ている間、お題にひとりでに応える' },
];

export function facilityPrice(f, owned) {
  return Math.round(f.base * Math.pow(f.growth, owned));
}

// 所持マイルストーン: 同一施設10/25/50/100/200台でパワー×2(研究: 倍率2 < 1.08^25)
const OWN_MILESTONES = [10, 25, 50, 100, 200];
export function ownMult(owned) {
  let m = 1;
  for (const t of OWN_MILESTONES) if (owned >= t) m *= 2;
  return m;
}

export function totalPower(profile) {
  let p = 0;
  for (const f of FACILITIES) {
    if (f.kind !== 'power') continue;
    const owned = profile.facilities[f.id] || 0;
    p += f.q * owned * ownMult(owned);
  }
  return p;
}

// 放置生産(灯火/分)。V_refに従属+log圧縮(本経済の心臓)
export function idlePerMin(profile) {
  if (!profile.facilities.fire) return 0;
  const P = totalPower(profile);
  if (P <= 0) return 0;
  return (profile.vref || 1) * IDLE_K * Math.log2(1 + P);
}

// 貯蔵: 「満タンまでの時間」を買う(棚×2.5)。上限は生産に比例して自動インフレ
const CAP_BASE_MIN = 45;
export function capMinutes(profile) {
  return CAP_BASE_MIN * Math.pow(2.5, profile.facilities.shelf || 0);
}
export function storageCap(profile) {
  const rate = idlePerMin(profile);
  return Math.max(60, Math.round(rate * capMinutes(profile)));
}

export function dormCap(profile) {
  return 8 + (profile.facilities.dorm || 0) * 6;
}

// うとうとの言霊の取り分が熟成マナに積もる(全体の40%×うとうと比率)
export const DROWSY_FACTOR = 0.4;
export function manaCapOf(profile, drowsyCount) {
  if (!drowsyCount) return 0;
  return (idlePerMin(profile) * DROWSY_FACTOR / drowsyCount) * 420; // 7時間ぶん/体
}

function drowsyWords(profile, index, at) {
  const out = [];
  for (const [w, c] of Object.entries(profile.cards)) {
    if (c.reps > 0 && index.byKey.has(w) && at >= quantizeDue(c.due)) out.push(w);
  }
  return out;
}

export function productionAt(profile, index, now) {
  const rate = idlePerMin(profile);
  const drowsy = drowsyWords(profile, index, now);
  const total = Math.max(1, Object.values(profile.cards).filter((c) => c.reps > 0).length);
  const share = Math.min(1, drowsy.length / total);
  return { rate: rate * (1 - DROWSY_FACTOR * share), drowsyCount: drowsy.length };
}

// 区間精算。5分刻みの決定論シミュレーション(オンラインのティックも同じ関数)
export function settle(profile, index, fromTs, toTs) {
  const MAXSPAN = 24 * 3600 * 1000;
  const from = Math.max(fromTs, toTs - MAXSPAN);
  const cap = storageCap(profile);
  let lights = profile.lights;
  let gained = 0;
  let cappedAt = null;
  const manaGained = {};
  const rate = idlePerMin(profile);

  if (rate <= 0 || toTs <= from) return { lights, gained: 0, cappedAt: null, manaGained };

  const total = Math.max(1, Object.values(profile.cards).filter((c) => c.reps > 0).length);
  const STEP = 5 * 60 * 1000;
  let t = from;
  while (t < toTs) {
    const dt = Math.min(STEP, toTs - t);
    const mins = dt / 60000;
    const mid = t + dt / 2;
    const drowsy = drowsyWords(profile, index, mid);
    const share = Math.min(1, drowsy.length / total);
    const flow = rate * (1 - DROWSY_FACTOR * share) * mins;
    // うとうとの取り分→熟成マナ(上限つき)
    if (drowsy.length) {
      const manaFlow = (rate * DROWSY_FACTOR * share * mins) / drowsy.length;
      const mc = manaCapOf(profile, drowsy.length);
      for (const w of drowsy) {
        const cur = (profile.mana[w] || 0) + (manaGained[w] || 0);
        const add = Math.min(manaFlow, Math.max(0, mc - cur));
        if (add > 0) manaGained[w] = (manaGained[w] || 0) + add;
      }
    }
    if (lights + flow >= cap) {
      if (cappedAt === null && flow > 0 && lights < cap) {
        cappedAt = t + dt * Math.max(0, Math.min(1, (cap - lights) / flow));
      }
      gained += Math.max(0, cap - lights);
      lights = cap;
    } else if (lights < cap) {
      lights += flow;
      gained += flow;
    }
    t += dt;
  }
  return { lights, gained, cappedAt, manaGained };
}

export function timeToFull(profile, index, now) {
  const { rate } = productionAt(profile, index, now);
  if (rate <= 0) return null;
  const room = storageCap(profile) - profile.lights;
  if (room <= 0) return 0;
  return (room / rate) * 60000;
}
