const KEY = 'kotodama_reforge_v1';

export const ALL_FIELDS = ['daily', 'school', 'business', 'travel', 'nature', 'feelings', 'food', 'society'];

export const FIELD_NAMES = {
  daily: '日常生活', school: '学び・教養', business: '仕事・ビジネス', travel: '旅行・移動',
  nature: '自然・科学', feelings: '感情・人間関係', food: '食・健康', society: '社会・ニュース',
};

export const LEVEL_NAMES = ['', '入門', '基礎', '標準', '応用', '上級'];

export function defaultProfile() {
  return {
    v: 1,
    settings: {
      levels: [1, 2],
      fields: [...ALL_FIELDS],
      newPerDay: 8,
      listen: true,
      autoSpeak: true,
      rate: 0.95,
      difficulty: 1, // 0=微温 1=適温 2=灼熱
    },
    cards: {},      // word -> {S,D,last,due,reps,lapses}
    pendingNew: [], // 宝箱から出た単語(新出の優先キュー)
    chests: [],     // {n, openDay}
    streak: { count: 0, best: 0, lastDay: null },
    stats: { runs: 0, wins: 0, reviews: 0, correct: 0, byDay: {} },
    created: Date.now(),
  };
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw);
    const d = defaultProfile();
    // 欠けたキーを補完(将来のバージョン追従)
    p.settings = { ...d.settings, ...(p.settings || {}) };
    for (const k of Object.keys(d)) if (!(k in p)) p[k] = d[k];
    return p;
  } catch (e) {
    console.warn('profile load failed', e);
    return defaultProfile();
  }
}

export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    console.warn('profile save failed', e);
  }
}

export function todayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayDiff(fromKey, toKey) {
  if (!fromKey) return Infinity;
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / 86400000);
}

export function dayStat(p, now = Date.now()) {
  const k = todayKey(now);
  if (!p.stats.byDay[k]) p.stats.byDay[k] = { r: 0, c: 0, runs: 0, wins: 0, new: 0 };
  return p.stats.byDay[k];
}
