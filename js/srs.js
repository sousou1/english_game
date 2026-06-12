// FSRS風の簡易スケジューラ。
// 忘却曲線: R(t) = (1 + k·t/S)^(-0.5)。S日後にちょうど R≈0.9 になる(SはFSRSのStability相当)。
// レアリティは記憶安定性Sそのもの — 想起でしか上がらない。

export const DAY = 86400000;

export const RARITY = [
  { key: 'rust',   name: '錆鉄', color: '#8d8275', min: 0 },
  { key: 'bronze', name: '青銅', color: '#cd8f4f', min: 3 },
  { key: 'silver', name: '白銀', color: '#d4dde8', min: 10 },
  { key: 'gold',   name: '黄金', color: '#ffd166', min: 30 },
  { key: 'star',   name: '星鋼', color: '#8fd4ff', min: 90 },
];

const K = 19 / 81; // R(S)=0.9 となる係数

export function newCard(now = Date.now()) {
  return { S: 0, D: 5, last: now, due: now, reps: 0, lapses: 0 };
}

export function retrievability(card, now = Date.now()) {
  if (!card || !card.reps) return 0;
  const t = Math.max(0, (now - card.last) / DAY);
  return Math.pow(1 + K * (t / Math.max(card.S, 0.05)), -0.5);
}

// rating: 0=again(誤答/パス) 1=hard(再挑戦成功) 2=good(正答) 3=easy(見切り正答)
export function review(card, rating, now = Date.now()) {
  const c = { ...card };
  if (!c.reps) {
    c.S = [0.4, 1.2, 2.5, 7][rating]; // good初回は錆鉄(S<3)から。easy=見切りは青銅スタート
    c.D = [8, 6.5, 5, 3.5][rating];
  } else if (rating === 0) {
    c.S = Math.max(0.3, 0.4 * Math.sqrt(c.S));
    c.D = Math.min(10, c.D + 1.6);
    c.lapses = (c.lapses || 0) + 1;
    c.postLapse = 2; // 再学習ステップ: 直後2回の成功は成長・バーストを抑制(まぐれ正解対策)
  } else {
    const R = retrievability(card, now);
    // 忘れかけ(R低)ほど成長が大きい = 望ましい困難
    let g = 13 * ((11 - c.D) / 10) * Math.pow(Math.max(c.S, 0.3), -0.05) * (Math.exp(1.8 * (1 - R)) - 1);
    g *= rating === 1 ? 0.5 : rating === 3 ? 1.35 : 1;
    g = Math.min(Math.max(g, 0.05), 5);
    if (c.postLapse > 0) {
      // 失念直後は4択のまぐれ正解でSが跳ばないよう成長上限を絞る
      g = Math.min(g, 1.2);
      c.postLapse--;
    }
    c.S = Math.min(365, c.S * (1 + g));
    c.D = Math.max(1, Math.min(10, c.D + [0, 0.4, -0.2, -0.6][rating]));
  }
  c.last = now;
  c.due = now + c.S * DAY;
  c.reps = (c.reps || 0) + 1;
  return c;
}

// 再燃バースト: 忘却間際(R≈0.85)で火力ピークの山型カーブ。
// 覚えたてを連打しても、放置しすぎても旨味がない=効率プレイが最適な間隔反復に一致する。
export function burst(R, scale = 1) {
  return 1 + scale * 2.5 * Math.exp(-((R - 0.85) ** 2) / (2 * 0.08 ** 2));
}

export function rarityIndex(card) {
  if (!card || !card.reps) return 0;
  let idx = 0;
  for (let i = 0; i < RARITY.length; i++) if (card.S >= RARITY[i].min) idx = i;
  return idx;
}

export function isDue(card, now = Date.now()) {
  return !!card && card.reps > 0 && card.due <= now;
}
