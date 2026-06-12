// 工房の状態機械。UIから呼ばれる唯一の窓口。
// 不変条件: 灯火のミントは想起だけ。タップ(ふいご)は増幅・収穫・儀式のみ。SRSに不干渉。
import { review, retrievability, burst, rarityIndex } from './srs.js';
import { startSteps, advanceStep, stepDueNow, isDrowsy, isSureRecall, nextBell, quantizeDue } from './schedule.js';
import { settle, productionAt, storageCap, dormCap, FACILITIES, facilityPrice, timeToFull, TIER_NAMES } from './economy.js';
import { makeQuestion } from './quiz.js';
import { todayKey, dayDiff, dayStat } from './storage.js';
import { ttsAvailable } from './audio.js';

const INTRO_WORDS = ['water', 'apple', 'sun']; // 敗北不能の最初の3語(L1最易)
const WAKE_WINDOW_BASE = 12; // 1窓あたりの提示上限(寮で拡張。復習の山は分割して返す)

export class Workshop {
  constructor(app) {
    this.app = app; // {profile, index, words, save}
    this.events = [];        // UIへのイベントキュー {type, ...}
    this.lastTick = Date.now();
    this.recall = null;      // 進行中の想起カード {w, entry, q, stepState, mikiri, opened}
    const p = this.app.profile;
    if (!p.settledAt) p.settledAt = Date.now();
  }

  emit(ev) { this.events.push(ev); }
  drain() { const e = this.events; this.events = []; return e; }

  // ---- 時間 ----

  // 毎秒呼ばれる。オフライン精算と同じ式で進める
  tick(now = Date.now()) {
    const p = this.app.profile;
    const span = now - p.settledAt;
    if (span <= 0) return;
    this.lastTick = now;
    if (span >= 1000) {
      const res = settle(p, this.app.index, p.settledAt, now);
      p.lights = res.lights;
      p.totalLights += res.gained;
      for (const [w, m] of Object.entries(res.manaGained)) {
        p.mana[w] = (p.mana[w] || 0) + m;
      }
      p.settledAt = now;
    }
  }

  // 起動時の帰還精算。{gained, cappedAt, drowsy} を返す(UIがログにする)
  settleReturn(now = Date.now()) {
    const p = this.app.profile;
    const away = now - p.settledAt;
    const res = settle(p, this.app.index, p.settledAt, now);
    p.lights = res.lights;
    p.totalLights += res.gained;
    for (const [w, m] of Object.entries(res.manaGained)) p.mana[w] = (p.mana[w] || 0) + m;
    p.settledAt = now;
    this.app.save();
    return { away, gained: Math.round(res.gained), cappedAt: res.cappedAt, drowsy: this.drowsyCount(now) };
  }

  // ---- 集計 ----

  graduates() {
    return Object.values(this.app.profile.cards).filter((c) => c.reps > 0).length;
  }

  drowsyCount(now = Date.now()) {
    const p = this.app.profile;
    let n = 0;
    for (const [w, c] of Object.entries(p.cards)) {
      if (this.app.index.byKey.has(w) && isDrowsy(c, now)) n++;
    }
    for (const [w, s] of Object.entries(p.steps)) {
      if (this.app.index.byKey.has(w) && stepDueNow(s, now)) n++;
    }
    return n;
  }

  introQueue() {
    const p = this.app.profile;
    return INTRO_WORDS.filter((w) => !p.cards[w] && !p.steps[w] && this.app.index.byKey.has(w));
  }

  wakeWindowMax() {
    return WAKE_WINDOW_BASE + (this.app.profile.facilities.dorm || 0) * 4;
  }

  wakeQueue(now = Date.now()) {
    const p = this.app.profile;
    const q = [];
    for (const [w, s] of Object.entries(p.steps)) {
      if (this.app.index.byKey.has(w) && stepDueNow(s, now)) q.push({ w, kind: 'step', due: s.due });
    }
    const drowsy = [];
    for (const [w, c] of Object.entries(p.cards)) {
      if (this.app.index.byKey.has(w) && isDrowsy(c, now)) drowsy.push({ w, kind: 'card', R: retrievability(c, now) });
    }
    drowsy.sort((a, b) => a.R - b.R);
    q.sort((a, b) => a.due - b.due);
    return [...q, ...drowsy].slice(0, this.wakeWindowMax());
  }

  // ---- 想起カード ----

