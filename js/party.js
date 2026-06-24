// パーティ「灯の同行者」MVP: ユイ【さしいれ】のみ。
// さしいれ(村を出てから毎日届く)を読むと、当日最初の討伐チャンスの開始HP+15%。
// 効果は加算・無罰のみ。絆=好物分野の定着語数(読み取りのみ、ラチェット保存)。
import { todayKey, DEFAULT_PLAYER_NAME } from './storage.js';

export const COMPANIONS = [
  {
    id: 'yui', name: 'ユイ', icon: '💌', join: 'leave',
    favFields: ['food', 'feelings'],
    desc: '幼なじみ・世話係。村を出てから毎日さしいれが届く。読むと今日はじめてのボス戦でHP+15%',
    // {name} は readLetter で主人公名へ置換される。
    // 24通=旅の30日に沿う刷り込みの弧。前半=毎日の世話と軽口、中盤=灯心の品と
    // 「おかえり/ただいま」の無害な反復、後半=言葉が遠くなる予兆(=F4忘却の落差の土台)。
    // 説教はしない。ユイの口語のまま、2〜3行。読むと当日最初のボス戦でHP+15%(加算・無罰)。
    letters: [
      "{name}。灯心、もう替えた? ……べつに、心配じゃないけど。",
      "ちゃんと食べてる? breadくらい持っときなよ。夜は冷えるんだから。",
      "カンテラの火、絶やすなよ。あんたの灯がいちばん遠くまで届くんだから。",
      "今日のさしいれ、編みたての灯心。雑に使ったら承知しないからね。",
      "灰の手先が出るって街、近いんでしょ。無理だけはすんな。",
      "星、こっちからも同じのが見えるよ。空だけはつながってる。hopeって、こういうことかもね。",
      "村のみんな、名前を取り戻す日を待ってる。だから今日も灯しな。",
      "編んだことば、ちゃんと乾かしてる? 手放したら、ただの染みだからね。",
      "は? 礼なんていいよ。……まあ、無事ならそれで。",
      "さしいれ置いとく。灯心と、ちょっとだけ甘いbread。あんた甘いの好きでしょ。",
      "鐘、鳴らしてきた。あんたが帰る場所、ちゃんとここにあるって意味だよ。",
      "疲れてない? ……あたしは平気。ちょっと、言葉が遠いだけ。",
      "夜、また同じ夢みた。村の鐘の音。……名前、なんだったかな。ま、いいや。",
      "灯心、多めに編んどいた。先のぶんまで。なんとなく、今のうちに。",
      "ねえ、{name}。ちゃんと帰っておいでよ。『ただいま』って言える場所、消さないから。",
      "今日のことば、すぐ出てこなかった。……年かな。ふふ、冗談。",
      "さしいれの灯心、これで残り少ない。村が、もう——ううん。なんでもない。",
      "{name}の声、忘れないように、毎朝鐘の前で名前呼んでる。へんかな。",
      "灯、ちゃんとついてる? あたしの灯はね、最近ちょっと、ちらつくの。",
      "甘いbread、もう焼けないや。かまどが灰だから。……今度どこかで一緒に食べよ。",
      "あのね。もし、あたしが何か大事なこと忘れても。あんたは灯し続けて。お願い。",
      "最後の灯心、編み終わった。いちばん丁寧に。これだけは、誰のためか覚えてる。",
      "{name}。……ごめん、いま、呼ぼうとして、一瞬。ううん、ちゃんと呼べた。だいじょうぶ。",
      "おかえり、って言いたいな。あんたが帰ったら、いちばんに。それまで、灯、絶やさないで。",
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
  // 旅に沿って順番に届く(刷り込みの弧)。24通読み終えたら毎日の接触は続くので無作為に再送。
  const idx = p.party.letterIdx || 0;
  let raw;
  if (idx < pool.length) { raw = pool[idx]; p.party.letterIdx = idx + 1; }
  else { raw = pool[Math.floor(Math.random() * pool.length)]; }
  return raw.replace(/\{name\}/g, p.playerName || DEFAULT_PLAYER_NAME);
}

// 討伐チャンス開始時に消費
export function consumeLetterBuff(p) {
  if (p.party.letterBuff) { p.party.letterBuff = false; return 0.15; }
  return 0;
}
