// 単一永続画面のUI。モーダル・全画面遷移・タイマーは存在しない。
// すべてはこの1枚の中のインライン展開とログ行で起きる。
import { rarityIndex, retrievability, RARITY } from './srs.js';
import { POS_JA } from './quiz.js';
import { Workshop } from './workshop.js';
import { TIER_NAMES } from './economy.js';
import { REVEAL, SHOP_REVEAL, fireMilestones, maybeEvent, line, lineVar } from './story.js';
import { sfx, speak, initAudio, ttsAvailable } from './audio.js';
import { saveProfile, defaultProfile, todayKey, FIELD_NAMES, LEVEL_NAMES, ALL_FIELDS, dayStat } from './storage.js';

let app = null;
let ws = null;
let cardState = null;   // null | {mode:'study'|'recall'|'answer'|'invite'|'chest', ...}
let queue = [];         // 想起キュー(w の配列)
let fanHold = 0;
let saveTimer = 0;
let dayEndShown = false;
let cardRenderedAt = 0; // 描画直後の入力事故(ダブルタップ貫通)防止
let lastVerbsHtml = '';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function fmt(n) { return Math.floor(n).toLocaleString('ja-JP'); }
function hhmm(ts) { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }

function lazySave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => app.save(), 400);
}

// ---------- ログ ----------
function addLog(text, cls = '') {
  if (!text) return;
  const p = app.profile;
  p.story.log = p.story.log || [];
  p.story.log.push({ t: Date.now(), x: text });
  if (p.story.log.length > 50) p.story.log.splice(0, p.story.log.length - 50);
  const el = $('#log');
  if (el) {
    const div = document.createElement('div');
    div.className = `log-line ${cls}`;
    div.innerHTML = `<span class="log-mark">▸</span>${esc(text)}`;
    el.appendChild(div);
    while (el.children.length > 30) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }
  lazySave();
}

function checkMilestones(vars = {}) {
  if (!vars.word) {
    const grads = Object.entries(app.profile.cards).filter(([, c]) => c.reps > 0).map(([w]) => w);
    if (grads.length) vars.word = grads[Math.floor(Math.random() * grads.length)];
  }
  for (const t of fireMilestones(app.profile, ws, vars)) addLog(t, 'story');
}

// ---------- 起動 ----------
export function initUI(appRef) {
  app = appRef;
  ws = new Workshop(app);
  document.body.addEventListener('pointerdown', () => initAudio());

  $('#screen').innerHTML = `
    <header id="place" class="place hidden">
      <span id="placeName">まっくらな工房</span>
      <span class="place-right"><span id="bellTime" class="hidden"></span><button id="gear" class="gear">⚙</button></span>
    </header>
    <div id="res" class="res hidden">
      <span class="res-lights">灯火 <b id="lights">0</b><span id="rateTag" class="rate"></span></span>
      <span class="res-cap">棚 <span id="capNow">0</span>/<span id="capMax">0</span><span id="ttf" class="ttf"></span></span>
    </div>
    <div id="log" class="log hidden"></div>
    <div id="verbs" class="verbs hidden"></div>
    <div id="card" class="card-area"></div>
    <div id="shop" class="shop hidden"></div>
    <div id="roster" class="roster hidden"></div>
    <div id="settings" class="settings-panel hidden"></div>
    <div id="intro" class="intro hidden"></div>
    <div id="fanzone" class="fanzone hidden">
      <div class="fan-glow" id="fanGlow"></div>
      <div class="fan-label">靄を払う <small>タップ/長押しで風を送る</small></div>
    </div>
  `;

  wireFanzone();
  $('#gear').onclick = () => toggleSettings();

  const p = app.profile;
  // 復元: 過去ログ
  for (const l of (p.story.log || []).slice(-8)) {
    const div = document.createElement('div');
    div.className = 'log-line old';
    div.innerHTML = `<span class="log-mark">▸</span>${esc(l.x)}`;
    $('#log').appendChild(div);
  }

  if (p.story.intro < 99) {
    startIntro();
  } else {
    const ret = ws.settleReturn();
    if (ret.away > 90 * 1000 && ret.gained > 0) {
      addLog(lineVar('settle_return', { n: fmt(ret.gained) }));
      if (ret.cappedAt) addLog(lineVar('settle_capped', { time: agoText(Date.now() - ret.cappedAt) }));
    }
    if (p.story.seen.migrated === 1) { addLog(line('migrated'), 'story'); p.story.seen.migrated = 2; }
    if (ret.drowsy > 0) addLog(lineVar('drowsy_call', { n: ret.drowsy }));
    if (ws.canOpenChest()) addLog(line('chest_wait'), 'story');
  }

  renderAll();
  startLoops();
}