  formFor(w, stepState, card) {
    const p = this.app.profile;
    const entry = this.app.index.byKey.get(w);
    const tts = p.facilities.voice && p.settings.listen && ttsAvailable();
    if (stepState) return 'e2j';
    const tier = rarityIndex(card);
    const pool = ['e2j'];
    if (tier >= 1 && tts && card.reps >= 2) pool.push('listen');
    if (tier >= 2) pool.push('j2e');
    if (tier >= 3) pool.push('j2e', 'cloze');
    const form = pool[Math.floor(Math.random() * pool.length)];
    if (form === 'cloze' && !entry.ex) return 'j2e';
    return form;
  }

  // 想起カードを開く(intro語は事前にstudyをUI側で見せる)
  openRecall(w, now = Date.now()) {
    const p = this.app.profile;
    const entry = this.app.index.byKey.get(w);
    if (!entry) return null;
    const card = p.cards[w] || null;
    // まっさらな語(導入の3語): その場でステップ1相当の初想起から始める
    const stepState = p.steps[w] || (!card ? { step: 1, due: now, mikiri: false, fresh: true } : null);
    const form = this.formFor(w, stepState, card);
    this.recall = { w, entry, stepState, card, form, mikiri: false, q: null };
    return this.recall;
  }

  // ピンときた(選択肢を見る前の確信宣言)。検証は6択に難化
  declareMikiri() {
    if (this.recall && !this.recall.q) this.recall.mikiri = true;
  }

  // 選択肢をひらく(プレイヤーのタップでのみ呼ばれる。タイマーは存在しない)
  openChoices() {
    const r = this.recall;
    if (!r || r.q) return r ? r.q : null;
    const n = r.mikiri ? 5 : 3;
    r.q = makeQuestion(r.entry, r.card, this.app.index, this.app.profile.settings, r.form, n);
    return r.q;
  }

  // 回答。{correct, reward, manaReleased, burstM, graduated, promoted, sure, entry, correctText}
  submitRecall(choiceIdx, now = Date.now()) {
    const r = this.recall;
    if (!r || !r.q) return null;
    const p = this.app.profile;
    const correct = !!r.q.choices[choiceIdx]?.correct;
    const ds = dayStat(p, now);
    p.stats.recalls++; ds.r++;
    if (correct) { p.stats.correct++; ds.c++; }

    const sure = isSureRecall({ card: r.card, stepState: r.stepState, correct, now });
    if (sure) p.surely++;

    let reward = 0; let manaReleased = 0; let burstM = 1;
    let graduated = false; let promoted = null;

    if (r.stepState) {
      // 学習ステップ中: burst・熟成の対象外。ささやかな確定報酬のみ
      if (correct) reward = 4 + r.entry.l;
      if (r.stepState.fresh) dayStat(p, now).new++; // 導入語の新出消費は初想起の瞬間に数える
      const { state, graduated: card } = advanceStep(r.stepState, { correct, mikiri: r.mikiri }, now);
      if (card) {
        delete p.steps[r.w];
        p.cards[r.w] = card;
        graduated = true;
        promoted = TIER_NAMES[rarityIndex(card)];
      } else {
        p.steps[r.w] = state;
      }
    } else if (r.card) {
      const Rbefore = retrievability(r.card, now);
      const tierBefore = rarityIndex(r.card);
      const rating = correct ? (r.mikiri ? 3 : 2) : 0;
      p.cards[r.w] = review(r.card, rating, now);
      if (correct) {
        burstM = burst(Rbefore);
        if (p.cards[r.w].postLapse > 0) burstM = Math.min(burstM, 1.4); // 失念リハビリ中は控えめ
        reward = Math.round((6 + 2 * r.entry.l) * burstM * (r.mikiri ? 1.5 : 1));
        manaReleased = Math.round(p.mana[r.w] || 0);
        p.mana[r.w] = 0;
        const tierAfter = rarityIndex(p.cards[r.w]);
        if (tierAfter > tierBefore) promoted = TIER_NAMES[tierAfter];
      }
      // 誤答は罰なし: マナは籠に残り、語は次の機会に再会する(S縮小はsrs側の事実)
    }

    if (correct) {
      const cap = storageCap(p);
      const total = reward + manaReleased;
      p.lights = Math.min(cap, p.lights + total);
      p.totalLights += total;
    }

    const result = {
      correct, reward, manaReleased, burstM, graduated, promoted, sure,
      entry: r.entry, mikiri: r.mikiri,
      correctText: r.q.choices.find((c) => c.correct)?.t,
    };
    this.recall = null;
    this.updateStreak(now);
    this.app.save();
    return result;
  }

  // ---- 招く(新しい言霊) ----

  // 1日の上限は設けない(やりたい人は1日で多くの語彙を学べる)。
  // 学びすぎの帳尻は忘却曲線が取る: 日が経つほど復習(うとうと)が増え、修行が厚くなる。
  inviteCapToday(now = Date.now()) {
    const p = this.app.profile;
    if (p.settings.newPerDay >= 999) return 999;
    const used = dayStat(p, now).new || 0;
    return Math.max(0, p.settings.newPerDay - used);
  }

