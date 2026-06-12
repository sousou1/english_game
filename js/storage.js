const KEY = 'kotodama_reforge_v1'; // キーは据え置き(v1からの移行のため)。中身は v:2

export const ALL_FIELDS = ['daily', 'school', 'business', 'travel', 'nature', 'feelings', 'food', 'society'];

export const FIELD_NAMES = {
  daily: '暮らし', school: '学び', business: '商い', travel: '旅',
  nature: '自然', feelings: 'こころ', food: '食', society: '町',
};

export const LEVEL_NAMES = ['', '入門', '基礎', '標準', '応用', '上級'];

export function defaultProfile() {
  return {
    v: 5,
    settings: {
      levels: [1, 2],
      fields: [...ALL_FIELDS],
      newPerDay: 999, // 無制限が既定(忘却曲線が復習で帳尻を取る)
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
    taps: {},       // w -> 詠唱プールで正しくタップした回数
    vref: 1,        // 直近タップ価値の移動平均(放置生産の参照値)
    battle: { kills: 0, dmg: 0 }, // 討伐数と現在の敵への累積ダメージ
    gold: 0,
    exp: 0,
    armory: {       // ハクスラ武器
      inv: [{ uid: 'starter', wid: 'w_oak', rar: 'N', grade: 0, lv: 0, spent: 0, subs: [], lock: true }],
      equip: 'starter', box: [], whet: 0, codex: ['w_oak:N'], pity: 0, capExt: 0,
    },
    job: 'swordsman',
    party: { letterDay: '', letterBuff: false },
    events: { cleared: {} }, // イベントモード: id -> クリア時刻
    dev: { mult: 1 }, // 開発者モード(×10/×100)
    boss: { engaged: false, bodyHp: null, scars: 0, hp: null, nextAtk: 0, dmgReduce: 0 },
    scenario: { scene: null, flags: {}, chapter: 1, read: {} },
    facilities: {}, // id -> 個数
    chest: null,    // {openDay, words[]}
    story: { seen: {}, intro: 0 },
    streak: { count: 0, best: 0, lastDay: null },
    stats: { recalls: 0, correct: 0, byDay: {} },
    settledAt: Date.now(),
    created: Date.now(),
  };
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw);
    // 開発中につきセーブ互換なし: バージョン不一致は新規データ
    if (p.v !== 5) return defaultProfile();
    const d = defaultProfile();
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
  if (!p.stats.byDay[k]) p.stats.byDay[k] = { r: 0, c: 0, new: 0 };
  return p.stats.byDay[k];
}
