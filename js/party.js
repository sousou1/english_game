// パーティ「灯の同行者」MVP: ノノ【さしいれ】のみ。
// さしいれ(ともしび亭から毎日届く)を読むと、当日最初の討伐チャンスの開始HP+15%。
// 効果は加算・無罰のみ。絆=好物分野の定着語数(読み取りのみ、ラチェット保存)。
import { todayKey } from './storage.js';

export const COMPANIONS = [
  {
    id: 'nono', name: 'ノノ', icon: '💌', join: 'inn',
    favFields: ['food', 'feelings'],
    desc: '幼なじみ。ともしび亭から毎日さしいれが届く。読むと今日はじめてのボス戦でHP+15%',
    letters: [
      "まかないパン、こっそり大きいのを選んどいた。breadって言うんだって。食べな!",
      "ともしび亭のスープ、味見係に任命された。あんたの分も確保ずみ。",
      "修行サボってないよね? 夜ふかし禁止。lightは消して寝ること。",
      "マーサさんが「いい子たちだ」って。宿代ぶんはあたしが働くから、安心しな。",
      "村のみんな、どこかで声を取り戻す日を待ってる。だから今日も唱えな。",
      "市場でりんごあめ見つけた。appleの飴。半分こは、また今度ね。",
    ],
  },
];

export function nonoJoined(p) {
  return !!p.scenario.read['c01_160'] || (p.battle.kills || 0) >= 20;
}

// 今日まだ読んでいない手紙があるか
export function letterAvailable(p) {
  return nonoJoined(p) && p.party.letterDay !== todayKey();
}

export function readLetter(p) {
  if (!letterAvailable(p)) return null;
  p.party.letterDay = todayKey();
  p.party.letterBuff = true; // 当日最初の討伐チャンスでHP+15%
  const pool = COMPANIONS[0].letters;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 討伐チャンス開始時に消費
export function consumeLetterBuff(p) {
  if (p.party.letterBuff) { p.party.letterBuff = false; return 0.15; }
  return 0;
}
