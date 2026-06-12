// 詠唱バトル(v3)。敵HP=旧「注文」の完全リスキン — 式・数値は不変。
// 不変条件:
//  B2 ダメージ=タップ獲得そのもの(攻撃=収入)→ 敗北しても構造的に損失ゼロ
//  B3 誤答は被ダメ・敵ゲージ・SRSに一切接続しない
//  B5 Lv/EXPは攻撃力に乗らない(HP・会心のみ)。火力は語彙経済が独占
//  B6 討伐数(解禁クロック)は手動タップでのみ進む
export const BATTLE = {
  bossEvery: 5,
  chapterBosses: [20, 50, 90, 140],
  chapterHpMult: 5 / 3,        // 中ボス×3に重ねて計×5
  barrierShare: 0.75,          // 結界75%(無タイマー)+本体25%(討伐チャンス)
  bossAtkMs: 5000,
  chapterAtkMs: 4500,
  hitsToDie: 13,               // 順調ペースで約65秒生存する正規化
  retreatScar: 0.05,
  retreatScarCap: 0.30,
  hpBase: 80,
  hpPerLv: 20,
  critBase: 0.04,
  critPerLv: 0.002,
  critLvCap: 0.06,
  critTotalCap: 0.20,
  critMult: 2,
  goldRate: 0.5,
  weaponEvery: 10,
  exp: { tap: 1, recall: 15, mikiri: 25, graduate: 40, invite: 10, kill: 10, boss: 150 },
};

// 旧 orderTarget と同一の式(検証済みペーシングを差分ゼロで継承)
export function enemyHp(k) {
  const ORDER = { base: 30, growth: 1.35, late: 1.13, knee: 40 };
  const n = k + 1; // k は0始まりの討伐済み数
  let w;
  if (n <= ORDER.knee) w = ORDER.base * Math.pow(ORDER.growth, n - 1);
  else w = ORDER.base * Math.pow(ORDER.growth, ORDER.knee - 1) * Math.pow(ORDER.late, n - ORDER.knee);
  if (n % BATTLE.bossEvery === 0) w *= 3;
  if (BATTLE.chapterBosses.includes(n)) w *= BATTLE.chapterHpMult;
  return Math.round(w);
}

export function isMidBoss(k) { return (k + 1) % BATTLE.bossEvery === 0; }
export function isChapterBoss(k) { return BATTLE.chapterBosses.includes(k + 1); }

export function expNext(L) { return Math.round(100 * Math.pow(L, 1.4)); }

export function levelOf(exp) {
  let L = 1;
  let rem = exp;
  while (rem >= expNext(L) && L < 99) { rem -= expNext(L); L++; }
  return { level: L, into: rem, next: expNext(L) };
}

export function hpMax(level) { return BATTLE.hpBase + BATTLE.hpPerLv * level; }

export function critChance(level, weaponBonus = 0) {
  const lv = Math.min(BATTLE.critLvCap, BATTLE.critPerLv * level);
  return Math.min(BATTLE.critTotalCap, BATTLE.critBase + lv + weaponBonus);
}

// ボス本体の攻撃力: 「順調なプレイヤーが13発耐える」HPモデルから逆算
export function bossAtk(bossNumber) {
  const hpModel = 80 + 20 * Math.pow(55.4 * Math.max(1, bossNumber - 1), 1 / 2.4);
  return Math.round(hpModel / BATTLE.hitsToDie);
}

