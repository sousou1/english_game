// 武器ハクスラ: ドロップ・装備・原神式強化・分解・図鑑。
// 不変条件: 成長勾配はグレードG(g)のみ(旧K_weaponと同一指数=健全性0.33<1継承)。
// その他の係数は生涯有界(×3.12)。未開封は消失しない。SRSに不干渉。
import { ARMORY } from '../data/weapons.js';
import { enemyHp, BATTLE } from './battle.js';

export function gradeMult(g) {
  return Math.pow(2, Math.min(g, 5)) * Math.pow(1.5, Math.max(0, g - 5));
}

export function weaponDef(wid) {
  return ARMORY.weapons.find((w) => w.id === wid) || ARMORY.weapons[0];
}

export function weaponMult(w) {
  const rar = ARMORY.rarities[w.rar];
  return rar.atkBase * gradeMult(w.grade) * (1 + ARMORY.enhance.atkPerLv * (w.lv || 0));
}

export function codexMult(p) {
  return 1 + Math.min(ARMORY.codex.cap, ARMORY.codex.perEntry * (p.armory.codex || []).length);
}

// pool.js globalMult() に乗る恒久部(装備中1本×図鑑)
export function armoryMult(p) {
  const eq = equipped(p);
  return (eq ? weaponMult(eq) : 1) * codexMult(p);
}

export function equipped(p) {
  return p.armory.inv.find((w) => w.uid === p.armory.equip) || null;
}

// 装備特性+サブステの合算(R2: 加算、R3: キャップ)
export function equippedEffects(p) {
  const out = { critRate: 0, critDmg: 0, rushExt: 0, freshExt: 0, goldGain: 0, manaGain: 0, comboGuard: 0, bossGuard: 0, field: {} };
  const eq = equipped(p);
  if (!eq) return out;
  const def = weaponDef(eq.wid);
  const add = (id, v) => {
    if (id.startsWith('field_')) out.field[id.slice(6)] = (out.field[id.slice(6)] || 0) + v;
    else out[id] = (out[id] || 0) + v;
  };
  if (def.trait === 'comboGuard') out.comboGuardBase = def.traitVal; // CD秒(サブステは短縮)
  else if (def.trait) add(def.trait, def.traitVal);
  for (const s of eq.subs || []) {
    const m = ARMORY.substats.find((x) => x.id === s.id);
    if (m) add(s.id, s.rolls.reduce((a, r) => a + m.max * r, 0));
  }
  out.bossGuard = Math.min(ARMORY.caps.dmgReduce, out.bossGuard);
  out.goldGain = Math.min(ARMORY.caps.goldBonus, out.goldGain);
  out.rushExt = Math.min(ARMORY.caps.rushExtMs / 1000, out.rushExt);
  return out;
}

function pick(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, v] of Object.entries(weights)) { r -= v; if (r <= 0) return k; }
  return Object.keys(weights)[0];
}

const RAR_ORDER = ['N', 'R', 'SR', 'SSR'];

// ドロップ判定(pity込み)。{wid, rar, grade} | null
export function dropRoll(p, kind, slot = 0) {
  const a = p.armory;
  let rarTable;
  if (kind === 'chapter') rarTable = ARMORY.dropTable.chapter[Math.min(slot, 1)];
  else {
    const t = ARMORY.dropTable[kind];
    if (Math.random() > t.rate) return null;
    rarTable = t.rar;
  }
  let rar = pick(rarTable);
  a.pity = (a.pity || 0) + 1;
  if (a.pity >= ARMORY.dropTable.pity) rar = 'SSR'; // 天井
  if (rar === 'SSR') a.pity = 0;
  // 銘: レア下限を満たすものから抽選
  const cands = ARMORY.weapons.filter((w) => !w.rarMin || RAR_ORDER.indexOf(rar) >= RAR_ORDER.indexOf(w.rarMin));
  const def = cands[Math.floor(Math.random() * cands.length)];
  const grade = Math.floor((p.battle.kills || 0) / BATTLE.weaponEvery);
  return { wid: def.id, rar, grade };
}

let uidCounter = 0;
function newUid() { return `w${Date.now().toString(36)}${(uidCounter++).toString(36)}`; }

