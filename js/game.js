// 1ラン = ノード5 + ボス(忘却獣)。ノードごとに規定燃料(ターゲット)を超えれば突破。
// 出題はSRSが裏で決める: 期日が来た語(忘れかけ)が優先され、再燃バーストで最大火力になる。
import { newCard, review, retrievability, burst, rarityIndex } from './srs.js';
import { makeQuestion } from './quiz.js';
import { toolById, rollToolChoices } from './tools.js';
import { dayStat, todayKey, dayDiff } from './storage.js';

const NODE_TARGETS = [45, 75, 110, 150, 200, 270];
const DIFF_MULT = [0.75, 1, 1.3];

export class Run {
  constructor(app) {
    this.app = app;
    this.tools = [];
    this.nodeIdx = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.prevPos = null;
    this.misses = [];
    this.usedWords = new Set();
    this.rankBase = {};
    this.introducedCount = 0;
    this.phoenixUsed = false;
    this.totalScore = 0;
    const d = app.profile.settings.difficulty ?? 1;
    this.targets = NODE_TARGETS.map((t) => Math.round(t * DIFF_MULT[d]));
    this.queue = [];
    this.qPos = -1;
    this.requeue = [];
    this.finished = null;
  }

  get target() { return this.targets[this.nodeIdx]; }
  get isBoss() { return this.nodeIdx === 5; }

  newAllowance() {
    const p = this.app.profile;
    const seenCount = Object.values(p.cards).filter((c) => c.reps > 0).length;
    if (seenCount < 15) return 99; // 初日はプール確保を優先
    const ds = dayStat(p);
    let allow = p.settings.newPerDay - ds.new;
    const due = this.dueCount();
    if (due > 60) allow = Math.floor(allow / 2);
    return Math.max(0, allow);
  }

  dueCount(now = Date.now()) {
    const { cards } = this.app.profile;
    const { byKey } = this.app.index;
    let n = 0;
    for (const [w, c] of Object.entries(cards)) if (c.reps > 0 && c.due <= now && byKey.has(w)) n++;
    return n;
  }

  pickNewEntries(n) {
    if (n <= 0) return [];
    const p = this.app.profile;
    const { byKey, words } = this.app.index;
    const unseen = (e) => !p.cards[e.w] || !p.cards[e.w].reps;
    const out = [];
    // 宝箱から出た言霊を最優先
    p.pendingNew = (p.pendingNew || []).filter((w) => byKey.has(w) && unseen(byKey.get(w)));
    for (const w of p.pendingNew) {
      if (out.length >= n) break;
      if (!this.usedWords.has(w)) out.push(byKey.get(w));
    }
    if (out.length < n) {
      const s = p.settings;
      let pool = words.filter((e) => unseen(e) && !this.usedWords.has(e.w) && !out.includes(e)
        && s.levels.includes(e.l) && s.fields.includes(e.f));
      if (!pool.length) pool = words.filter((e) => unseen(e) && !this.usedWords.has(e.w) && !out.includes(e));
      pool = pool.map((e) => ({ e, k: e.l + Math.random() * 1.2 })).sort((a, b) => a.k - b.k).map((x) => x.e);
      out.push(...pool.slice(0, n - out.length));
    }
    return out;
  }