  roomLeft() {
    return 999; // 住まいの制限は廃止(寮は修行枠の拡張に転用)
  }

  inviteCandidates(n = 3) {
    const p = this.app.profile;
    const s = p.settings;
    const unseen = (e) => !p.cards[e.w] && !p.steps[e.w];
    let pool = this.app.words.filter((e) => unseen(e) && s.levels.includes(e.l) && s.fields.includes(e.f));
    if (!pool.length) return [];
    pool = pool.map((e) => ({ e, k: e.l + Math.random() * 1.2 })).sort((a, b) => a.k - b.k).map((x) => x.e);
    return pool.slice(0, n);
  }

  invite(w, now = Date.now()) {
    const p = this.app.profile;
    const entry = this.app.index.byKey.get(w);
    if (!entry || p.cards[w] || p.steps[w]) return false;
    if (this.inviteCapToday(now) <= 0 || this.roomLeft() <= 0) return false;
    p.steps[w] = startSteps(now);
    dayStat(p, now).new++;
    this.app.save();
    return true;
  }

  // ---- 宝箱(明日ひらく=分散学習の第1間隔) ----

  canMakeChest(now = Date.now()) {
    const p = this.app.profile;
    if (p.chest) return false;
    const todays = (dayStat(p, now).new || 0);
    return todays >= 3;
  }

  makeChest(now = Date.now()) {
    const p = this.app.profile;
    if (!this.canMakeChest(now)) return null;
    const today = todayKey(now);
    const words = [...Object.keys(p.steps), ...Object.entries(p.cards).filter(([, c]) => now - c.last < 86400000 && c.reps <= 2).map(([w]) => w)].slice(0, 8);
    const t = new Date(now); t.setDate(t.getDate() + 1);
    p.chest = { openDay: todayKey(t.getTime()), made: today, words };
    this.app.save();
    return p.chest;
  }

  canOpenChest(now = Date.now()) {
    const p = this.app.profile;
    return !!p.chest && p.chest.openDay <= todayKey(now);
  }

  openChest(now = Date.now()) {
    const p = this.app.profile;
    if (!this.canOpenChest(now)) return null;
    const words = p.chest.words.filter((w) => this.app.index.byKey.has(w));
    p.chest = null;
    this.app.save();
    // 開封ボーナス: 中の言霊のうとうと分が今この瞬間の収穫になる(数学的に正直: 一晩でRが下がっている)
    return words;
  }

  // ---- 施設 ----

  buyables() {
    const p = this.app.profile;
    return FACILITIES.map((f) => {
      const owned = p.facilities[f.id] || 0;
      return { ...f, owned, price: facilityPrice(f, owned), soldOut: owned >= f.max };
    });
  }

  buy(id, now = Date.now()) {
    const p = this.app.profile;
    const f = FACILITIES.find((x) => x.id === id);
    if (!f) return false;
    const owned = p.facilities[id] || 0;
    if (owned >= f.max) return false;
    const price = facilityPrice(f, owned);
    if (p.lights < price) return false;
    this.tick(now);
    p.lights -= price;
    p.facilities[id] = owned + 1;
    this.app.save();
    return true;
  }

  // ---- ストリーク(野営式) ----
  updateStreak(now = Date.now()) {
    const p = this.app.profile;
    const today = todayKey(now);
    if (p.streak.lastDay === today) return;
    const gap = dayDiff(p.streak.lastDay, today);
    if (gap === Infinity) p.streak.count = 1;
    else if (gap === 1) p.streak.count += 1;
    else if (gap > 1) p.streak.count = Math.max(1, p.streak.count - (gap - 1) * 2);
    else return; // 時計の巻き戻しでは何もしない
    p.streak.lastDay = today;
    p.streak.best = Math.max(p.streak.best, p.streak.count);
  }

  // ---- HUD用スナップショット ----
  snapshot(now = Date.now()) {
    const p = this.app.profile;
    const { rate } = productionAt(p, this.app.index, now);
    return {
      lights: Math.floor(p.lights),
      cap: storageCap(p),
      rate,
      drowsy: this.drowsyCount(now),
      graduates: this.graduates(),
      steps: Object.keys(p.steps).length,
      nextBell: nextBell(now),
      ttf: timeToFull(p, this.app.index, now),
      inviteLeft: Math.min(this.inviteCapToday(now), Math.max(0, this.roomLeft())),
      surely: p.surely,
    };
  }
}

export { TIER_NAMES, quantizeDue };
