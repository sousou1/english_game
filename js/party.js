// パーティ「灯の同行者」MVP: ユイ【さしいれ】のみ。
// さしいれ(村を出てから毎日届く)を読むと、当日最初の討伐チャンスの開始HP+15%。
// 効果は加算・無罰のみ。絆=好物分野の定着語数(読み取りのみ、ラチェット保存)。
import { todayKey, DEFAULT_PLAYER_NAME } from './storage.js';

export const COMPANIONS = [
  {
    id: 'yui', name: 'ユイ', icon: '💌', join: 'leave',
    favFields: ['food', 'feelings'],
    desc: '幼なじみ・世話係。村を出てから毎日さしいれが届く。読むと今日はじめてのボス戦でHP+15%',
    // {name} は readLetter で主人公名へ置換される
    letters: [
      "{name}。灯心、もう替えた? ……べつに、心配じゃないけど。",
      "夜は冷える。ちゃんと食べてる? breadくらい持っときなよ。",
      "カンテラの火、絶やすなよ。あんたの灯がいちばん遠くまで届くんだから。",
      "灰の手先が出るって街、近いんでしょ。無理だけはすんな。",
      "村のみんな、どこかで名前を取り戻す日を待ってる。だから今日も灯しな。",
      "星、こっちからも同じのが見えるよ。空だけはつながってる。hopeって、こういうことかもね。",
      "編んだことば、ちゃんと乾かしてる? 手放したら、ただの染みだからね。",
    ],
  },
];

export function yuiJoined(p) {
  return !!p.scenario.read['c01_160'] || (p.battle.kills || 0) >= 20;
}

// 今日まだ読んでいない手紙があるか
export function letterAvailable(p) {
  return yuiJoined(p) && p.party.letterDay !== todayKey();
}

export function readLetter(p) {
  if (!letterAvailable(p)) return null;
  p.party.letterDay = todayKey();
  p.party.letterBuff = true; // 当日最初の討伐チャンスでHP+15%
  const pool = COMPANIONS[0].letters;
  const raw = pool[Math.floor(Math.random() * pool.length)];
  return raw.replace(/\{name\}/g, p.playerName || DEFAULT_PLAYER_NAME);
}

// 討伐チャンス開始時に消費
export function consumeLetterBuff(p) {
  if (p.party.letterBuff) { p.party.letterBuff = false; return 0.15; }
  return 0;
}