  buildQueue() {
    const p = this.app.profile;
    const { byKey } = this.app.index;
    const now = Date.now();
    const size = this.isBoss ? 9 : 7;
    const items = [];
    const scored = Object.entries(p.cards)
      .filter(([w, c]) => c.reps > 0 && byKey.has(w))
      .map(([w, c]) => ({ w, c, R: retrievability(c, now) }));

    if (this.isBoss) {
      const missW = [...new Set(this.misses.map((m) => m.entry.w))];
      const weak = scored
        .filter((x) => !missW.includes(x.w))
        .sort((a, b) => (b.c.lapses || 0) - (a.c.lapses || 0) || a.R - b.R);
      const wordsPick = [...missW, ...weak.map((x) => x.w)].slice(0, size);
      for (const w of wordsPick) items.push({ kind: 'q', entry: byKey.get(w), isNew: false });
    } else {
      const fresh = (x) => !this.usedWords.has(x.w);
      const due = scored.filter((x) => fresh(x) && (x.c.due <= now || x.R < 0.9)).sort((a, b) => a.R - b.R);
      const stable = scored.filter((x) => fresh(x) && x.c.due > now && x.R >= 0.9).sort((a, b) => a.R - b.R);
      const dueTake = Math.min(due.length, Math.ceil(size * 0.6));
      for (let i = 0; i < dueTake; i++) items.push({ kind: 'q', entry: byKey.get(due[i].w), isNew: false });

      let qCount = items.length;
      let newTake = Math.min(2, Math.max(0, size - qCount), this.newAllowance());
      // 残り枠を安定語で
      let di = dueTake; let si = 0;
      const fillers = [];
      while (qCount + newTake + fillers.length < size && (di < due.length || si < stable.length)) {
        const x = di < due.length ? due[di++] : stable[si++];
        fillers.push({ kind: 'q', entry: byKey.get(x.w), isNew: false });
      }
      // それでも足りなければ新出で埋める(手札が空ではゲームにならないので上限より優先)
      const shortage = size - (qCount + newTake + fillers.length);
      if (shortage > 0) newTake += shortage;
      const news = this.pickNewEntries(newTake);
      for (const e of news) {
        items.push({ kind: 'study', entry: e }, { kind: 'q', entry: e, isNew: true });
        this.introducedCount++;
        dayStat(p).new++;
      }
      items.push(...fillers);
      // 語彙プールも尽きた場合: 本日想起済みの言霊を再登板させる(完全な空キューを防ぐ)
      let qc = items.filter((i) => i.kind === 'q').length;
      if (qc < size) {
        const replay = scored
          .filter((x) => this.usedWords.has(x.w))
          .sort((a, b) => a.R - b.R);
        for (const x of replay) {
          if (qc >= size) break;
          items.push({ kind: 'q', entry: byKey.get(x.w), isNew: false, replay: true });
          qc++;
        }
      }
    }

    for (const it of items) {
      this.usedWords.add(it.entry.w);
      if (!(it.entry.w in this.rankBase)) this.rankBase[it.entry.w] = rarityIndex(p.cards[it.entry.w]);
    }
    this.queue = items;
    this.qPos = -1;
    this.requeue = [];
    this.nodeScore = 0;
    this.phoenixUsed = false;
  }

  startNode() {
    this.buildQueue();
    return this.advance();
  }

  // 次のアイテムへ。{item} | {nodeCleared, rewards} | {finished}
  advance() {
    this.qPos++;
    if (this.qPos >= this.queue.length && this.requeue.length) {
      // 暴走再挑戦: 取り逃した言霊がノード終盤に再来する
      for (const entry of this.requeue.splice(0)) {
        this.queue.push({ kind: 'q', entry, isNew: false, retry: true });
      }
    }
    if (this.qPos < this.queue.length) {
      const item = this.queue[this.qPos];
      if (item.kind === 'q' && !item.q) {
        const card = this.app.profile.cards[item.entry.w];
        item.q = makeQuestion(item.entry, card, this.app.index, this.app.profile.settings, item.retry ? 'e2j' : undefined);
      }
      return { item, pos: this.qPos, total: this.queue.length };
    }
    // ノード終了
    const cleared = this.nodeScore >= this.target;
    if (!cleared) return this.finish(false);
    if (this.isBoss) return this.finish(true);
    return { nodeCleared: true, rewards: rollToolChoices(this.tools, 3) };
  }

  takeReward(toolId) {
    if (toolId && this.tools.length < 5) this.tools.push(toolId);
    this.nodeIdx++;
    return this.startNode();
  }

