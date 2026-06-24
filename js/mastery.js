// 単語マスター(昇華)― D1。設計: docs/sublimation-design.md(ペルソナ評価で §9 確定)。
// 習熟回数 ans = SRS復習回数(card.reps) + バトル詠唱回数(p.taps[w]・上限cap) の合算で“導出”する
//   → 別カウンタ不要・migrate不要、かつ tapCap で「連打だけで30」を防ぎ SRS reps を必須化。
// 昇華可 = 未昇華 かつ ans>=ansThreshold かつ 定着 card.S>=sMin(未定着卒業の防止)。
// 昇華すると通常ローテから卒業(=出題プール除外+10%枠の誤答重み再出題)。効果(係数/ローテ)は別段で実装。
// ⚠ 数値(ansThreshold/tapCap/sMin)は30日再シム(tests/_sim_v6.mjs)で確定する“暫定既定”。
export const MASTERY = {
  ansThreshold: 30, // 昇華に要る習熟回数(ユーザ指定30)
  tapCap: 20,       // タップ寄与の上限(連打だけで閾値に届かせない=reps必須化)
  sMin: 7,          // 未定着昇華の防止: 定着度S>=7(銀)併用
  undoMs: 24 * 3600 * 1000, // 昇華取消が効く窓(誤爆救済・クールダウン)
  reviewChance: 0.10, // 昇華語をバトル詠唱に混ぜる確率(卒業しても10%枠で復習・忘れ防止)
};

// 昇華係数(基礎能力↑): collMult と同型のマイルストーン式(×2)。globalMult に乗算で追加する新規因子。
//   ・経済安全: globalMult はタップ価値と放置生産(vref経由)の両方に乗るため、本係数を掛けても
//     放置:タップ比は不変(両辺が同じ係数で伸びる)。章ゲート(settled語数)にも非干渉(係数はダメージのみ)。
//   ・段の谷間対策の即時昇華ボーナス(灯火/EXP少額)は別途UI段で。
//   ⚠ 節目は30日再シムで確定する“暫定既定”(sublMult(0)=1.0 は不変=無昇華時は現行と完全一致)。
export const SUBL_MILESTONES = [5, 12, 25, 50, 100];
export function sublMult(count) {
  let m = 1;
  for (const t of SUBL_MILESTONES) if (count >= t) m *= 2;
  return m;
}

// 次の昇華係数アップ(=次解禁)までに要る昇華数。UIの「次解禁まであとN」に使う。
export function nextSublMilestone(count) {
  for (const t of SUBL_MILESTONES) if (count < t) return t;
  return null; // 最終段に到達
}

// 習熟回数(導出)。
export function masteryAns(p, w) {
  const c = p.cards && p.cards[w];
  const reps = (c && c.reps) || 0;
  const taps = Math.min(p.taps && p.taps[w] || 0, MASTERY.tapCap);
  return reps + taps;
}

export function isSublimated(p, w) {
  return !!(p.mastery && p.mastery.sub && p.mastery.sub[w]);
}

export function sublimatedCount(p) {
  return p.mastery && p.mastery.sub ? Object.keys(p.mastery.sub).length : 0;
}

// 昇華可否: 未昇華 かつ 習熟回数>=閾値 かつ 定着S>=sMin。
export function canSublimate(p, w) {
  if (isSublimated(p, w)) return false;
  const c = p.cards && p.cards[w];
  if (!c || !c.reps) return false;
  return masteryAns(p, w) >= MASTERY.ansThreshold && (c.S || 0) >= MASTERY.sMin;
}

// 習熟回数は満ちたが定着Sが足りず昇華できない状態(UIで鍵付き非活性+理由表示に使う)。
export function pendingS(p, w) {
  if (isSublimated(p, w)) return false;
  const c = p.cards && p.cards[w];
  if (!c || !c.reps) return false;
  return masteryAns(p, w) >= MASTERY.ansThreshold && (c.S || 0) < MASTERY.sMin;
}

export function sublimate(p, w, now = Date.now()) {
  if (!canSublimate(p, w)) return false;
  if (!p.mastery) p.mastery = { sub: {} };
  if (!p.mastery.sub) p.mastery.sub = {};
  p.mastery.sub[w] = now;
  return true;
}

// 取消はクールダウン窓(undoMs)内のみ可(誤爆救済)。窓を過ぎたら恒久。
export function canUndo(p, w, now = Date.now()) {
  const at = p.mastery && p.mastery.sub && p.mastery.sub[w];
  return !!at && (now - at) <= MASTERY.undoMs;
}

export function unsublimate(p, w, now = Date.now()) {
  if (!canUndo(p, w, now)) return false;
  delete p.mastery.sub[w];
  return true;
}

// 昇華済みの語リスト(古い順)。
export function sublimatedWords(p) {
  const sub = p.mastery && p.mastery.sub || {};
  return Object.keys(sub).sort((a, b) => sub[a] - sub[b]);
}

// 昇華語から「過去に間違えた回数(lapses)が多いほど選ばれやすい」重みで1語抽選(誤りやすい語を忘れさせない)。
// rng は [0,1) を返す関数(テスト用に差し替え可。既定 Math.random)。昇華語が無ければ null。
export function pickReviewWord(p, cards, rng = Math.random) {
  const subs = sublimatedWords(p);
  if (!subs.length) return null;
  const weights = subs.map((w) => (((cards && cards[w]) || {}).lapses || 0) + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < subs.length; i++) { r -= weights[i]; if (r <= 0) return subs[i]; }
  return subs[subs.length - 1];
}
