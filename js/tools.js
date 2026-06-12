// 鍛冶具(ジョーカー相当)。倍率は ctx を見て掛かる。
// ctx: { entry, qtype, mikiri, combo, isNew, timeMs, prevPos, rarity }

export const TOOLS = [
  { id: 'verb_hammer', name: '動詞の鎚', icon: '🔨', desc: '動詞の言霊 ×1.6', mult: (c) => (c.entry.p === 'verb' ? 1.6 : 1) },
  { id: 'noun_anvil', name: '名詞の金床', icon: '🧱', desc: '名詞の言霊 ×1.5', mult: (c) => (c.entry.p === 'noun' ? 1.5 : 1) },
  { id: 'adj_whet', name: '彩りの砥石', icon: '🗡️', desc: '形容詞・副詞 ×1.7', mult: (c) => (c.entry.p === 'adjective' || c.entry.p === 'adverb' ? 1.7 : 1) },
  { id: 'ear_bell', name: '耳澄ましの鈴', icon: '🔔', desc: 'リスニング問題 ×2', mult: (c) => (c.qtype === 'listen' ? 2 : 1) },
  { id: 'mikiri_blade', name: '見切りの刃', icon: '⚡', desc: '見切り成功 さらに×1.5', mult: (c) => (c.mikiri ? 1.5 : 1) },
  { id: 'bellows', name: '連鎖のふいご', icon: '🌬️', desc: 'コンボ1につき +10%', mult: (c) => 1 + Math.min(c.combo, 10) * 0.1 },
  { id: 'sage_glass', name: '賢者の単眼鏡', icon: '🧐', desc: '応用・上級の語 ×1.8', mult: (c) => (c.entry.l >= 4 ? 1.8 : 1) },
  { id: 'tw_map', name: '旅人の地図', icon: '🗺️', desc: '旅行・日常の語 ×1.6', mult: (c) => (c.entry.f === 'travel' || c.entry.f === 'daily' ? 1.6 : 1) },
  { id: 'merchant_scale', name: '商人の天秤', icon: '⚖️', desc: 'ビジネス・社会の語 ×1.6', mult: (c) => (c.entry.f === 'business' || c.entry.f === 'society' ? 1.6 : 1) },
  { id: 'specimen', name: '博物の標本箱', icon: '🧪', desc: '自然・学びの語 ×1.6', mult: (c) => (c.entry.f === 'nature' || c.entry.f === 'school' ? 1.6 : 1) },
  { id: 'food_pot', name: '食通の鍋', icon: '🍲', desc: '食・感情の語 ×1.6', mult: (c) => (c.entry.f === 'food' || c.entry.f === 'feelings' ? 1.6 : 1) },
  { id: 'star_fuel', name: '星鋼の薪', icon: '✨', desc: '黄金・星鋼の言霊 ×1.6', mult: (c) => (c.rarity >= 3 ? 1.6 : 1) },
  { id: 'moon_crucible', name: '月光の坩堝', icon: '🌙', desc: '新出の言霊 ×2', mult: (c) => (c.isNew ? 2 : 1) },
  { id: 'twin_mirror', name: '双子の鏡', icon: '🪞', desc: '直前と同じ品詞 ×1.5', mult: (c) => (c.prevPos && c.prevPos === c.entry.p ? 1.5 : 1) },
  { id: 'saddle', name: '疾風の鞍', icon: '🐎', desc: '4秒以内の回答 +15燃料', flat: (c) => (c.timeMs > 0 && c.timeMs <= 4000 ? 15 : 0) },
  { id: 'ember', name: '再燃の火種', icon: '🔥', desc: '再燃バースト効果 +50%', burstScale: 1.5 },
  { id: 'phoenix', name: '不死鳥の羽', icon: '🪶', desc: '各ノード最初のミスを無効化', passive: 'phoenix' },
  { id: 'chest_magnet', name: '宝箱の磁石', icon: '🧲', desc: '勝利時の宝箱の単語 +2', passive: 'chest_plus' },
];

export function toolById(id) {
  return TOOLS.find((t) => t.id === id);
}

export function rollToolChoices(owned, n = 3) {
  const pool = TOOLS.filter((t) => !owned.includes(t.id));
  const out = [];
  const src = [...pool];
  while (out.length < n && src.length) {
    out.push(src.splice(Math.floor(Math.random() * src.length), 1)[0]);
  }
  return out;
}