function agoText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}分`;
  return `${Math.round(m / 60)}時間`;
}

// ---------- 導入(靄を払う) ----------
function startIntro() {
  const p = app.profile;
  const intro = $('#intro');
  intro.classList.remove('hidden');
  const render = () => {
    const k = p.story.intro;
    intro.innerHTML = `
      <div class="mist" style="opacity:${Math.max(0.15, 1 - k * 0.11)}"></div>
      ${k === 0 ? `<p class="intro-line">${esc(line('intro_1'))}</p>` : ''}
      ${k >= 3 && k < 6 ? `<p class="intro-line dim">${esc(line('intro_2'))}</p>` : ''}
      ${k >= 6 ? `<div class="ember" id="ember"></div><p class="intro-line">${esc(line('intro_3'))}</p><button class="primary-btn" id="introGo">おもいだす</button>` : ''}
      ${k < 6 ? '<p class="intro-hint">タップで靄を払う</p>' : ''}
    `;
  };
  render();
  intro.onpointerdown = (e) => {
    if (e.target.closest('#introGo')) return;
    if (p.story.intro < 6) {
      p.story.intro++;
      sfx('tick');
      spark(e.clientX, e.clientY);
      render();
    }
  };
  intro.onclick = (e) => {
    if (e.target.closest('#introGo')) {
      p.story.intro = 99;
      intro.classList.add('hidden');
      intro.onpointerdown = null;
      app.save();
      renderAll();
      startRecallSession();
    }
  };
}

// ---------- 演出 ----------
function spark(x, y, big = false) {
  const s = document.createElement('div');
  s.className = `spark ${big ? 'big' : ''}`;
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 700);
}

function floatText(text, cls = '') {
  const f = document.createElement('div');
  f.className = `float-fx ${cls}`;
  f.textContent = text;
  $('#card').appendChild(f);
  setTimeout(() => f.remove(), 900);
}

// ---------- 全体描画 ----------
function renderAll() {
  const p = app.profile;
  $('#place').classList.toggle('hidden', !REVEAL.verbs(p));
  $('#res').classList.toggle('hidden', !REVEAL.counter(p));
  $('#log').classList.toggle('hidden', !REVEAL.log(p));
  $('#verbs').classList.toggle('hidden', !REVEAL.verbs(p) && !REVEAL.fireBuy(p) && !canRecallNow());
  $('#shop').classList.toggle('hidden', !REVEAL.shop(p, ws));
  $('#roster').classList.toggle('hidden', !REVEAL.roster(p, ws));
  $('#fanzone').classList.toggle('hidden', p.story.intro < 99);
  $('#bellTime').classList.toggle('hidden', !REVEAL.bellTime(p));
  $('#placeName').textContent = placeName();
  renderVerbs();
  renderShop();
  renderRoster();
  renderHud();
}

function placeName() {
  const g = ws.graduates();
  if (!app.profile.facilities.fire) return 'まっくらな工房';
  if (g < 10) return '火のともる工房';
  if (g < 30) return 'ことばの工房';
  if (g < 80) return '灯りの集まる工房';
  if (g < 200) return '言霊の村';
  return 'ことばの町';
}

function canRecallNow() {
  return ws.introQueue().length > 0 || ws.drowsyCount() > 0;
}

// ---------- HUD(毎フレーム軽量更新) ----------
function renderHud() {
  const p = app.profile;
  const now = Date.now();
  const snap = ws.snapshot(now);
  // 補間表示: 最後の精算からの増分を足す(本物のレートで動く)
  const interp = Math.min(snap.cap, p.lights + (snap.rate * (now - p.settledAt)) / 60000);
  $('#lights').textContent = fmt(interp);
  $('#rateTag').textContent = snap.rate > 0 ? ` (+${snap.rate.toFixed(1)}/分${ws.boost > 0.05 ? '🌬' : ''})` : '';
  $('#capNow').textContent = fmt(interp);
  $('#capMax').textContent = fmt(snap.cap);
  $('#ttf').textContent = REVEAL.ttf(p) && snap.ttf != null && snap.rate > 0
    ? (snap.ttf <= 0 ? ' 棚いっぱい' : ` 満タンまで${Math.ceil(snap.ttf / 60000)}分`) : '';
  if (REVEAL.bellTime(p)) $('#bellTime').textContent = `◉ ${hhmm(snap.nextBell.ts)}`;
  $('#fanGlow').style.opacity = Math.min(1, 0.15 + ws.boost * 0.6);
}

// ---------- 動詞 ----------
function renderVerbs() {
  const p = app.profile;
  const v = $('#verbs');
  const drowsy = ws.drowsyCount();
  const intro = ws.introQueue().length;
  const n = drowsy + (intro ? intro : 0);
  const parts = [];
  if (n > 0 || !p.facilities.fire) {
    parts.push(`<button class="verb primary" data-act="wake">${p.facilities.fire ? '起こす' : 'おもいだす'}${n ? ` (${n})` : ''}</button>`);
  }
  if (REVEAL.fireBuy(p)) {
    const price = 10;
    parts.push(`<button class="verb fire ${p.lights >= price ? '' : 'poor'}" data-act="buy-fire">火をおこす <small>${price}灯</small></button>`);
  }
  if (REVEAL.invite(p)) {
    const left = Math.min(ws.inviteCapToday(), Math.max(0, ws.roomLeft()));
    parts.push(`<button class="verb ${left ? '' : 'dim'}" data-act="invite">招く${left ? ` (${left})` : ''}</button>`);
  }
  if (ws.canOpenChest()) parts.push('<button class="verb chest" data-act="chest-open">宝箱をひらく</button>');
  else if (ws.canMakeChest()) parts.push('<button class="verb" data-act="chest-make">宝箱をつくる</button>');
  const html = parts.join('');
  if (html === lastVerbsHtml) return; // 変化がなければ再描画しない(タップ中の差し替え事故防止)
  lastVerbsHtml = html;
  v.innerHTML = html;
  v.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'wake') startRecallSession();
    if (act === 'buy-fire') buyFacility('fire');
    if (act === 'invite') openInvite();
    if (act === 'chest-make') makeChest();
    if (act === 'chest-open') openChest();
  };
}

// ---------- 店(施設) ----------
function renderShop() {
  const p = app.profile;
  const shop = $('#shop');
  if (!REVEAL.shop(p, ws)) { shop.innerHTML = ''; return; }
  const items = ws.buyables();
  const rows = [];
  let teaser = null;
  for (const f of items) {
    if (f.id === 'fire') continue;
    const revealed = SHOP_REVEAL[f.id] ? SHOP_REVEAL[f.id](p, ws) : true;
    if (!revealed) { if (!teaser) teaser = f; continue; }
    if (f.soldOut && f.max === 1) continue;
    const afford = p.lights >= f.price;
    rows.push(`<button class="shop-row ${afford ? '' : 'poor'}" data-buy="${f.id}">
      <span class="shop-name">${esc(f.name)}${f.owned ? ` <small>×${f.owned}</small>` : ''}</span>
      <span class="shop-desc">${esc(f.desc)}</span>
      <span class="shop-price">${afford ? `${fmt(f.price)}灯` : `あと${fmt(f.price - p.lights)}灯`}</span>
    </button>`);
  }
  if (teaser) {
    rows.push(`<div class="shop-row teaser"><span class="shop-name">${esc(teaser.name)}</span><span class="shop-desc">……まだ作れない。工房が育てば。</span></div>`);
  }
  shop.innerHTML = rows.length ? `<div class="shop-head">— 工房に作れるもの —</div>${rows.join('')}` : '';
  shop.onclick = (e) => {
    const b = e.target.closest('[data-buy]');
    if (b) buyFacility(b.dataset.buy);
  };
}

function buyFacility(id) {
  if (ws.buy(id)) {
    sfx('open');
    checkMilestones();
    renderAll();
  } else {
    const f = ws.buyables().find((x) => x.id === id);
    if (f && app.profile.lights < f.price) floatText(`あと${fmt(f.price - app.profile.lights)}灯`, 'need');
  }
}

// ---------- 言霊リスト ----------
function renderRoster() {
  const p = app.profile;
  const roster = $('#roster');
  if (!REVEAL.roster(p, ws)) { roster.innerHTML = ''; return; }
  const now = Date.now();
  const rows = [];
  const items = [];
  for (const [w, s] of Object.entries(p.steps)) {
    const e = app.index.byKey.get(w);
    if (e) items.push({ w, e, kind: 'step', due: s.due, sort: -2 });
  }
  for (const [w, c] of Object.entries(p.cards)) {
    const e = app.index.byKey.get(w);
    if (!e || !c.reps) continue;
    const R = retrievability(c, now);
    items.push({ w, e, c, kind: 'card', R, tier: rarityIndex(c), sort: R < 0.9 ? -1 : R });
  }
  items.sort((a, b) => a.sort - b.sort);
  const open = roster.dataset.open || '';
  for (const it of items.slice(0, 40)) {
    let status, cls = '';
    if (it.kind === 'step') {
      status = now >= it.due ? 'よびかけ待ち' : 'ねむりが浅い';
      cls = 'step';
    } else {
      const drowsyNow = now >= 0 && it.R < 0.9;
      const mana = Math.round(p.mana[it.w] || 0);
      if (drowsyNow) { status = `うとうと${mana ? `(熟成+${mana})` : ''}`; cls = 'drowsy'; }
      else {
        const days = Math.max(0, (it.c.due - now) / 86400000);
        status = `${TIER_NAMES[it.tier]}・働き中(あと${days < 1 ? '今夜まで' : Math.round(days) + '日'})`;
      }
    }
    const mark = it.kind === 'step' ? '・' : ['・', '☆', '★', '★', '✦'][it.tier];
    const color = it.kind === 'step' ? '#9a8fa8' : RARITY[it.tier].color;
    rows.push(`<div class="ro-row ${cls}" data-w="${esc(it.w)}">
      <span class="ro-mark" style="color:${color}">${mark}</span>
      <span class="ro-word">${esc(it.w)}</span>
      <span class="ro-status">${esc(status)}</span>
    </div>${open === it.w ? rosterDetail(it) : ''}`);
  }
  const more = items.length - 40;
  roster.innerHTML = `<div class="ro-head">— 工房のことだま <small>${items.length}体</small> —</div>${rows.join('')}${more > 0 ? `<div class="ro-more">ほか${more}体</div>` : ''}`;
  roster.onclick = (e) => {
    const row = e.target.closest('.ro-row');
    if (row) {
      roster.dataset.open = roster.dataset.open === row.dataset.w ? '' : row.dataset.w;
      renderRoster();
      return;
    }
    const spk = e.target.closest('[data-speak]');
    if (spk) { speak(spk.dataset.speak, app.profile.settings.rate); return; }
    const wake = e.target.closest('[data-wake]');
    if (wake) { queue = [wake.dataset.wake]; nextRecall(); }
  };
}

function rosterDetail(it) {
  const p = app.profile;
  const e = it.e;
  const drowsyNow = it.kind === 'card' && it.R < 0.9;
  return `<div class="ro-detail">
    <div class="ro-ja">${esc(e.j)} <span class="pos">${POS_JA[e.p] || ''}</span> <button class="mini-btn" data-speak="${esc(e.w)}">🔊</button></div>
    ${e.ex ? `<div class="ro-ex">${esc(e.ex)}<br><small>${esc(e.jx)}</small></div>` : ''}
    ${it.kind === 'card' ? `<div class="ro-meta">輝き ${(it.R * 100).toFixed(0)}% ・ ${TIER_NAMES[it.tier]} ・ 思い出した回数 ${it.c.reps}</div>` : ''}
    ${drowsyNow ? `<button class="mini-btn warm" data-wake="${esc(it.w)}">起こす</button>` : ''}
  </div>`;
}

// ---------- 想起セッション ----------
function startRecallSession() {
  queue = [...ws.introQueue(), ...ws.wakeQueue().map((x) => x.w)];
  dayEndShown = false;
  if (!queue.length) {
    addLog(line('wake_none'));
    return;
  }
  nextRecall();
}

function nextRecall() {
  const p = app.profile;
  if (!queue.length) {
    cardState = null;
    renderCard();
    renderAll();
    if (!dayEndShown && ws.inviteCapToday() === 0) {
      dayEndShown = true;
      addLog(line('day_end', { time: hhmm(ws.snapshot().nextBell.ts) }));
    }
    return;
  }
  const w = queue.shift();
  const fresh = !p.cards[w] && !p.steps[w];
  const r = ws.openRecall(w);
  if (!r) { nextRecall(); return; }
  if (fresh) {
    cardState = { mode: 'study', r };
    renderCard();
    if (p.settings.autoSpeak || p.settings.listen) speak(w, p.settings.rate);
  } else {
    cardState = { mode: 'recall', r };
    renderCard();
    if (r.form === 'listen') speak(w, p.settings.rate);
  }
}

function renderCard() {
  const card = $('#card');
  cardRenderedAt = performance.now();
  if (!cardState) { card.innerHTML = ''; return; }
  const p = app.profile;
  const { mode, r } = cardState;

  if (mode === 'study') {
    card.innerHTML = `<div class="icard pop">
      <div class="icard-tag">新しい言霊</div>
      <div class="icard-word">${esc(r.entry.w)} <button class="mini-btn" data-act="spk">🔊</button></div>
      <div class="icard-ja">${esc(r.entry.j)} <span class="pos">${POS_JA[r.entry.p] || ''}</span></div>
      ${r.entry.ex ? `<div class="icard-ex">${esc(r.entry.ex)}<br><small>${esc(r.entry.jx)}</small></div>` : ''}
      <button class="primary-btn" data-act="got">おぼえた</button>
    </div>`;
  } else if (mode === 'recall') {
    const f = r.form;
    let prompt;
    if (f === 'listen') prompt = `<button class="replay" data-act="spk">🔊</button>`;
    else if (f === 'j2e') prompt = `<div class="icard-word ja">${esc(r.entry.j)}</div><div class="icard-sub">${POS_JA[r.entry.p] || ''}・英語は?</div>`;
    else if (f === 'cloze') prompt = `<div class="icard-cloze">${esc(clozePrompt(r.entry))}</div><div class="icard-sub">${esc(r.entry.jx || '')}</div>`;
    else prompt = `<div class="icard-word">${esc(r.entry.w)}</div><div class="icard-sub">${POS_JA[r.entry.p] || ''}・意味は?</div>`;
    card.innerHTML = `<div class="icard pop">
      ${r.stepState ? '<div class="icard-tag dim">ねむりの浅い言霊</div>' : ''}
      ${r.mikiri ? '<div class="icard-tag pinto">ピンときた!</div>' : ''}
      <div class="icard-prompt">${prompt}</div>
      ${r.q ? choicesHtml(r.q) : `
        <div class="icard-actions">
          ${REVEAL.pinto(p) && !r.mikiri ? '<button class="ghost-btn" data-act="pinto">ピンときた</button>' : ''}
          <button class="primary-btn" data-act="open">選択肢をひらく</button>
        </div>`}
      ${queue.length ? `<div class="icard-rest">あと${queue.length + 1}体</div>` : ''}
    </div>`;
  } else if (mode === 'answer') {
    const res = cardState.res;
    const e = res.entry;
    card.innerHTML = `<div class="icard miss">
      <div class="icard-word small">${esc(e.w)} <button class="mini-btn" data-act="spk">🔊</button></div>
      <div class="icard-ja">${esc(e.j)}</div>
      ${e.ex ? `<div class="icard-ex">${esc(e.ex)}<br><small>${esc(e.jx)}</small></div>` : ''}
      <button class="primary-btn" data-act="next">つぎへ</button>
    </div>`;
  } else if (mode === 'invite') {
    const cands = cardState.cands;
    card.innerHTML = `<div class="icard pop">
      <div class="icard-tag">靄のむこうから来た</div>
      ${cands.map((e, i) => `
        <div class="cand">
          <div class="cand-head"><b>${esc(e.w)}</b> <span class="cand-ja">${esc(e.j)}</span>
            <button class="mini-btn" data-speak="${esc(e.w)}">🔊</button></div>
          <div class="cand-meta">${LEVEL_NAMES[e.l]}・${FIELD_NAMES[e.f] || ''}${e.ex ? ` — <i>${esc(e.ex)}</i>` : ''}</div>
          <button class="ghost-btn small" data-invite="${i}">この子を招く</button>
        </div>`).join('')}
      <button class="text-btn" data-act="close">また今度</button>
    </div>`;
  }

  card.onclick = (e) => {
    if (performance.now() - cardRenderedAt < 250) return; // 前の画面へのタップの貫通防止
    const sp = e.target.closest('[data-speak]');
    if (sp) { speak(sp.dataset.speak, p.settings.rate); return; }
    const inv = e.target.closest('[data-invite]');
    if (inv) { doInvite(Number(inv.dataset.invite)); return; }
    const ch = e.target.closest('[data-choice]');
    if (ch) { answer(Number(ch.dataset.choice)); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'spk') speak(cardState.r ? cardState.r.entry.w : cardState.res.entry.w, p.settings.rate);
    if (act === 'got') { cardState = { mode: 'recall', r: cardState.r }; renderCard(); }
    if (act === 'pinto') { ws.declareMikiri(); cardState.r.mikiri = true; sfx('flip'); renderCard(); }
    if (act === 'open') { ws.openChoices(); renderCard(); }
    if (act === 'next') nextRecall();
    if (act === 'close') { cardState = null; renderCard(); }
  };
}

function clozePrompt(entry) {
  return entry.ex.replace(new RegExp(`\\b${entry.w.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'), '____');
}