  submit({ choiceIdx = -1, mikiri = false, passed = false, timeMs = 0 }) {
    const item = this.queue[this.qPos];
    const entry = item.entry;
    const p = this.app.profile;
    const card = p.cards[entry.w] || newCard();
    const Rbefore = item.isNew || !card.reps ? 0 : retrievability(card);
    const correct = !passed && choiceIdx >= 0 && !!item.q.choices[choiceIdx]?.correct;

    let rating;
    if (passed || !correct) rating = 0;
    else if (item.retry) rating = 1;
    else if (mikiri) rating = 3;
    else rating = 2;
    p.cards[entry.w] = review(card, rating, Date.now());

    p.stats.reviews++;
    const ds = dayStat(p);
    ds.r++;
    if (correct) { p.stats.correct++; ds.c++; }

    let points = 0; let crit = false; let breakdown = null; let phoenix = false;
    if (correct) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      let base = 10 + entry.l * 3;
      if (item.isNew) base = Math.round(base * 1.4); // 出会いの火: 初想起の成功ボーナス
      const burstScale = this.tools.some((id) => toolById(id).burstScale) ? 1.5 : 1;
      const burstM = item.isNew || !Rbefore ? 1 : burst(Rbefore, burstScale);
      const mikiriM = mikiri ? 1.5 : 1;
      const comboM = 1 + Math.min(this.combo, 12) * 0.06;
      const ctx = {
        entry, qtype: item.q.type, mikiri, combo: this.combo, isNew: !!item.isNew,
        timeMs, prevPos: this.prevPos, rarity: rarityIndex(p.cards[entry.w]),
      };
      let toolM = 1; let flat = 0;
      for (const id of this.tools) {
        const t = toolById(id);
        if (t.mult) toolM *= t.mult(ctx);
        if (t.flat) flat += t.flat(ctx);
      }
      const retryM = item.retry ? 0.5 : 1;
      points = Math.round(base * burstM * mikiriM * comboM * toolM * retryM) + flat;
      crit = burstM >= 2.2 || mikiri;
      breakdown = { base, burstM, mikiriM, comboM, toolM, flat };
      this.nodeScore += points;
      this.totalScore += points;
    } else if (!passed) {
      if (this.tools.includes('phoenix') && !this.phoenixUsed) {
        this.phoenixUsed = true;
        phoenix = true; // コンボ維持
      } else {
        this.combo = 0;
      }
      if (!item.retry) {
        this.requeue.push(entry);
        this.misses.push({ entry, type: item.q.type });
      }
    }
    // パスはコンボ維持(正直な申告を守る)

    this.prevPos = entry.p;
    this.app.save();
    return { correct, passed, points, crit, breakdown, phoenix, entry, rating, Rbefore };
  }

  finish(win) {
    const p = this.app.profile;
    const ds = dayStat(p);
    p.stats.runs++;
    ds.runs = (ds.runs || 0) + 1;
    if (win) { p.stats.wins++; ds.wins = (ds.wins || 0) + 1; }

    // ストリーク(野営式: 途切れても全損しない)
    const today = todayKey();
    if (p.streak.lastDay !== today) {
      const gap = dayDiff(p.streak.lastDay, today);
      if (gap === 1) p.streak.count += 1;
      else if (gap > 1 && gap < Infinity) p.streak.count = Math.max(1, p.streak.count - (gap - 1) * 2);
      else p.streak.count = Math.max(1, p.streak.count + 1);
      p.streak.lastDay = today;
      p.streak.best = Math.max(p.streak.best, p.streak.count);
    }

    // 勝利報酬: 熟成宝箱(明日開く=分散学習の第1間隔)
    let chest = null;
    if (win && (p.chests || []).length < 3) {
      const n = 4 + (this.tools.includes('chest_magnet') ? 2 : 0);
      const t = new Date();
      t.setDate(t.getDate() + 1);
      chest = { n, openDay: todayKey(t.getTime()) };
      p.chests.push(chest);
    }

    // ランクアップ(レアリティ=記憶安定性の上昇)
    const rankUps = [];
    for (const [w, base] of Object.entries(this.rankBase)) {
      const after = rarityIndex(p.cards[w]);
      if (after > base) rankUps.push({ w, from: base, to: after });
    }

    // 敗因トップ3
    const missCount = {};
    for (const m of this.misses) missCount[m.entry.w] = (missCount[m.entry.w] || 0) + 1;
    const topMisses = Object.entries(missCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => this.app.index.byKey.get(w));

    this.app.save();
    this.finished = {
      finished: true, win, nodeReached: this.nodeIdx, totalScore: this.totalScore,
      maxCombo: this.maxCombo, rankUps, topMisses, chest,
      reviews: Object.keys(this.rankBase).length, introduced: this.introducedCount,
      target: this.target, nodeScore: this.nodeScore,
    };
    return this.finished;
  }
}
