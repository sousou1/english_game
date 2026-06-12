// アンロック(UIの段階的開示)とナラティブ配給。
// 閾値はすべて行動量建て(確かな想起・卒業数・累計灯火)。時間建て閾値は作らない。
import { LINES } from './story-lines.js';

export function line(id, vars = {}) {
  let v = LINES[id];
  if (Array.isArray(v)) v = v[Math.floor(Math.random() * v.length)];
  if (!v) return null;
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

// バリエーション付き(id_a/_b/_c)からランダムに選ぶ
export function lineVar(prefix, vars = {}) {
  const keys = Object.keys(LINES).filter((k) => k === prefix || k.startsWith(prefix + '_'));
  if (!keys.length) return null;
  return line(keys[Math.floor(Math.random() * keys.length)], vars);
}

// ---- UI開示条件(常に再計算。保存しない) ----
export const REVEAL = {
  log: (p) => p.stats.recalls >= 1 || p.story.intro >= 99,
  counter: (p) => p.totalLights >= 3,
  fireBuy: (p) => p.totalLights >= 8 && !(p.facilities.fire),
  verbs: (p) => !!p.facilities.fire,
  invite: (p) => !!p.facilities.fire,
  roster: (p, ws) => ws.graduates() + Object.keys(p.steps).length >= 3,
  shop: (p, ws) => !!p.facilities.fire && (ws.graduates() >= 1 || p.stats.recalls >= 8),
  pinto: (p) => p.surely >= 6,
  bellTime: (p) => !!p.facilities.bell,
  ttf: (p) => (p.facilities.shelf || 0) >= 1,
  pool: (p, ws) => !!p.facilities.fire && (ws.graduates() + Object.keys(p.steps).length) >= 3,
  settings: (p) => !!p.facilities.fire,
};

// 施設が店に並ぶ条件(グレー予告含む)
export const SHOP_REVEAL = {
  fire: (p) => p.totalLights >= 8,
  fairy: (p) => (p.order?.n || 0) >= 1,
  scribe: (p) => (p.order?.n || 0) >= 10,
  kamado: (p) => (p.order?.n || 0) >= 20,
  still: (p) => (p.order?.n || 0) >= 30,
  ring: (p) => (p.order?.n || 0) >= 2,
  helper: (p) => (p.order?.n || 0) >= 35,
  shelf: (p, ws) => ws.graduates() >= 1 || p.stats.recalls >= 8,
  dorm: (p, ws) => ws.graduates() >= 3,
  bell: (p, ws) => ws.graduates() >= 5,
  voice: (p) => p.stats.correct >= 18,
};

// ---- マイルストーン(一度だけ発火しログに流す) ----
const MILESTONES = [
  { id: 'first_light', when: (p) => p.stats.correct >= 1 },
  { id: 'light_3', when: (p) => p.totalLights >= 3 },
  { id: 'fire_lit', when: (p) => !!p.facilities.fire },
  { id: 'invite_open', when: (p) => !!p.facilities.fire },
  { id: 'first_buy', when: (p) => (p.facilities.shelf || 0) >= 1 },
  { id: 'pinto_open', when: (p) => p.surely >= 6 },
  { id: 'voice_open', when: (p) => !!p.facilities.voice },
  { id: 'bell_tower', when: (p) => !!p.facilities.bell },
  { id: 'helper_auto', when: (p) => !!p.facilities.helper },
  { id: 'pool_open', when: (p, ws) => !!p.facilities.fire && (ws.graduates() + Object.keys(p.steps).length) >= 3 },
  { id: 'wave_preview', when: (p, ws) => ws.graduates() >= 15 },
  // 少女アーク: 言霊が増えるほど、少女が言葉に近づいていく
  { id: 'girl_1', when: (p, ws) => ws.graduates() >= 8 },
  { id: 'girl_2', when: (p, ws) => ws.graduates() >= 20 },
  { id: 'girl_3', when: (p, ws) => ws.graduates() >= 40 },
  { id: 'girl_4', when: (p, ws) => ws.graduates() >= 70 },
  { id: 'girl_5', when: (p, ws) => ws.graduates() >= 110 },
];

export function fireMilestones(p, ws, vars = {}) {
  const out = [];
  for (const m of MILESTONES) {
    if (!p.story.seen[m.id] && m.when(p, ws)) {
      p.story.seen[m.id] = 1;
      const t = line(m.id, vars);
      if (t) out.push(t);
    }
  }
  return out;
}

// ---- ランダムイベント(アクティブ中3〜6分毎) ----
let nextEventAt = 0;
export function maybeEvent(p, now = Date.now()) {
  if (!p.facilities.fire) return null;
  if (!nextEventAt) { nextEventAt = now + (3 + Math.random() * 3) * 60000; return null; }
  if (now < nextEventAt) return null;
  nextEventAt = now + (3 + Math.random() * 3) * 60000;
  const evs = Object.keys(LINES).filter((k) => k.startsWith('ev_'));
  if (!evs.length) return null;
  const id = evs[Math.floor(Math.random() * evs.length)];
  // {word}を含むイベントは卒業済みの言霊からランダムに埋める
  if (LINES[id].includes('{word}')) {
    const grads = Object.entries(p.cards).filter(([, c]) => c.reps > 0).map(([w]) => w);
    if (!grads.length) return null;
    return line(id, { word: grads[Math.floor(Math.random() * grads.length)] });
  }
  return line(id);
}