function choicesHtml(q) {
  return `<div class="ichoices">${q.choices.map((c, i) => `<button class="ichoice" data-choice="${i}">${esc(c.t)}</button>`).join('')}</div>`;
}

function answer(idx) {
  const r = cardState.r;
  if (!r || !r.q) return;
  const res = ws.submitRecall(idx);
  if (!res) return;
  const p = app.profile;

  // 選択肢に正誤を一瞬見せる(画面は止めない)
  document.querySelectorAll('.ichoice').forEach((el, i) => {
    el.disabled = true;
    if (r.q.choices[i].correct) el.classList.add('ok');
    else if (i === idx) el.classList.add('ng');
  });

  if (res.correct) {
    const total = res.reward + res.manaReleased;
    const burstTxt = res.burstM >= 1.8 ? ` ×${res.burstM.toFixed(1)}` : '';
    sfx(res.burstM >= 2.2 || res.graduated ? 'crit' : 'ok');
    if (navigator.vibrate) navigator.vibrate(res.burstM >= 2.2 ? 25 : 10);
    floatText(`+${fmt(total)}${burstTxt}`, res.burstM >= 2.2 ? 'crit' : '');
    if (res.manaReleased > 0) addLog(`『${res.entry.w}』が目を覚ました。${lineVar('mana_burst') || ''} +${fmt(res.manaReleased)}`);
    else addLog(`『${res.entry.w}』…… 灯った(+${fmt(res.reward)}${burstTxt})`);
    if (res.graduated) {
      const S = p.cards[res.entry.w]?.S || 2.5;
      if (!p.story.seen.first_grad) { addLog(line('first_grad', { word: res.entry.w }), 'story'); p.story.seen.first_grad = 1; }
      else addLog(line('first_promote', { word: res.entry.w, n: Math.max(1, Math.round(S)) }), 'story');
    } else if (res.promoted) {
      addLog(lineVar('promote', { word: res.entry.w, tier: res.promoted }), 'story');
    }
    if (p.settings.autoSpeak && r.form !== 'listen') speak(res.entry.w, p.settings.rate);
    checkMilestones({ word: res.entry.w });
    setTimeout(() => { if (cardState && cardState.r === r) nextRecall(); }, 600);
    cardState.advancing = true;
  } else {
    sfx('bad');
    addLog(lineVar('miss_soft', { word: res.entry.w }));
    speak(res.entry.w, p.settings.rate);
    setTimeout(() => {
      cardState = { mode: 'answer', res };
      renderCard();
    }, 450);
  }
  renderHud();
  renderVerbs();
}

