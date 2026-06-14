const KEY = 'kotodama_reforge_v1'; // localStorage キーは据え置き(中身のスキーマは v で管理)

export const ALL_FIELDS = ['daily', 'school', 'business', 'travel', 'nature', 'feelings', 'food', 'society'];

export const FIELD_NAMES = {
  daily: '暮らし', school: '学び', business: '商い', travel: '旅',
  nature: '自然', feelings: 'こころ', food: '食', society: '町',
};

export const LEVEL_NAMES = ['', '入門', '基礎', '標準', '応用', '上級'];

export const DEFAULT_PLAYER_NAME = 'アキ'; // 主人公の既定名(新canon)。空入力ならこれにフォールバック。

// ── スキーマ版管理 ───────────────────────────────────────────────
// SCHEMA_VERSION: 現行スキーマの版。defaultProfile().v と一致させる。
// RESET_BELOW   : これ未満の旧セーブは「一度だけ」破棄する(=今回が最後の全消し)。
//   理由: 第1章canonをレン/ノノ(旧)→アキ/ユイ(新)へ全面刷新し、シーンID進行・playerName 等に
//        破壊的変更が入ったため。旧 v5 以前のセーブは新canonと噛み合わず、移行しても意味を成さない。
//   以後(v6→)は MIGRATORS による前方マイグレーションで学習データ(cards/steps/mana/灯火/streak 等)を保持する。
//   ※ defaultProfile に項目を足すだけの変更は MIGRATORS 不要(backfill が既定値で補完する)。
//     値の変換が要る破壊的変更のときだけ、下の MIGRATORS に n→n+1 の変換を追記する。
export const SCHEMA_VERSION = 6;
export const RESET_BELOW = 6;

// per-version マイグレータ: キー n の関数は「版 n のプロフィールを n+1 相当へ加算的に変換」する。
// 例(将来 v7 を作るとき):
//   6: (p) => { p.newField = deriveFrom(p); },   // p.v は migrate() 側で +1 される
export const MIGRATORS = {
};

export function defaultProfile() {
  return {
    v: SCHEMA_VERSION,
    playerName: DEFAULT_PLAYER_NAME, // 主人公名(プレイヤー命名・既定アキ)。物語テキストの {name} に反映。
    named: false,                    // 命名UIを一度でも通過したか(初回命名導線の制御)
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
    feedback: [],   // ゲーム内フィードバック・メモ: {t, where, tags[], comment}
    settledAt: Date.now(),
    created: Date.now(),
  };
}

// 旧プロフィール p を SCHEMA_VERSION 相当まで前方マイグレートする(破壊的変換のみ)。
// 既知 migrator が無い版差は「版番号だけ進める」(フィールドの追加は後段の backfill が補完)。
export function migrate(p, migrators = MIGRATORS, target = SCHEMA_VERSION) {
  let guard = 0;
  while ((p.v || 0) < target && guard++ < 999) {
    const m = migrators[p.v];
    if (m) m(p);
    p.v = (p.v || 0) + 1;
  }
  p.v = target;
  return p;
}

// 現行 defaultProfile に存在して p に無いトップレベル項目を既定値で補完する(未知フィールドの既定補完)。
// settings はネストするので個別にマージ。学習データ等の既存値は一切上書きしない。
export function backfill(p) {
  const d = defaultProfile();
  p.settings = { ...d.settings, ...(p.settings || {}) };
  for (const k of Object.keys(d)) if (!(k in p)) p[k] = d[k];
  // playerName が空文字・非文字列なら既定へ(壊れたデータのフォールバック)
  if (typeof p.playerName !== 'string' || !p.playerName.trim()) p.playerName = DEFAULT_PLAYER_NAME;
  return p;
}

// パース済みオブジェクト(or null)を受け取り、有効なプロフィールを返す純関数(テスト可能)。
//   - null/壊れデータ      -> 新規
//   - v < RESET_BELOW      -> 新規(今回限りの全消し)
//   - それ以外             -> 前方マイグレート + 既定補完
export function migrateOrReset(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultProfile();
  if ((raw.v || 0) < RESET_BELOW) return defaultProfile();
  migrate(raw);
  return backfill(raw);
}

export function loadProfile() {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return defaultProfile();
    return migrateOrReset(JSON.parse(stored));
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
