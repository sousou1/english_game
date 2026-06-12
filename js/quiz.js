// 出題生成。4タイプ:
//  e2j    英単語 → 意味4択
//  j2e    意味 → 英単語4択
//  listen 音声 → 意味4択(リスニング)
//  cloze  例文の空所 → 英単語4択
import { ttsAvailable } from './audio.js';

export function buildIndex(words) {
  const byKey = new Map();
  const byPosLevel = new Map();
  const byPos = new Map();
  for (const e of words) {
    byKey.set(e.w, e);
    const pl = `${e.p}|${e.l}`;
    if (!byPosLevel.has(pl)) byPosLevel.set(pl, []);
    byPosLevel.get(pl).push(e);
    if (!byPos.has(e.p)) byPos.set(e.p, []);
    byPos.get(e.p).push(e);
  }
  return { byKey, byPosLevel, byPos, words };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n, reject) {
  const out = [];
  const src = shuffle(arr);
  for (const x of src) {
    if (out.length >= n) break;
    if (reject(x, out)) continue;
    out.push(x);
  }
  return out;
}

// 同品詞→近いレベル優先でディストラクタを選ぶ
export function pickDistractors(entry, index, n = 3) {
  const cand = [];
  for (let dl = 0; dl <= 4 && cand.length < 40; dl++) {
    for (const lv of dl === 0 ? [entry.l] : [entry.l - dl, entry.l + dl]) {
      if (lv < 1 || lv > 5) continue;
      const pool = index.byPosLevel.get(`${entry.p}|${lv}`) || [];
      for (const e of pool) if (e.w !== entry.w) cand.push(e);
    }
  }
  if (cand.length < n) {
    for (const e of index.words) {
      if (e.w !== entry.w && e.p !== entry.p) cand.push(e);
      if (cand.length > 60) break;
    }
  }
  const reject = (x, out) =>
    x.j === entry.j || out.some((o) => o.j === x.j || o.w === x.w);
  let picked = sample(cand, n, reject);
  if (picked.length < n) picked = picked.concat(sample(index.words, n - picked.length, (x, out) => x.w === entry.w || x.j === entry.j || picked.includes(x) || out.includes(x)));
  return picked.slice(0, n);
}

export function clozeable(entry) {
  if (!entry.ex) return false;
  return new RegExp(`\\b${entry.w.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(entry.ex);
}

export function clozeText(entry) {
  return entry.ex.replace(new RegExp(`\\b${entry.w.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'), '____');
}

export function pickType(entry, card, settings) {
  const reps = card ? card.reps : 0;
  const pool = ['e2j'];
  if (reps >= 1) pool.push('j2e');
  // リスニングは発音を聴く機会(正解時の読み上げ等)を経た後に解禁する
  if (reps >= 2 && settings.listen && ttsAvailable()) pool.push('listen');
  if (reps >= 2) pool.push('j2e');
  if (reps >= 3 && settings.listen && ttsAvailable()) pool.push('listen');
  if (reps >= 3 && clozeable(entry)) pool.push('cloze', 'cloze');
  return pool[Math.floor(Math.random() * pool.length)];
}

export const POS_JA = {
  noun: '名詞', verb: '動詞', adjective: '形容詞', adverb: '副詞',
  preposition: '前置詞', conjunction: '接続詞', pronoun: '代名詞', phrase: '熟語',
};

export function makeQuestion(entry, card, index, settings, forceType, nDistractors = 3) {
  const type = forceType || pickType(entry, card, settings);
  const ds = pickDistractors(entry, index, nDistractors);
  let prompt, sub, choices;
  if (type === 'j2e' || type === 'cloze') {
    choices = shuffle([
      { t: entry.w, correct: true },
      ...ds.map((d) => ({ t: d.w, correct: false })),
    ]);
    if (type === 'cloze') {
      prompt = clozeText(entry);
      sub = entry.jx || entry.j;
    } else {
      prompt = entry.j;
      sub = POS_JA[entry.p] || entry.p;
    }
  } else {
    choices = shuffle([
      { t: entry.j, correct: true },
      ...ds.map((d) => ({ t: d.j, correct: false })),
    ]);
    if (type === 'listen') {
      prompt = null; // 音声のみ
      sub = '🔊 を聴いて意味を選ぼう';
    } else {
      prompt = entry.w;
      sub = POS_JA[entry.p] || entry.p;
    }
  }
  return { entry, type, prompt, sub, choices, answer: choices.findIndex((c) => c.correct) };
}
