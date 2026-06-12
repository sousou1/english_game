// パーティ「灯の同行者」MVP: ノノ【文通】のみ。
// 手紙(鐘で届く)を読むと、当日最初の討伐チャンスの開始HP+15%。
// 効果は加算・無罰のみ。絆=好物分野の定着語数(読み取りのみ、ラチェット保存)。
import { todayKey } from './storage.js';

export const COMPANIONS = [
  {
    id: 'nono', name: 'ノノ', icon: '💌', join: 'letter',
    favFields: ['food', 'feelings'],
    desc: '幼なじみ。鐘が鳴ると手紙が届く。読むと今日はじめてのボス戦でHP+15%',
    letters: [
      'ノノ「村のみんな、少しずつ言葉が戻ってる。あんたのおかげ……じゃなくて、偶然ね」',
      'ノノ「薬草の在庫、整理した。あんたの分も干してある。早く取りに来なさいよ」',
      'ノノ「夜のさく、もうこわくない。けど、たまに夢で白いきりを見る」',
      'ノノ「ごはんちゃんと食べてる? 食べてないなら呪う」',
      'ノノ「じいちゃんの写本のページ、一枚だけ開いてた。『friend』って書いてあった」',
      'ノノ「今日の空、村からだとすごくきれい。そっちからも同じ空?」',
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
