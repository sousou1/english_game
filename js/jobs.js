// ジョブ(詠唱の型)。補正は腕前系のみ — タップ価値の恒久部・SRSには一切乗らない(J1/J2)。
export const JOBS = [
  { id: 'swordsman', name: '剣士', icon: '🤺', color: '#bfe3ff', unlock: { type: 'init' },
    desc: 'コンボ上限×2.4。ミスでもコンボは半減止まり', mods: { comboCap: 70, missHalvesCombo: true } },
  { id: 'mage', name: '魔導士', icon: '🧙', color: '#c9a0ff', unlock: { type: 'kills', n: 20 },
    desc: 'ラッシュゲージ20で満タン・連鎖窓60秒', mods: { gaugeMax: 20, chainWindowMs: 60000 } },
  { id: 'hunter', name: '狩人', icon: '🏹', color: '#a9e8b0', unlock: { type: 'words', n: 90 },
    desc: '鮮度ボーナス強化(2秒以内×1.7)', mods: { freshFastMult: 1.7, freshOkMult: 1.3 } },
];

export function currentJob(p) {
  return JOBS.find((j) => j.id === p.job) || JOBS[0];
}

export function jobMod(p, key, fallback) {
  const j = currentJob(p);
  return j.mods[key] !== undefined ? j.mods[key] : fallback;
}

export function jobUnlocked(p, job, settledCount) {
  if (job.unlock.type === 'init') return true;
  if (job.unlock.type === 'kills') return (p.battle.kills || 0) >= job.unlock.n;
  if (job.unlock.type === 'words') return settledCount >= job.unlock.n;
  return false;
}