// ---- 武器(=経済仕様の「銘」スロット。ゴールド建て) ----
export const WEAPONS = [
  { id: 0, name: '樫の杖', icon: '🪄', mult: 1, trait: null, traitDesc: 'はじまりの杖' },
  { id: 1, name: '旅装の短剣', icon: '🗡️', mult: 2, trait: 'comboGuard', traitDesc: '誤タップ1回までコンボを守る(60秒に1回)' },
  { id: 2, name: '蒼火の魔杖', icon: '🔱', mult: 2, trait: 'crit4', traitDesc: '会心+4%' },
  { id: 3, name: '風詠みの弓', icon: '🏹', mult: 2, trait: 'rushExt', traitDesc: '詠唱ラッシュ上限+3秒' },
  { id: 4, name: '月鋼の剣', icon: '⚔️', mult: 2, trait: 'freshExt', traitDesc: '鮮度の速窓2秒→3秒' },
  { id: 5, name: '竜骨の大杖', icon: '🦴', mult: 2, trait: 'guard25', traitDesc: 'ボス戦の被ダメ−25%' },
];

export function weaponAt(i) {
  if (i < WEAPONS.length) return WEAPONS[i];
  const names = ['星鉄の刃', '雷鳴の槍', '緋色の魔斧', '霧氷の刺剣', '黄金の戦鎚'];
  const traits = ['comboGuard', 'crit4', 'rushExt', 'freshExt', 'guard25'];
  const j = (i - WEAPONS.length) % names.length;
  const grade = Math.floor((i - WEAPONS.length) / names.length) + 2;
  return {
    id: i, name: `${names[j]}+${grade}`, icon: '✨', mult: 1.5,
    trait: traits[j], traitDesc: WEAPONS[j + 1].traitDesc + '(強化版)',
  };
}

export function weaponMultTotal(profile) {
  let m = 1;
  for (const i of profile.weapons || []) m *= weaponAt(i).mult;
  return m;
}

export function equippedTrait(profile) {
  const eq = profile.equip ?? 0;
  if (!(profile.weapons || []).includes(eq) && eq !== 0) return null;
  return weaponAt(eq).trait;
}

// 直近の中ボスHP = 武器価格
export function weaponPrice(kills) {
  const lastMid = Math.max(5, Math.floor(kills / BATTLE.bossEvery) * BATTLE.bossEvery);
  return enemyHp(lastMid - 1);
}

export function weaponsAvailable(profile) {
  const owned = (profile.weapons || []).length;
  const rights = Math.floor((profile.battle?.kills || 0) / BATTLE.weaponEvery);
  return Math.max(0, rights - Math.max(0, owned - 1)); // 初期装備0番は権利消費なし
}

// ---- バトル状態機械 ----
export class Battle {
  constructor(app) {
    this.app = app;
    const p = app.profile;
    if (!p.battle) p.battle = { kills: 0, dmg: 0 };
    if (p.gold == null) p.gold = 0;
    if (p.exp == null) p.exp = 0;
    if (!p.weapons) { p.weapons = [0]; p.equip = 0; }
    if (!p.boss) p.boss = { engaged: false, bodyHp: null, scars: 0, hp: null, nextAtk: 0 };
    this.events = [];
  }

  hp(k = this.app.profile.battle.kills) { return enemyHp(k); }
  isBossNow() { return isMidBoss(this.app.profile.battle.kills) || isChapterBoss(this.app.profile.battle.kills); }
  barrierMax() { return Math.round(this.hp() * (this.isBossNow() ? BATTLE.barrierShare : 1)); }
  bodyMax() {
    const base = Math.round(this.hp() * (1 - BATTLE.barrierShare));
    const scar = Math.min(BATTLE.retreatScarCap, (this.app.profile.boss.scars || 0) * BATTLE.retreatScar);
    return Math.round(base * (1 - scar));
  }

  level() { return levelOf(this.app.profile.exp); }

  addExp(kind) {
    const p = this.app.profile;
    const before = levelOf(p.exp).level;
    p.exp += BATTLE.exp[kind] || 0;
    const after = levelOf(p.exp).level;
    if (after > before) {
      // レベルアップ: HP全回復(討伐チャンス中なら逆転の高揚)
      if (p.boss.engaged) p.boss.hp = hpMax(after);
      return after;
    }
    return null;
  }