// ---------- 招く ----------
function openInvite() {
  const left = Math.min(ws.inviteCapToday(), Math.max(0, ws.roomLeft()));
  if (left <= 0) {
    addLog(lineVar('invite_cap') || 'きょうの招きはここまで。');
    return;
  }
  const cands = ws.inviteCandidates(3);
  if (!cands.length) { addLog(line('invite_empty')); return; }
  cardState = { mode: 'invite', cands };
  renderCard();
}

function doInvite(i) {
  const e = cardState.cands[i];
  if (!e) return;
  if (ws.invite(e.w)) {
    sfx('flip');
    addLog(`『${e.w}』(${e.j})が工房に来た。3分したら、声をかけてみよう。`);
    if (app.profile.settings.autoSpeak || app.profile.settings.listen) speak(e.w, app.profile.settings.rate);
    cardState.cands.splice(i, 1);
    const left = Math.min(ws.inviteCapToday(), Math.max(0, ws.roomLeft()));
    if (!cardState.cands.length || left <= 0) { cardState = null; }
    renderCard();
    renderVerbs();
    renderRoster();
  }
}

// ---------- 宝箱 ----------
function makeChest() {
  const c = ws.makeChest();
  if (c) { addLog(line('chest_make'), 'story'); sfx('flip'); renderVerbs(); }
}

