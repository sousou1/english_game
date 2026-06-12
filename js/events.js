// イベントモード: 物語の山場を「シーンに沿った穴埋め詠唱」で進める演目。
// 不変条件:
//  E1 新出語(teach)はクリア時に学習ステップへ(=招くと同じ)。SRSカードへの直書きはしない
//  E2 反芻(review)はSRSに一切書き込まない(B7: SRS書き込みは焚き火だけ)
//  E3 誤答ペナルティなし(やり直しのみ)。タイマーなし。プレイヤー起点
//  E4 報酬は初回クリアのみ。恒久乗数には触れない(gold+確定ドロップ+語の追加だけ)
import { EVENTS } from '../data/events.js';
import { startSteps, isDrowsy } from './schedule.js';
import { pickDistractors } from './quiz.js';
import { enemyHp } from './battle.js';

export function eventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}

// いま解放されていて未クリアのイベント(最初の1本)
export function eventAvailable(p) {
  return EVENTS.find((e) => !p.events.cleared[e.id] && p.scenario.read[e.gate.read]) || null;
}

export function clearedEvents(p) {
  return EVENTS.filter((e) => p.events.cleared[e.id]);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class EventRun {
  // 開始時に全ステップを線形化する。UIは idx を進めるだけ
  constructor(app, ev, { replay = false } = {}) {
    this.app = app;
    this.ev = ev;
    this.replay = replay;
    this.idx = 0;
    this.misses = 0;
    const p = app.profile;
    const nChoices = (ev.tier || 1) >= 2 ? 6 : 4;
    this.steps = [{ t: 'lines', lines: ev.intro, art: true }];
    for (const b of ev.beats || []) {
      if (b.lines && b.lines.length) this.steps.push({ t: 'lines', lines: b.lines });
      if (b.teach) {
        const entry = app.index.byKey.get(b.teach);
        if (!entry) continue;
        if (!b.recall) this.steps.push({ t: 'teach', entry });
        this.steps.push({
          t: 'cast', entry, jp: b.cast.jp, recall: !!b.recall,
          choices: shuffle([entry, ...pickDistractors(entry, app.index, nChoices - 1)]),
        });
      } else if (b.review) {
        const entry = this.pickReview();
        if (!entry) continue; // 既習語が無ければ反芻は飛ばす(序盤救済)
        this.steps.push({
          t: 'cast', entry, jp: `${b.castLine}(お題: ${entry.j})`, review: true,
          choices: shuffle([entry, ...pickDistractors(entry, app.index, nChoices - 1)]),
        });
      }
    }
    this.steps.push({ t: 'lines', lines: ev.outro });
    this.steps.push({ t: 'clear' });
  }

  // 反芻語の抽選: うとうと(期日超過)優先→既習からランダム。同イベント内重複なし
  pickReview() {
    const p = this.app.profile;
    const used = new Set(this.steps.filter((s) => s.t === 'cast').map((s) => s.entry.w));
    const learned = Object.keys(p.cards)
      .filter((w) => p.cards[w].reps > 0 && !used.has(w))
      .map((w) => this.app.index.byKey.get(w)).filter(Boolean);
    if (!learned.length) return null;
    const now = Date.now();
    const drowsy = learned.filter((e) => isDrowsy(p.cards[e.w], now));
    const pool = drowsy.length ? drowsy : learned;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  cur() { return this.steps[this.idx] || null; }
  progress() {
    const casts = this.steps.filter((s) => s.t === 'cast').length;
    const done = this.steps.slice(0, this.idx).filter((s) => s.t === 'cast').length;
    return { done, total: casts };
  }

  next() { if (this.idx < this.steps.length - 1) this.idx++; return this.cur(); }

  // 詠唱の回答。正解で前進、誤答はその場でやり直し(E3)
  answer(w) {
    const s = this.cur();
    if (!s || s.t !== 'cast') return null;
    if (w !== s.entry.w) { this.misses++; return { correct: false }; }
    this.idx++;
    return { correct: true, cleared: this.cur()?.t === 'clear' };
  }

  // 初回クリア報酬(E4)。{gold, words:[entry], already} を返す。ドロップはUI層でdropRoll
  finish(now = Date.now()) {
    const p = this.app.profile;
    if (this.replay || p.events.cleared[this.ev.id]) return { gold: 0, words: [], already: true };
    const gold = Math.round(enemyHp(p.battle.kills) * 1.5);
    p.gold += gold * (p.dev?.mult || 1);
    const words = [];
    for (const b of this.ev.beats || []) {
      if (!b.teach) continue;
      if (p.cards[b.teach] || p.steps[b.teach]) continue; // 既習は再追加しない
      const entry = this.app.index.byKey.get(b.teach);
      if (!entry) continue;
      p.steps[b.teach] = startSteps(now);
      words.push(entry);
    }
    p.events.cleared[this.ev.id] = now;
    this.app.save();
    return { gold: gold * (p.dev?.mult || 1), words, already: false };
  }
}