  // 手動タップのダメージ適用。{kill, gold, exp, barrierBroken, levelUp} を返す
  applyDamage(dmg) {
    const p = this.app.profile;
    const out = { kill: false, gold: 0, barrierBroken: false, levelUp: null, bossReady: false };
    out.levelUp = this.addExp('tap');

    if (this.isBossNow()) {
      if (p.boss.engaged) {
        p.boss.bodyHp -= dmg;
        if (p.boss.bodyHp <= 0) return { ...out, ...this.finishKill(true) };
        return out;
      }
      // 結界フェーズ
      const before = p.battle.dmg;
      p.battle.dmg = Math.min(this.barrierMax(), p.battle.dmg + dmg);
      if (before < this.barrierMax() && p.battle.dmg >= this.barrierMax()) {
        out.barrierBroken = true;
        out.bossReady = true;
      }
      return out;
    }

    // 雑魚: ダメージ永続、倒し切りで討伐
    p.battle.dmg += dmg;
    if (p.battle.dmg >= this.hp()) return { ...out, ...this.finishKill(false) };
    return out;
  }

  finishKill(wasBoss) {
    const p = this.app.profile;
    const k = p.battle.kills;
    const gold = Math.round(this.hp(k) * BATTLE.goldRate);
    p.gold += gold;
    const lv = this.addExp(wasBoss || isMidBoss(k) || isChapterBoss(k) ? 'boss' : 'kill');
    p.battle.kills++;
    p.battle.dmg = 0;
    p.boss = { ...p.boss, engaged: false, bodyHp: null, scars: 0, hp: null, nextAtk: 0 };
    this.app.save();
    return { kill: true, gold, killedIndex: k, levelUp: lv, chapterBoss: isChapterBoss(k), midBoss: isMidBoss(k) };
  }

  // 討伐チャンス(プレイヤー起点)
  engageBoss(now = Date.now()) {
    const p = this.app.profile;
    if (!this.isBossNow() || p.boss.engaged) return false;
    if (p.battle.dmg < this.barrierMax()) return false;
    const L = this.level().level;
    p.boss.engaged = true;
    p.boss.bodyHp = this.bodyMax();
    p.boss.hp = hpMax(L);
    p.boss.nextAtk = now + this.atkPeriod();
    return true;
  }

  atkPeriod() {
    return isChapterBoss(this.app.profile.battle.kills) ? BATTLE.chapterAtkMs : BATTLE.bossAtkMs;
  }

  bossNumber() { return Math.floor(this.app.profile.battle.kills / BATTLE.bossEvery) + 1; }

  // 1秒ティック。討伐チャンス中の敵攻撃。{attacked, dmg, defeated} を返す
  tick(now = Date.now()) {
    const p = this.app.profile;
    if (!p.boss.engaged) return null;
    if (now < p.boss.nextAtk) return null;
    p.boss.nextAtk = now + this.atkPeriod();
    let dmg = bossAtk(this.bossNumber());
    if (equippedTrait(p) === 'guard25') dmg = Math.round(dmg * 0.75);
    p.boss.hp -= dmg;
    if (p.boss.hp <= 0) {
      this.retreat();
      return { attacked: true, dmg, defeated: true };
    }
    return { attacked: true, dmg, defeated: false };
  }

  // 撤退 = 軽い後退。失うものは何もない(結界は壊れたまま、傷痕で本体上限−5%)
  retreat() {
    const p = this.app.profile;
    if (!p.boss.engaged) return;
    p.boss.engaged = false;
    p.boss.bodyHp = null;
    p.boss.scars = Math.min(6, (p.boss.scars || 0) + 1);
    this.app.save();
  }

  // 武器購入
  buyWeapon() {
    const p = this.app.profile;
    if (weaponsAvailable(p) <= 0) return null;
    const price = weaponPrice(p.battle.kills);
    if (p.gold < price) return null;
    p.gold -= price;
    const next = (p.weapons || []).length; // 次の番号
    p.weapons.push(next);
    p.equip = next;
    this.app.save();
    return weaponAt(next);
  }
}