function openChest() {
  const words = ws.openChest();
  if (!words) return;
  sfx('open');
  addLog(line('chest_open'), 'story');
  queue = [...ws.introQueue(), ...ws.wakeQueue().map((x) => x.w)];
  if (queue.length) nextRecall();
  renderVerbs();
}

// ---------- ふいご ----------
function wireFanzone() {
  const fz = $('#fanzone');
  let lastEmpty = 0;
  const fan = (x, y) => {
    const res = ws.fan();
    sfx('tick');
    spark(x, y);
    if (!res.producing && Date.now() - lastEmpty > 6000) {
      lastEmpty = Date.now();
      addLog(lineVar('empty_tap') || '風だけでは、火は生まれない。');
    }
    renderHud();
  };
  fz.addEventListener('pointerdown', (e) => {
    fan(e.clientX, e.clientY);
    clearInterval(fanHold);
    fanHold = setInterval(() => fan(e.clientX, e.clientY), 140); // 長押しオート連打
  });
  const stop = () => clearInterval(fanHold);
  fz.addEventListener('pointerup', stop);
  fz.addEventListener('pointercancel', stop);
  fz.addEventListener('pointerleave', stop);
}

// ---------- 設定 ----------
function toggleSettings() {
  const el = $('#settings');
  if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
  const s = app.profile.settings;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="set-head">— 設定 —</div>
    <h4>招くことばのレベル</h4>
    <div class="chips">${[1, 2, 3, 4, 5].map((l) => `<button class="chip ${s.levels.includes(l) ? 'on' : ''}" data-lv="${l}">${LEVEL_NAMES[l]}</button>`).join('')}</div>
    <h4>分野</h4>
    <div class="chips">${ALL_FIELDS.map((f) => `<button class="chip ${s.fields.includes(f) ? 'on' : ''}" data-fd="${f}">${FIELD_NAMES[f]}</button>`).join('')}</div>
    <h4>1日に招ける数</h4>
    <div class="chips">${[5, 10, 15, 20].map((n) => `<button class="chip ${s.newPerDay === n ? 'on' : ''}" data-np="${n}">${n}体</button>`).join('')}</div>
    <h4>音</h4>
    <div class="chips">
      <button class="chip ${s.listen ? 'on' : ''}" data-tg="listen">聴き取りの想起${ttsAvailable() ? '' : '(非対応)'}</button>
      <button class="chip ${s.autoSpeak ? 'on' : ''}" data-tg="autoSpeak">自動で読み上げ</button>
    </div>
    <label class="slider-row">読み上げの速さ <input type="range" id="rateSlider" min="0.6" max="1.2" step="0.05" value="${s.rate}"></label>
    <h4>記録</h4>
    <div class="chips">
      <button class="chip" data-act="export">書き出す</button>
      <button class="chip" data-act="import">読み込む</button>
      <button class="chip danger" data-act="reset">すべて忘れる</button>
    </div>
    <div class="set-stats">たね火 ${app.profile.streak.count}日 ・ 確かな想起 ${app.profile.surely} ・ ことだま ${ws.graduates()}体</div>
  `;
  el.onclick = (ev) => {
    const lv = ev.target.closest('[data-lv]');
    if (lv) {
      const l = Number(lv.dataset.lv);
      if (s.levels.includes(l)) { if (s.levels.length > 1) s.levels = s.levels.filter((x) => x !== l); }
      else s.levels = [...s.levels, l].sort();
      app.save(); toggleSettings(); toggleSettings(); return;
    }
    const fd = ev.target.closest('[data-fd]');
    if (fd) {
      const f = fd.dataset.fd;
      if (s.fields.includes(f)) { if (s.fields.length > 1) s.fields = s.fields.filter((x) => x !== f); }
      else s.fields.push(f);
      app.save(); toggleSettings(); toggleSettings(); return;
    }
    const np = ev.target.closest('[data-np]');
    if (np) { s.newPerDay = Number(np.dataset.np); app.save(); toggleSettings(); toggleSettings(); return; }
    const tg = ev.target.closest('[data-tg]');
    if (tg) { s[tg.dataset.tg] = !s[tg.dataset.tg]; app.save(); toggleSettings(); toggleSettings(); return; }
    const act = ev.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'export') {
      const data = JSON.stringify(app.profile);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(data).then(() => addLog('記録を書き出した(クリップボード)。')).catch(() => prompt('コピーしてください', data));
      else prompt('コピーしてください', data);
    }
    if (act.dataset.act === 'import') {
      const raw = prompt('書き出した記録を貼り付け:');
      if (!raw) return;
      try { const obj = JSON.parse(raw); if (!obj.cards) throw 0; saveProfile(obj); location.reload(); }
      catch { addLog('読み込めなかった。'); }
    }
    if (act.dataset.act === 'reset') {
      if (confirm('本当にすべて忘れる?言霊たちの記憶も消える')) { saveProfile(defaultProfile()); location.reload(); }
    }
  };
  $('#rateSlider').oninput = (ev) => { s.rate = Number(ev.target.value); lazySave(); };
}

// ---------- ループ ----------
function startLoops() {
  // 毎秒: 精算・マイルストーン・イベント
  setInterval(() => {
    ws.tick();
    checkMilestones();
    const ev = maybeEvent(app.profile);
    if (ev) addLog(ev);
    renderVerbs();
    lazySave();
  }, 1000);
  // 毎フレーム: カウンタ補間
  const frame = () => { renderHud(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  // 30秒ごと: リスト更新(うとうと状態の変化)
  setInterval(() => { renderRoster(); renderShop(); }, 30000);
  // 復帰時の精算
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const ret = ws.settleReturn();
      if (ret.gained > 2 && ret.away > 5 * 60000) {
        addLog(lineVar('settle_return', { n: fmt(ret.gained) }));
        if (ret.drowsy > 0) addLog(lineVar('drowsy_call', { n: ret.drowsy }));
      }
      renderAll();
    }
  });
}

export function toast(msg) { addLog(msg); }
