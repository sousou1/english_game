// 灯し場(マッチングプール): 上に日本語のお題、下に覚えた英単語のタイル。
// 該当する語をタップ→灯火+注文進捗。タップは「覚えた言葉の運用」そのもの。
// SRSのスケジュールには一切書き込まない(高速再認はノイズ。深い記憶は「起こす」が担う)。
//
// 数値はインフレ研究(Cookie Clicker/AdCap/Clicker Heroes/Egg Inc/Duolingo MM実測)準拠:
// - 語彙(線形入力)をマイルストーン層で指数出力に変換する
// - 誤タップ没収なし(コンボ切れ+0.4秒ロックのみ)
// - 正解タップレートの想定 0.7/秒、プール6枚=正解密度17%
import { rarityIndex } from './srs.js';
import { isDrowsy } from './schedule.js';

export const CURVE = {
  tapBase: 1,
  tierMult: [1, 2, 4, 8, 16, 32],          // 職位 2^rank(語り部の先に余白)
  milestones: [10, 50, 250, 1000, 5000],   // 語ごとの累計正解タップで×2(×5刻みで逓減)
  milestoneMult: 2,
  collMilestones: [25, 50, 100, 200, 300, 500, 750], // 累計習得語数で全体×2
  comboStep: 0.02,                          // +2%/連続
  comboCap: 50,                             // 上限×2
  feverAt: 25,                              // 連続正解でフィーバー
  feverMult: 3,
  feverMs: 15000,
  freshFast: { ms: 2000, mult: 1.5 },       // お題2秒以内の正解×1.5
  freshOk: { ms: 5000, mult: 1.2 },         // 5秒以内×1.2(遅くても減点なし)
  orderBase: 30,                            // 注文の要求仕事量(灯火建て)
  orderGrowth: 1.35,                        // 〜40注文
  orderGrowthLate: 1.13,                    // 41注文〜(二段勾配)
  orderKnee: 40,
  bigOrderEvery: 5,                         // 5注文ごとに大注文(要求×3)
  bigOrderMult: 3,
  poolSize: 6,
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
    this.feverUntil = 0;
    const p = this.app.profile;
    if (!p.taps) p.taps = {};
    if (!p.order) p.order = { n: 0, got: 0 };
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

  // 恒久全体倍率: コレクション×呼び込みの鈴
  globalMult() {
    const p = this.app.profile;
    return collMult(this.learnedEntries().length) * Math.pow(2, p.facilities.ring || 0);
  }

  // 語の価値 = 基礎 × 2^職位 × 語マイルストーン × 全体倍率
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
    let m = 1 + Math.min(this.combo, CURVE.comboCap) * CURVE.comboStep;
    if (Date.now() < this.feverUntil) m *= CURVE.feverMult;
    return m;
  }

  isBigOrder(n = this.app.profile.order.n) {
    return (n + 1) % CURVE.bigOrderEvery === 0;
  }

  orderTarget(n = this.app.profile.order.n) {
    const k = n + 1;
    let w;
    if (k <= CURVE.orderKnee) w = CURVE.orderBase * Math.pow(CURVE.orderGrowth, k - 1);
    else w = CURVE.orderBase * Math.pow(CURVE.orderGrowth, CURVE.orderKnee - 1) * Math.pow(CURVE.orderGrowthLate, k - CURVE.orderKnee);
    if (this.isBigOrder(n)) w *= CURVE.bigOrderMult;
    return Math.round(w);
  }

  orderReward(n = this.app.profile.order.n) {
    return Math.round(this.orderTarget(n) * 0.5); // 一時金=要求の50%(研究: W×0.5)
  }

  // プール補充。復習期限が近い語をやや優先(運用が復習の入り口になる)
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

  // タップ。autoはからくりの手(価値×0.5、コンボ・注文に乗らない)
  tap(w, { auto = false } = {}) {
    const p = this.app.profile;
    if (!this.cue) return null;
    const correct = w === this.cue.w;
    if (!correct) {
      this.combo = 0;
      return { correct: false, gain: 0, combo: 0 };
    }
    const taps = (p.taps[w] || 0) + 1;
    p.taps[w] = taps;
    const milestone = CURVE.milestones.includes(taps) ? taps : null;

    const base = this.wordValue(this.cue);
    let gain;
    let fever = false;
    if (auto) {
      gain = Math.max(1, Math.round(base * 0.5));
    } else {
      this.combo++;
      const dt = Date.now() - this.cueAt;
      const fresh = dt <= CURVE.freshFast.ms ? CURVE.freshFast.mult : dt <= CURVE.freshOk.ms ? CURVE.freshOk.mult : 1;
      gain = Math.max(1, Math.round(base * this.comboMult() * fresh));
      if (this.combo === CURVE.feverAt && Date.now() >= this.feverUntil) {
        this.feverUntil = Date.now() + CURVE.feverMs;
        fever = true;
      }
    }

    // V_ref: 直近タップ価値の移動平均(放置生産の参照値)
    p.vref = Math.max(this.globalMult(), p.vref * 0.97 + (auto ? base * 0.5 : gain / Math.max(1, this.comboMult())) * 0.03);

    // 注文の進捗は手動タップの獲得がそのまま乗る(獲得=納品)
    let orderDone = null;
    if (!auto) {
      p.order.got += gain;
      if (p.order.got >= this.orderTarget()) {
        orderDone = { reward: this.orderReward(), n: p.order.n, big: this.isBigOrder() };
        p.order.n++;
        p.order.got = 0;
      }
    }

    const idx = this.tiles.findIndex((e) => e.w === w);
    if (idx >= 0 && this.tiles.length >= CURVE.poolSize) this.swapTile(idx);
    this.pickCue();

    return { correct: true, gain, combo: this.combo, fever, feverActive: Date.now() < this.feverUntil, milestone, orderDone };
  }
}
