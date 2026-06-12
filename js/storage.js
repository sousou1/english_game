const KEY = 'kotodama_reforge_v1'; // キーは据え置き(v1からの移行のため)。中身は v:2

export const ALL_FIELDS = ['daily', 'school', 'business', 'travel', 'nature', 'feelings', 'food', 'society'];

export const FIELD_NAMES = {
  daily: '暮らし', school: '学び', business: '商い', travel: '旅',
  nature: '自然', feelings: 'こころ', food: '食', society: '町',
};

export const LEVEL_NAMES = ['', '入門', '基礎', '標準', '応用', '上級'];

export function defaultProfile() {
  return {
    v: 2,
    settings: {
      levels: [1, 2],
      fields: [...ALL_FIELDS],
      newPerDay: 10,
      listen: true,
      autoSpeak: true,
      rate: 0.95,
    },
    cards: {},      // w -> FSRSカード(卒業済みの言霊)
    steps: {},      // w -> {step, due, mikiri}(卒業前の言霊)
    mana: {},       // w -> 熟成マナ
    lights: 0,      // 灯火(現在)
    totalLights: 0, // 累計(アンロック判定)
    surely: 0,      // 確かな想起数
    facilities: {}, // id -> 個数
    chest: null,    // {openDay, words[]}
    story: { seen: {}, intro: 0 },
    streak: { count: 0, best: 0, lastDay: null },
    stats: { recalls: 0, correct: 0, byDay: {} },
    settledAt: Date.now(),
    created: Date.now(),
  };
}

// v1(塔)からの移行: 言霊の記憶(SRSカード)・設定・ストリークは引き継ぐ
function migrateV1(p) {
  const d = defaultProfile();
  d.cards = p.cards || {};
  if (p.settings) {
    d.settings.levels = p.settings.levels || d.settings.levels;
    d.settings.fields = p.settings.fields || d.settings.fields;
    d.settings.listen = p.settings.listen !== false;
    d.settings.autoSpeak = p.settings.autoSpeak !== false;
    d.settings.rate = p.settings.rate || d.settings.rate;
  }
  d.streak = p.streak || d.streak;
  if (p.stats) {
    d.stats.recalls = p.stats.reviews || 0;
    d.stats.correct = p.stats.correct || 0;
  }
  // 既習者は導入を飛ばし、火が入った工房から始まる
  const seen = Object.values(d.cards).filter((c) => c.reps > 0).length;
  if (seen > 0) {
    d.story.intro = 99;
    d.facilities.fire = 1;
    d.lights = 30;
    d.totalLights = 30;
    d.story.seen = { intro_1: 1, intro_2: 1, intro_3: 1, first_light: 1, light_3: 1, fire_lit: 1, migrated: 1 };
  }
  d.created = p.created || Date.now();
  return d;
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw);
    if (p.v === 2) {
      const d = defaultProfile();
      p.settings = { ...d.settings, ...(p.settings || {}) };
      for (const k of Object.keys(d)) if (!(k in p)) p[k] = d[k];
      return p;
    }
    return migrateV1(p);
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
  if (!p.stats.byDay[k]) p.stats.byDay[k] = { r: 0, c: 0, new: 0 };
  return p.stats.byDay[k];
}