// 回収箱に積む(B6: 開封は手動)
export function pushBox(p, roll) {
  if (!roll) return null;
  if (p.armory.box.length >= ARMORY.inventory.box) p.armory.box.shift();
  const item = { ...roll, uid: newUid() };
  p.armory.box.push(item);
  return item;
}

function rollSub(existing) {
  const used = new Set(existing.map((s) => s.id));
  const pool = {};
  for (const s of ARMORY.substats) if (!used.has(s.id)) pool[s.id] = s.w;
  if (!Object.keys(pool).length) return null;
  const id = pick(pool);
  const tier = ARMORY.enhance.rollTiers[Math.floor(Math.random() * 4)];
  return { id, rolls: [tier] };
}

// 開封: 箱→インベントリ(初期サブステ付与)。{item, isNew}
export function openDrop(p, uid) {
  const i = p.armory.box.findIndex((b) => b.uid === uid);
  if (i < 0) return null;
  const roll = p.armory.box.splice(i, 1)[0];
  const rar = ARMORY.rarities[roll.rar];
  const item = { ...roll, lv: 0, spent: 0, subs: [], lock: false };
  for (let k = 0; k < rar.subInit; k++) {
    const s = rollSub(item.subs);
    if (s) item.subs.push(s);
  }
  // インベントリ満杯: 未ロック最低レアを自動分解(砥石満額)
  if (p.armory.inv.length >= ARMORY.inventory.cap + (p.armory.capExt || 0)) {
    const sorted = [...p.armory.inv].filter((w) => !w.lock && w.uid !== p.armory.equip)
      .sort((a, b) => RAR_ORDER.indexOf(a.rar) - RAR_ORDER.indexOf(b.rar) || a.grade - b.grade);
    if (sorted[0]) salvage(p, sorted[0].uid, true);
  }
  p.armory.inv.push(item);
  const codexKey = `${item.wid}:${item.rar}`;
  let isNew = false;
  if (!p.armory.codex.includes(codexKey)) { p.armory.codex.push(codexKey); isNew = true; }
  return { item, isNew };
}

export function enhanceCost(p, w) {
  const P = enemyHp(Math.max(4, Math.floor((p.battle.kills || 1) / BATTLE.bossEvery) * BATTLE.bossEvery - 1));
  const cr = ARMORY.rarities[w.rar].costMul;
  return Math.max(10, Math.round(ARMORY.enhance.costBase * P * Math.pow(ARMORY.enhance.costGrowth, w.lv) * cr));
}

// 強化: ゴールド消費→Lv+1。4の倍数Lvでサブステイベント。{lv, sub} | null
export function enhance(p, uid) {
  const w = p.armory.inv.find((x) => x.uid === uid);
  if (!w || w.lv >= ARMORY.enhance.maxLv) return null;
  const cost = enhanceCost(p, w);
  if (p.gold < cost) return null;
  p.gold -= cost;
  w.spent = (w.spent || 0) + cost;
  w.lv++;
  let sub = null;
  if (ARMORY.enhance.subLvs.includes(w.lv)) {
    const max = ARMORY.rarities[w.rar].subMax;
    if (w.subs.length < max) {
      sub = rollSub(w.subs);
      if (sub) w.subs.push(sub);
    } else {
      const t = w.subs[Math.floor(Math.random() * w.subs.length)];
      t.rolls.push(ARMORY.enhance.rollTiers[Math.floor(Math.random() * 4)]);
      sub = t;
    }
  }
  return { lv: w.lv, sub };
}

// 分解: 砥石+投資30%返却。図鑑は永続
export function salvage(p, uid, auto = false) {
  const i = p.armory.inv.findIndex((x) => x.uid === uid);
  if (i < 0 || p.armory.inv[i].uid === p.armory.equip) return null;
  const w = p.armory.inv.splice(i, 1)[0];
  const whet = ARMORY.rarities[w.rar].whet;
  p.armory.whet = (p.armory.whet || 0) + whet;
  const refund = Math.round((w.spent || 0) * ARMORY.salvage.goldRefund);
  p.gold += refund;
  return { whet, refund, auto };
}
