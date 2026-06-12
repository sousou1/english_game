// 詠唱プール(v3): 日本語のお題→英単語タイル6枚から該当をタップ=詠唱攻撃。
// タップは「覚えた言葉の運用」。SRSには1バイトも書き込まない(B7)。
// 数値はインフレ研究+v3統合仕様準拠。誤タップ没収なし(コンボ切れ+0.4秒ロックのみ)。
import { rarityIndex } from './srs.js';
import { isDrowsy } from './schedule.js';
import { critChance } from './battle.js';
import { armoryMult, equippedEffects } from './armory.js';
import { jobMod } from './jobs.js';

export const CURVE = {
  tapBase: 1,
  tierMult: [1, 2, 4, 8, 16, 32],
  milestones: [10, 50, 250, 1000, 5000],
  milestoneMult: 2,
  collMilestones: [25, 50, 100, 200, 300, 500, 750],
  comboStep: 0.02,
  comboCap: 50,
  freshFast: { ms: 2000, mult: 1.5 },
  freshOk: { ms: 5000, mult: 1.2 },
  poolSize: 6,
  // 詠唱ラッシュ(時限フィーバー): 本物の賭けタイマーのみ
  fever: {
    gaugeMax: 25,
    lossMiss: 3,
    idleDecayAfterMs: 3000, // 3秒無操作で減衰開始
    decayPerSec: 1,
    holdMs: 30000,          // 満タン保持30秒、以降−1/秒(点火を迫る本物の賭け)
    baseMs: 10000,          // 基本10秒
    extendMs: 400,          // 正解ごとに+0.4秒
    capMs: 18000,           // 上限18秒(風詠みの弓で21秒)
    mult: 3,
    chainStep: 0.25,        // 連鎖で×3.0→×3.25→…→×4.0
    chainCap: 4,
    chainWindowMs: 45000,   // 終了後45秒以内の再点火で連鎖継続
    emberG: 6,              // 残り火: 終了後ゲージ6から
    afterglowMs: 15000,     // 余韻15秒: ゲージ上昇2倍
  },
};

export function collMult(learnedCount) {
  let m = 1;
  for (const t of CURVE.collMilestones) if (learnedCount >= t) m *= 2;
  return m;
}

export class Pool {
  constructor(app) {
    this.app = app;
    this.tiles = [];
    this.cue = null;
    this.cueAt = 0;
    this.combo = 0;
    // ラッシュ状態機械
    this.g = 0;
    this.mode = 'idle'; // idle | ready | rush
    this.readyAt = 0;
    this.rushEndsAt = 0;
    this.rushCapAt = 0;
    this.chain = 0;
    this.chainWindowUntil = 0;
    this.afterglowUntil = 0;
    this.lastTapAt = 0;
    this.guardUsedAt = 0;
    const p = this.app.profile;
    if (!p.taps) p.taps = {};
    if (!p.vref) p.vref = 1;
  }

  learnedEntries() {
    const p = this.app.profile;
    const out = [];
    for (const w of Object.keys(p.cards)) {
      const e = this.app.index.byKey.get(w);
      if (e && p.cards[w].reps > 0) out.push(e);
    }
    for (const w of Object.keys(p.steps)) {
      const e = this.app.index.byKey.get(w);
      if (e) out.push(e);
    }
    return out;
  }

  available() { return this.learnedEntries().length >= 3; }

  globalMult() {
    const p = this.app.profile;
    return collMult(this.learnedEntries().length) * Math.pow(2, p.facilities.ring || 0) * armoryMult(p);
  }

  wordValue(entry) {
    const p = this.app.profile;
    const card = p.cards[entry.w];
    const tier = card ? rarityIndex(card) : 0;
    const taps = p.taps[entry.w] || 0;
    let mult = CURVE.tierMult[tier] || 1;
    for (const m of CURVE.milestones) if (taps >= m) mult *= CURVE.milestoneMult;
    return CURVE.tapBase * mult * this.globalMult();
  }

  comboMult() {
    const cap = jobMod(this.app.profile, 'comboCap', CURVE.comboCap);
    return 1 + Math.min(this.combo, cap) * CURVE.comboStep;
  }

  rushActive(now = Date.now()) { return this.mode === 'rush' && now < this.rushEndsAt; }

  rushMult() {
    return CURVE.fever.mult + CURVE.fever.chainStep * Math.min(this.chain, CURVE.fever.chainCap);
  }

  afterglow(now = Date.now()) { return now < this.afterglowUntil; }

  // ---- プール ----
  refill() {
    const p = this.app.profile;
    const all = this.learnedEntries();
    if (all.length < 3) { this.tiles = []; this.cue = null; return; }
    const now = Date.now();
    const scored = all.map((e) => {
      const c = p.cards[e.w];
      const due = c && isDrowsy(c, now) ? 0 : 1;
      return { e, k: due + Math.random() };
    }).sort((a, b) => a.k - b.k);
    this.tiles = scored.slice(0, Math.min(CURVE.poolSize, all.length)).map((x) => x.e);
    this.pickCue();
  }

  pickCue() {
    const p = this.app.profile;
    if (!this.tiles.length) { this.cue = null; return; }
    const weights = this.tiles.map((e) => 1 / (1 + (p.taps[e.w] || 0) / 25));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < this.tiles.length; i++) {
      r -= weights[i];
      if (r <= 0) { this.cue = this.tiles[i]; this.cueAt = Date.now(); return; }
    }
    this.cue = this.tiles[this.tiles.length - 1];
    this.cueAt = Date.now();
  }

  swapTile(idx) {
    const all = this.learnedEntries();
    const used = new Set(this.tiles.map((e) => e.w));
    const cand = all.filter((e) => !used.has(e.w));
    if (cand.length) this.tiles[idx] = cand[Math.floor(Math.random() * cand.length)];
  }

  // ---- ラッシュ操作 ----
  ignite(now = Date.now()) {
    if (this.mode !== 'ready') return false;
    this.chain = now < this.chainWindowUntil ? Math.min(this.chain + 1, CURVE.fever.chainCap) : 0;
    const fx = equippedEffects(this.app.profile);
    const cap = CURVE.fever.capMs + Math.min(8000, (fx.rushExt || 0) * 1000);
    this.mode = 'rush';
    this.rushEndsAt = now + CURVE.fever.baseMs;
    this.rushCapAt = now + cap;
    this.g = 0;
    return true;
  }

  // 1秒ティック。{rushEnded, readyExpired} を返す
  tickSecond(now = Date.now()) {
    const out = { rushEnded: false };
    if (this.mode === 'rush' && now >= this.rushEndsAt) {
      this.mode = 'idle';
      this.g = CURVE.fever.emberG;
      this.chainWindowUntil = now + jobMod(this.app.profile, 'chainWindowMs', CURVE.fever.chainWindowMs);
      this.afterglowUntil = now + CURVE.fever.afterglowMs;
      out.rushEnded = true;
      return out;
    }
    if (this.mode === 'ready') {
      if (now - this.readyAt > CURVE.fever.holdMs) {
        this.g = Math.max(0, this.g - CURVE.fever.decayPerSec);
        if (this.g < CURVE.fever.gaugeMax) this.mode = 'idle';
      }
      return out;
    }
    if (this.mode === 'idle' && this.g > 0 && now - this.lastTapAt > CURVE.fever.idleDecayAfterMs) {
      this.g = Math.max(0, this.g - CURVE.fever.decayPerSec);
    }
    return out;
  }

  // ---- タップ ----
  tap(w, { auto = false } = {}) {
    const p = this.app.profile;
    const now = Date.now();
    if (!this.cue) return null;
    const correct = w === this.cue.w;

    if (!correct) {
      let guarded = false;
      const fx = equippedEffects(p);
      const hasGuard = (fx.comboGuardBase || 0) > 0 || (fx.comboGuard || 0) > 0;
      const guardCd = Math.max(30, (fx.comboGuardBase || 90) - (fx.comboGuard || 0)) * 1000;
      if (!auto && hasGuard && now - this.guardUsedAt > guardCd) {
        this.guardUsedAt = now;
        guarded = true; // 武器がコンボを守った
      } else if (!auto && jobMod(p, 'missHalvesCombo', false)) {
        this.combo = Math.floor(this.combo / 2); // 剣士: 半減止まり
      } else {
        this.combo = 0;
      }
      if (!auto && this.mode !== 'rush') this.g = Math.max(0, this.g - CURVE.fever.lossMiss);
      this.lastTapAt = now;
      return { correct: false, gain: 0, combo: this.combo, guarded };
    }

    const taps = (p.taps[w] || 0) + 1;
    p.taps[w] = taps;
    const milestone = CURVE.milestones.includes(taps) ? taps : null;
    const base = this.wordValue(this.cue);

    let gain; let crit = false; let fresh = 1; let gaugeReady = false;
    if (auto) {
      gain = Math.max(1, Math.round(base * 0.5));
    } else {
      this.combo++;
      this.lastTapAt = now;
      const fx = equippedEffects(p);
      const fastMs = CURVE.freshFast.ms + (fx.freshExt || 0) * 1000;
      const dt = now - this.cueAt;
      const fMult = jobMod(p, 'freshFastMult', CURVE.freshFast.mult);
      const oMult = jobMod(p, 'freshOkMult', CURVE.freshOk.mult);
      fresh = dt <= fastMs ? fMult : dt <= CURVE.freshOk.ms ? oMult : 1;
      const rush = this.rushActive(now) ? this.rushMult() : 1;
      const critP = critChance(this.app.battleLevel || 1, fx.critRate || 0);
      crit = Math.random() < critP;
      const critM = crit ? Math.min(3, 2 + (fx.critDmg || 0)) : 1;
      const post = 1 + (fx.manaGain || 0) + (fx.field[this.cue.f] || 0); // 有界後置部(vref非追跡)
      gain = Math.max(1, Math.round(base * this.comboMult() * fresh * rush * critM * post));

      // ラッシュ延長 or ゲージ充填
      if (this.rushActive(now)) {
        this.rushEndsAt = Math.min(this.rushEndsAt + CURVE.fever.extendMs, this.rushCapAt);
      } else {
        this.g += this.afterglow(now) ? 2 : 1;
        const gMax = jobMod(p, 'gaugeMax', CURVE.fever.gaugeMax);
        if (this.g >= gMax && this.mode === 'idle') {
          this.g = gMax;
          this.mode = 'ready';
          this.readyAt = now;
          gaugeReady = true;
        }
      }
    }

    // V_ref: 放置生産の参照値(恒久部のみの移動平均)
    p.vref = Math.max(this.globalMult(), p.vref * 0.97 + base * 0.03);

    const idx = this.tiles.findIndex((e) => e.w === w);
    if (idx >= 0 && this.tiles.length >= CURVE.poolSize) this.swapTile(idx);
    this.pickCue();

    return {
      correct: true, gain, combo: this.combo, crit, fresh, milestone, gaugeReady,
      rush: this.rushActive(now) ? { mult: this.rushMult(), endsAt: this.rushEndsAt } : null,
    };
  }
}
