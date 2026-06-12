// 画面描画・ジェスチャー・演出。縦持ち片手・タップ/スワイプのみ。
import { RARITY, retrievability, rarityIndex, isDue, DAY } from './srs.js';
import { POS_JA } from './quiz.js';
import { toolById } from './tools.js';
import { Run } from './game.js';
import { sfx, speak, initAudio, ttsAvailable } from './audio.js';
import { saveProfile, defaultProfile, todayKey, dayStat, ALL_FIELDS, FIELD_NAMES, LEVEL_NAMES } from './storage.js';

let app = null;
let run = null;
let cur = null;        // {item, pos, total}
let phase = 'idle';    // prompt | choices | feedback
let mikiri = false;
let tShown = 0;
let revealTimer = 0;
let ptr = null;
let feedbackTimer = 0;
let feedbackFn = null;     // 回答後の自動送り(タップで先送り可能にするため保持)
let feedbackAt = 0;
let stageRenderedAt = 0;   // ゴーストクリック・ダブルタップ貫通対策: 描画直後の入力を無効化
let scoreAnimUntil = 0;

const $ = (s) => document.querySelector(s);
const screen = () => $('#screen');

// 画面差し替え直後300msの入力は「前の画面に向けたタップ」なので捨てる
function stageRendered() { stageRenderedAt = performance.now(); }
function freshInput() { return performance.now() - stageRenderedAt > 300; }

function scheduleFeedback(fn, delay) {
  clearTimeout(feedbackTimer);
  feedbackFn = fn;
  feedbackAt = performance.now();
  feedbackTimer = setTimeout(() => { feedbackFn = null; fn(); }, delay);
}

// フィードバック中のタップで待たずに次へ(250msだけ誤タップガード)
function skipFeedback() {
  if (!feedbackFn || performance.now() - feedbackAt < 250) return;
  clearTimeout(feedbackTimer);
  const fn = feedbackFn;
  feedbackFn = null;
  fn();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export function initUI(appRef) {
  app = appRef;
  // 毎タップで呼ぶ: iOSがAudioContextをsuspend/interruptedにした後の復帰を兼ねる
  document.body.addEventListener('pointerdown', () => initAudio());
  goHome();
}

export function toast(msg, ms = 1800) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- ホーム ----------
export function goHome() {
  run = null;
  cur = null;
  phase = 'idle';
  clearTimeout(revealTimer);
  clearTimeout(feedbackTimer);
  feedbackFn = null;
  const p = app.profile;
  const now = Date.now();
  const today = todayKey();
  const cards = Object.entries(p.cards).filter(([w]) => app.index.byKey.has(w));
  const seen = cards.filter(([, c]) => c.reps > 0);
  const due = seen.filter(([, c]) => c.due <= now).length;
  const ds = dayStat(p);
  const openable = (p.chests || []).filter((c) => c.openDay <= today);
  const future = (p.chests || []).filter((c) => c.openDay > today);
  const rarityCounts = [0, 0, 0, 0, 0];
  for (const [, c] of seen) rarityCounts[rarityIndex(c)]++;

  screen().innerHTML = `
  <div class="home">
    <header class="home-head">
      <div class="streak">🔥 <b>${p.streak.count}</b>日</div>
      <div class="title-mini">コトダマ・リフォージ</div>
      <button class="icon-btn" data-act="settings">⚙️</button>
    </header>
    <div class="hero">
      <div class="hero-flame">⚒️</div>
      <h1>錆と忘却の塔</h1>
      <p class="hero-sub">${due > 0 ? `<b class="warn">${due}体</b>の言霊が錆びかけている` : seen.length ? 'すべての言霊が輝いている' : '言霊との出会いが待っている'}</p>
      <button class="big-btn" data-act="start">⚔️ 出発する</button>
      <div class="hero-stats">今日の想起 ${ds.r}回${ds.r ? ` ・ 正答率 ${Math.round((ds.c / ds.r) * 100)}%` : ''}</div>
    </div>
    ${openable.length || future.length ? `
    <div class="chest-row">
      ${openable.map((c, i) => `<button class="chest openable" data-act="open-chest" data-i="${p.chests.indexOf(c)}">📦<span>開封できる!</span></button>`).join('')}
      ${future.map(() => `<div class="chest locked">🔒<span>明日開く</span></div>`).join('')}
    </div>` : ''}
    <div class="home-grid">
      <button class="panel-btn" data-act="collection">📖 図鑑<small>${seen.length} / ${app.words.length}</small></button>
      <button class="panel-btn" data-act="settings">⚙️ 設定<small>Lv ${p.settings.levels.join('・')}</small></button>
    </div>
    <div class="rarity-bar">
      ${RARITY.map((r, i) => `<div class="rb" style="color:${r.color}">${r.name}<b>${rarityCounts[i]}</b></div>`).join('')}
    </div>
  </div>`;

  screen().onclick = (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'start') startRun();
    else if (act === 'collection') goCollection();
    else if (act === 'settings') goSettings();
    else if (act === 'open-chest') openChest(Number(a.dataset.i));
  };
}

// ---------- 宝箱 ----------
function openChest(idx) {
  const p = app.profile;
  const chest = p.chests[idx];
  if (!chest) return;
  const s = p.settings;
  const unseen = (e) => !p.cards[e.w] || !p.cards[e.w].reps;
  let pool = app.words.filter((e) => unseen(e) && s.levels.includes(e.l) && s.fields.includes(e.f) && !(p.pendingNew || []).includes(e.w));
  if (!pool.length) {
    // 設定範囲を学び尽くした: 黙って範囲外を出さず、宝箱は温存して知らせる
    toast('🎉 設定中のレベル・分野は学び尽くした!設定を広げると宝箱が開けられる');
    return;
  }
  p.chests.splice(idx, 1);
  pool = pool.map((e) => ({ e, k: e.l + Math.random() * 1.2 })).sort((a, b) => a.k - b.k).map((x) => x.e);
  const got = pool.slice(0, chest.n);
  p.pendingNew = [...(p.pendingNew || []), ...got.map((e) => e.w)];
  app.save();
  sfx('open');
  screen().innerHTML = `
  <div class="chest-open">
    <h2>📦 熟成宝箱</h2>
    <p class="sub">新しい言霊が仲間入り。次の出発で炉にくべよう</p>
    <div class="new-words">
      ${got.map((e) => `
        <div class="word-card pop">
          <div class="wc-head"><b class="en">${esc(e.w)}</b><span class="pos">${POS_JA[e.p] || ''}</span>
            <button class="icon-btn spk" data-w="${esc(e.w)}">🔊</button></div>
          <div class="ja">${esc(e.j)}</div>
          ${e.ex ? `<div class="ex">${esc(e.ex)}<br><span class="jx">${esc(e.jx)}</span></div>` : ''}
        </div>`).join('')}
    </div>
    <button class="big-btn" data-act="back">持ち帰る</button>
  </div>`;
  screen().onclick = (e) => {
    const spk = e.target.closest('.spk');
    if (spk) { speak(spk.dataset.w, app.profile.settings.rate); return; }
    if (e.target.closest('[data-act="back"]')) goHome();
  };
  if (got[0]) speak(got[0].w, p.settings.rate);
}

// ---------- ラン ----------
function startRun() {
  run = new Run(app);
  renderRunShell();
  handleStep(run.startNode());
}

function renderRunShell() {
  screen().innerHTML = `
  <div class="run">
    <header class="run-head">
      <button class="icon-btn" data-act="quit">✕</button>
      <div class="nodes">${[0, 1, 2, 3, 4].map((i) => `<span class="nd" data-n="${i}">⚒️</span>`).join('')}<span class="nd boss" data-n="5">👹</span></div>
      <div class="combo" id="combo"></div>
    </header>
    <div class="score-wrap">
      <div class="score-bar"><div class="score-fill" id="scoreFill"></div></div>
      <div class="score-text"><span id="scoreNow">0</span> / <span id="scoreTarget">0</span> 🔥</div>
    </div>
    <div class="tools-row" id="toolsRow"></div>
    <div class="stage" id="stage"></div>
  </div>`;
  $('.run-head').onclick = (e) => {
    if (e.target.closest('[data-act="quit"]')) {
      if (confirm('塔から帰還する?(想起の記録は保存済み)')) goHome();
    }
  };
  $('#toolsRow').onclick = (e) => {
    const t = e.target.closest('.tool-chip');
    if (t) toast(`${t.dataset.name}: ${t.dataset.desc}`);
  };
  const stage = $('#stage');
  stage.addEventListener('pointerdown', onPtrDown);
  stage.addEventListener('pointerup', onPtrUp);
  stage.addEventListener('pointercancel', () => { ptr = null; });
}

function updateRunHud() {
  if (!run || run.finished) return;
  document.querySelectorAll('.nd').forEach((el) => {
    const n = Number(el.dataset.n);
    el.classList.toggle('done', n < run.nodeIdx);
    el.classList.toggle('cur', n === run.nodeIdx);
  });
  $('#scoreTarget').textContent = run.target;
  // 数字とゲージは常に同期(カウントアップ演出中だけ演出に任せる)
  const sn = $('#scoreNow');
  if (sn && performance.now() > scoreAnimUntil) sn.textContent = Math.round(run.nodeScore);
  const fill = Math.min(100, (run.nodeScore / run.target) * 100);
  const fillEl = $('#scoreFill');
  if (fillEl.dataset.node !== String(run.nodeIdx)) {
    // ノードが変わった直後はゲージを逆流アニメさせず瞬時にリセットする
    fillEl.dataset.node = String(run.nodeIdx);
    fillEl.style.transition = 'none';
    fillEl.style.width = `${fill}%`;
    requestAnimationFrame(() => { fillEl.style.transition = ''; });
  } else {
    fillEl.style.width = `${fill}%`;
  }
  fillEl.classList.toggle('full', fill >= 100);
  $('#combo').innerHTML = run.combo >= 2 ? `🔥×${run.combo}` : '';
  $('#toolsRow').innerHTML = run.tools.map((id) => {
    const t = toolById(id);
    return `<span class="tool-chip" data-name="${esc(t.name)}" data-desc="${esc(t.desc)}">${t.icon}</span>`;
  }).join('') || '<span class="tool-hint">鍛冶具なし</span>';
}

function animateScore(from, to) {
  const el = $('#scoreNow');
  if (!el) return;
  const t0 = performance.now();
  const dur = 450;
  scoreAnimUntil = t0 + dur;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function handleStep(step) {
  if (!step) return;
  if (step.finished) { renderResult(step); return; }
  if (step.nodeCleared) { renderNodeCleared(step); return; }
  cur = step;
  updateRunHud();
  if (step.item.kind === 'study') renderStudy(step.item);
  else renderPrompt(step.item);
}

// 新しい言霊との出会い
function renderStudy(item) {
  phase = 'study';
  const e = item.entry;
  $('#stage').innerHTML = `
  <div class="study pop">
    <div class="tag-new">✨ 新しい言霊</div>
    <div class="big-word">${esc(e.w)}</div>
    <div class="meta"><span class="pos">${POS_JA[e.p] || ''}</span><span class="lv">Lv${e.l} ${LEVEL_NAMES[e.l]}</span><span class="fd">${FIELD_NAMES[e.f] || ''}</span></div>
    <div class="big-ja">${esc(e.j)}</div>
    ${e.ex ? `<div class="ex-box">${esc(e.ex)}<br><span class="jx">${esc(e.jx)}</span></div>` : ''}
    <button class="icon-btn big spk" data-act="speak">🔊</button>
    <button class="big-btn" data-act="forge">炉にくべる →</button>
  </div>`;
  stageRendered();
  $('#stage').onclick = (e2) => {
    if (!freshInput()) return; // 前画面へのタップの貫通防止
    const a = e2.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'speak') speak(e.w, app.profile.settings.rate);
    if (a.dataset.act === 'forge') { $('#stage').onclick = null; handleStep(run.advance()); }
  };
  // 新出語の発音は最初に必ず聴かせる(後のリスニング出題への布石)
  if (app.profile.settings.autoSpeak || app.profile.settings.listen) speak(e.w, app.profile.settings.rate);
}

// 想起の間: 選択肢が出る前の2.2秒。↑見切り ↓パス
function renderPrompt(item) {
  phase = 'prompt';
  mikiri = false;
  const q = item.q;
  const isListen = q.type === 'listen';
  const boss = run.isBoss;
  $('#stage').onclick = null;
  $('#stage').innerHTML = `
  <div class="qa ${boss ? 'boss-bg' : ''}">
    ${boss ? '<div class="boss-label">👹 忘却獣</div>' : ''}
    ${item.retry ? '<div class="tag-retry">⚡ 暴走再挑戦</div>' : ''}
    ${item.isNew ? '<div class="tag-new small">✨ 新出</div>' : ''}
    <div class="q-type">${typeLabel(q.type)}</div>
    <div class="prompt-area">
      ${isListen
        ? `<button class="replay" data-act="replay">🔊</button><div class="peek-slot" id="peekSlot"><button class="text-btn" data-act="peek">👁 文字を見る(報酬減)</button></div>`
        : `<div class="prompt ${q.type === 'cloze' ? 'cloze' : ''} ${q.type === 'j2e' ? 'ja-prompt' : ''}">${esc(q.prompt)}</div>`}
      ${q.sub ? `<div class="q-sub">${esc(q.sub)}</div>` : ''}
    </div>
    <div class="think-bar"><div class="think-fill" id="thinkFill"></div></div>
    <div class="gesture-hints">
      ${item.isNew ? '' : `<button class="hint-btn" data-act="mikiri">⚡ 見切り <small>↑スワイプ ×1.5 / 外すと−15</small></button>`}
      <button class="hint-btn" data-act="pass">🏳️ パス <small>↓スワイプ</small></button>
    </div>
    <div class="tap-hint">タップで選択肢を出す</div>
  </div>`;
  stageRendered();
  $('#stage').onclick = (e) => {
    if (!freshInput()) return;
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'replay') { speak(item.entry.w, app.profile.settings.rate); return; }
    if (a.dataset.act === 'peek') { peekWord(item); return; }
    if (a.dataset.act === 'mikiri') doMikiri();
    if (a.dataset.act === 'pass') doPass();
  };
  if (isListen) speak(item.entry.w, app.profile.settings.rate);
  // Web Animations API: rAF位相に依存せず確実にバーが動く(transition方式はフレーム位相で即0%になる事故がある)
  const f = $('#thinkFill');
  if (f) {
    if (f.animate) f.animate([{ width: '100%' }, { width: '0%' }], { duration: 2250, easing: 'linear', fill: 'forwards' });
    else { void f.offsetWidth; f.style.transition = 'width 2.25s linear'; f.style.width = '0%'; }
  }
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => { if (phase === 'prompt') revealChoices(); }, 2300);
}

function typeLabel(t) {
  return { e2j: '意味は?', j2e: '英語は?', listen: 'リスニング', cloze: '空所に入るのは?' }[t] || '';
}

function peekWord(item) {
  // リスニングのフォールバック: TTSが鳴らない環境でも詰まないように文字を見せる(報酬・評価は下がる)
  item.hinted = true;
  const slot = $('#peekSlot');
  if (slot) slot.innerHTML = `<div class="prompt small">${esc(item.entry.w)}</div>`;
}

function doMikiri() {
  if (phase !== 'prompt') return;
  if (cur?.item?.isNew) return; // 新出のエコーテストに見切りは使えない
  mikiri = true;
  sfx('flip');
  revealChoices();
}

function doPass() {
  if (phase !== 'prompt') return;
  clearTimeout(revealTimer);
  phase = 'feedback';
  const res = run.submit({ passed: true });
  renderMissPanel(res, 'パス — 正直は強さ。ノード終盤にもう一度挑もう');
}

function revealChoices() {
  if (phase !== 'prompt') return;
  clearTimeout(revealTimer);
  phase = 'choices';
  tShown = Date.now();
  const item = cur.item;
  const q = item.q;
  const dirs = ['top', 'right', 'bottom', 'left'];
  const isListen = q.type === 'listen';
  const promptHtml = isListen
    ? `<button class="replay small" data-act="replay">🔊</button><div class="peek-slot" id="peekSlot">${item.hinted ? `<div class="prompt small">${esc(item.entry.w)}</div>` : `<button class="text-btn" data-act="peek">👁 文字を見る(報酬減)</button>`}</div>`
    : `<div class="prompt small ${q.type === 'cloze' ? 'cloze' : ''} ${q.type === 'j2e' ? 'ja-prompt' : ''}">${esc(q.prompt)}</div>`;
  $('#stage').innerHTML = `
  <div class="qa choices-phase ${run.isBoss ? 'boss-bg' : ''}">
    ${mikiri ? '<div class="tag-mikiri">⚡ 見切り中 ×1.5</div>' : ''}
    <div class="prompt-area compact">${promptHtml}</div>
    <div class="diamond">
      ${q.choices.map((c, i) => `<button class="choice ${dirs[i]}" data-i="${i}">${esc(c.t)}</button>`).join('')}
    </div>
    <div class="tap-hint">フリック or タップで回答</div>
  </div>`;
  stageRendered();
  $('#stage').onclick = (e) => {
    if (e.target.closest('[data-act="replay"]')) { speak(item.entry.w, app.profile.settings.rate); return; }
    if (e.target.closest('[data-act="peek"]')) { peekWord(item); return; }
    // ゴーストクリック対策: 画面差し替え直後のclick(=想起の間へのタップの残響)は回答にしない
    if (!freshInput()) return;
    const c = e.target.closest('.choice');
    if (c && phase === 'choices') answer(Number(c.dataset.i));
  };
}

function answer(idx) {
  if (phase !== 'choices') return;
  phase = 'feedback';
  const item = cur.item;
  const myRun = run;
  const res = run.submit({ choiceIdx: idx, mikiri, hinted: !!item.hinted, timeMs: Date.now() - tShown });
  const before = run.nodeScore - res.points;

  document.querySelectorAll('.choice').forEach((el, i) => {
    el.classList.toggle('correct', !!item.q.choices[i].correct);
    if (i === idx && !res.correct) el.classList.add('wrong');
    el.disabled = true;
  });

  if (res.correct) {
    sfx(res.crit ? 'crit' : 'ok');
    if (app.profile.settings.autoSpeak && item.q.type !== 'listen') speak(item.entry.w, app.profile.settings.rate);
    const fx = document.createElement('div');
    fx.className = `points-fx ${res.crit ? 'crit' : ''}`;
    fx.innerHTML = `+${res.points}${res.crit ? '<span class="crit-label">再燃バースト!</span>' : ''}${res.breakdown && res.breakdown.burstM >= 2.2 ? `<span class="burst-detail">×${res.breakdown.burstM.toFixed(1)}</span>` : ''}`;
    $('.qa').appendChild(fx);
    if (res.crit) { $('#stage').classList.add('flash'); setTimeout(() => $('#stage')?.classList.remove('flash'), 350); }
    animateScore(before, run.nodeScore);
    updateRunHud();
    scheduleFeedback(() => { if (run === myRun) handleStep(run.advance()); }, res.crit ? 1100 : 850);
  } else {
    sfx('bad');
    if (res.phoenix) toast('🪶 不死鳥の羽がコンボを守った');
    else if (mikiri) toast('⚡ 見切り失敗 −15🔥');
    $('#stage').classList.add('shake');
    setTimeout(() => $('#stage')?.classList.remove('shake'), 400);
    updateRunHud();
    scheduleFeedback(() => {
      if (run === myRun) renderMissPanel(res, item.retry ? 'また取り逃した…' : 'この言霊は暴走した — ノード終盤に再来する');
    }, 500);
  }
}

function renderMissPanel(res, label) {
  if (!$('#stage') || !run) return; // 帰還後にタイマーが残っていた場合のガード
  phase = 'feedback';
  const e = res.entry;
  $('#stage').innerHTML = `
  <div class="miss-panel pop">
    <div class="miss-label">${esc(label)}</div>
    <div class="big-word">${esc(e.w)}</div>
    <div class="meta"><span class="pos">${POS_JA[e.p] || ''}</span></div>
    <div class="big-ja">${esc(e.j)}</div>
    ${e.ex ? `<div class="ex-box">${esc(e.ex)}<br><span class="jx">${esc(e.jx)}</span></div>` : ''}
    <button class="icon-btn big spk" data-act="speak">🔊</button>
    <button class="big-btn" data-act="next">心に刻んだ →</button>
  </div>`;
  stageRendered();
  $('#stage').onclick = (ev) => {
    if (!freshInput()) return; // 連打の貫通防止
    const a = ev.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'speak') speak(e.w, app.profile.settings.rate);
    if (a.dataset.act === 'next') handleStep(run.advance());
  };
  speak(e.w, app.profile.settings.rate);
}

function renderNodeCleared(step) {
  sfx('fanfare');
  phase = 'reward';
  $('#stage').innerHTML = `
  <div class="cleared pop">
    <div class="cleared-label">🔥 ノード突破!</div>
    <p class="sub">鍛冶具をひとつ選ぼう</p>
    <div class="rewards">
      ${step.rewards.map((t) => `
        <button class="reward-card" data-id="${t.id}">
          <div class="rw-icon">${t.icon}</div>
          <div class="rw-name">${esc(t.name)}</div>
          <div class="rw-desc">${esc(t.desc)}</div>
        </button>`).join('')}
    </div>
    <button class="text-btn" data-act="skip">受け取らない</button>
  </div>`;
  stageRendered();
  $('#stage').onclick = (e) => {
    if (!freshInput()) return;
    const card = e.target.closest('.reward-card');
    if (card) { sfx('flip'); handleStep(run.takeReward(card.dataset.id)); return; }
    if (e.target.closest('[data-act="skip"]')) handleStep(run.takeReward(null));
  };
}

function renderResult(r) {
  sfx(r.win ? 'fanfare' : 'lose');
  const p = app.profile;
  screen().innerHTML = `
  <div class="result ${r.win ? 'win' : 'lose'}">
    <div class="result-icon">${r.win ? '🏆' : '🕯️'}</div>
    <h2>${r.win ? '鍛冶完了!塔を制した' : `火が消えた… ノード${r.nodeReached + 1}で敗北`}</h2>
    ${!r.win ? `<p class="sub">あと <b>${Math.max(0, r.target - r.nodeScore)}</b> 燃料足りなかった</p>` : ''}
    <div class="result-stats">
      <div><b>${r.totalScore}</b><small>総燃料</small></div>
      <div><b>${r.reviews}</b><small>想起した言霊</small></div>
      <div><b>×${r.maxCombo}</b><small>最大コンボ</small></div>
      <div><b>🔥${p.streak.count}</b><small>連続日数</small></div>
    </div>
    ${r.rankUps.length ? `
    <div class="rankups">
      <h3>⬆️ 言霊が輝きを増した</h3>
      ${r.rankUps.slice(0, 6).map((u) => `<div class="rankup"><b>${esc(u.w)}</b> <span style="color:${RARITY[u.from].color}">${RARITY[u.from].name}</span> → <span style="color:${RARITY[u.to].color}">${RARITY[u.to].name}</span></div>`).join('')}
      ${r.rankUps.length > 6 ? `<div class="more">ほか${r.rankUps.length - 6}体</div>` : ''}
    </div>` : ''}
    ${r.topMisses.length ? `
    <div class="lessons">
      <h3>${r.win ? '🗡️ 手強かった言霊' : '🗡️ この言霊を鎮めれば突破できた'}</h3>
      ${r.topMisses.map((e) => `<button class="lesson spk-row" data-w="${esc(e.w)}"><b class="en">${esc(e.w)}</b><span>${esc(e.j)}</span>🔊</button>`).join('')}
    </div>` : ''}
    ${r.chest ? '<div class="chest-notice">📦 熟成宝箱を獲得 — <b>明日</b>開封できる</div>' : ''}
    <button class="big-btn" data-act="home">帰還する</button>
    <button class="text-btn" data-act="again">もう一度登る</button>
  </div>`;
  screen().onclick = (e) => {
    const s = e.target.closest('.spk-row');
    if (s) { speak(s.dataset.w, app.profile.settings.rate); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'home') goHome();
    if (a.dataset.act === 'again') startRun();
  };
}

// ---------- ジェスチャー ----------
function onPtrDown(e) {
  // 開始時点のフェーズと押し始めた選択肢を記録する。
  // 指が動いている間に自動リビール等で画面が変わった場合、ジェスチャーは無効(盲目回答の防止)。
  ptr = { x: e.clientX, y: e.clientY, phase, choiceEl: e.target.closest?.('.choice') || null };
}

function onPtrUp(e) {
  if (!ptr) return;
  const p0 = ptr;
  ptr = null;
  const dx = e.clientX - p0.x;
  const dy = e.clientY - p0.y;
  const dist = Math.hypot(dx, dy);

  // フィードバック中のタップは「次へ送る」(完全な無反応時間を作らない)
  if (phase === 'feedback') { skipFeedback(); return; }
  if (!freshInput()) return;          // 画面差し替え直後の入力は前画面へのタップ
  if (p0.phase !== phase) return;     // 押している間に画面が変わった→破棄

  if (phase === 'choices') {
    // 押し始めた選択肢があるならそれを回答にする(指が転がっても隣の選択肢に化けない)
    if (p0.choiceEl && p0.choiceEl.isConnected && !p0.choiceEl.disabled) {
      answer(Number(p0.choiceEl.dataset.i));
      return;
    }
    // 背景から始めたフリックのみ方向回答(誤爆防止に60px以上)
    if (dist >= 60) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const dir = horizontal ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0); // top,right,bottom,left
      answer(dir);
    }
    return;
  }

  if (phase === 'prompt') {
    if (dist < 30) {
      if (!e.target.closest('[data-act]')) revealChoices();
      return;
    }
    // 見切り/パスは縦に強くはっきりしたスワイプのみ(30pxの指滑りで即パスさせない)
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.5;
    if (vertical && dy < -60) doMikiri();
    else if (vertical && dy > 60) doPass();
  }
}

// ---------- 図鑑 ----------
function goCollection() {
  const p = app.profile;
  const now = Date.now();
  const entries = app.words
    .map((e) => ({ e, c: p.cards[e.w] }))
    .filter((x) => x.c && x.c.reps > 0)
    .map((x) => ({ ...x, r: rarityIndex(x.c), R: retrievability(x.c, now) }));
  const counts = [0, 0, 0, 0, 0];
  for (const x of entries) counts[x.r]++;

  const renderTab = (tab) => {
    const list = entries.filter((x) => tab === -1 || x.r === tab).sort((a, b) => a.R - b.R);
    return list.map((x) => `
      <button class="dex-chip ${isDue(x.c, now) ? 'due' : ''}" style="border-color:${RARITY[x.r].color}" data-w="${esc(x.e.w)}">
        ${esc(x.e.w)}
      </button>`).join('') || '<p class="empty">まだいない</p>';
  };

  screen().innerHTML = `
  <div class="dex">
    <header class="page-head"><button class="icon-btn" data-act="back">←</button><h2>📖 言霊図鑑</h2><span class="dex-total">${entries.length}/${app.words.length}</span></header>
    <div class="dex-tabs">
      <button class="dex-tab active" data-tab="-1">全て</button>
      ${RARITY.map((r, i) => `<button class="dex-tab" data-tab="${i}" style="color:${r.color}">${r.name}<b>${counts[i]}</b></button>`).join('')}
    </div>
    <div class="dex-grid" id="dexGrid">${renderTab(-1)}</div>
    <div class="dex-detail" id="dexDetail"></div>
  </div>`;
  screen().onclick = (ev) => {
    if (ev.target.closest('[data-act="back"]')) { goHome(); return; }
    const tab = ev.target.closest('.dex-tab');
    if (tab) {
      document.querySelectorAll('.dex-tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('#dexGrid').innerHTML = renderTab(Number(tab.dataset.tab));
      $('#dexDetail').innerHTML = '';
      return;
    }
    const chip = ev.target.closest('.dex-chip');
    if (chip) {
      const e = app.index.byKey.get(chip.dataset.w);
      const c = p.cards[e.w];
      const r = rarityIndex(c);
      const R = retrievability(c, now);
      const dueDays = Math.ceil((c.due - now) / DAY);
      $('#dexDetail').innerHTML = `
      <div class="word-card detail pop">
        <div class="wc-head"><b class="en">${esc(e.w)}</b><span class="pos">${POS_JA[e.p] || ''}</span>
          <button class="icon-btn spk" data-w="${esc(e.w)}">🔊</button></div>
        <div class="ja">${esc(e.j)}</div>
        ${e.ex ? `<div class="ex">${esc(e.ex)}<br><span class="jx">${esc(e.jx)}</span></div>` : ''}
        <div class="wc-meta">
          <span style="color:${RARITY[r].color}">${RARITY[r].name}</span>
          <span>輝き ${(R * 100).toFixed(0)}%</span>
          <span>${dueDays <= 0 ? '⚠️ 錆びかけ' : `あと${dueDays}日輝く`}</span>
          <span>想起${c.reps}回</span>
        </div>
      </div>`;
      speak(e.w, p.settings.rate);
      return;
    }
    const spk = ev.target.closest('.spk');
    if (spk) speak(spk.dataset.w, p.settings.rate);
  };
}

// ---------- 設定 ----------
function goSettings() {
  const s = app.profile.settings;
  screen().innerHTML = `
  <div class="settings">
    <header class="page-head"><button class="icon-btn" data-act="back">←</button><h2>⚙️ 設定</h2><span></span></header>

    <h3>レベル(新しく出会う言霊)</h3>
    <div class="chips" id="lvChips">
      ${[1, 2, 3, 4, 5].map((l) => `<button class="chip ${s.levels.includes(l) ? 'on' : ''}" data-lv="${l}">Lv${l} ${LEVEL_NAMES[l]}</button>`).join('')}
    </div>

    <h3>分野</h3>
    <div class="chips" id="fdChips">
      ${ALL_FIELDS.map((f) => `<button class="chip ${s.fields.includes(f) ? 'on' : ''}" data-fd="${f}">${FIELD_NAMES[f]}</button>`).join('')}
    </div>

    <h3>1日の新しい言霊</h3>
    <div class="chips" id="npChips">
      ${[4, 8, 12, 20].map((n) => `<button class="chip ${s.newPerDay === n ? 'on' : ''}" data-np="${n}">${n}体</button>`).join('')}
    </div>

    <h3>炉の温度(難易度)</h3>
    <div class="chips" id="dfChips">
      ${['微温', '適温', '灼熱'].map((d, i) => `<button class="chip ${s.difficulty === i ? 'on' : ''}" data-df="${i}">${d}</button>`).join('')}
    </div>

    <h3>音</h3>
    <div class="chips">
      <button class="chip ${s.listen ? 'on' : ''}" id="tgListen">リスニング問題 ${ttsAvailable() ? '' : '(端末非対応)'}</button>
      <button class="chip ${s.autoSpeak ? 'on' : ''}" id="tgSpeak">自動読み上げ</button>
    </div>
    <label class="slider-row">読み上げ速度 <input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="${s.rate}"><b id="rateVal">${s.rate}</b></label>

    <h3>データ</h3>
    <div class="chips">
      <button class="chip" id="exportBtn">エクスポート</button>
      <button class="chip" id="importBtn">インポート</button>
      <button class="chip danger" id="resetBtn">全リセット</button>
    </div>
    <p class="note">進捗はこの端末のブラウザに保存されます。機種変更前にエクスポートを。</p>
  </div>`;

  const save = () => app.save();
  screen().onclick = (ev) => {
    if (ev.target.closest('[data-act="back"]')) { goHome(); return; }
    const lv = ev.target.closest('[data-lv]');
    if (lv) {
      const l = Number(lv.dataset.lv);
      if (s.levels.includes(l)) {
        if (s.levels.length === 1) { toast('最低1つは必要'); return; }
        s.levels = s.levels.filter((x) => x !== l);
      } else s.levels = [...s.levels, l].sort();
      lv.classList.toggle('on'); save(); return;
    }
    const fd = ev.target.closest('[data-fd]');
    if (fd) {
      const f = fd.dataset.fd;
      if (s.fields.includes(f)) {
        if (s.fields.length === 1) { toast('最低1つは必要'); return; }
        s.fields = s.fields.filter((x) => x !== f);
      } else s.fields.push(f);
      fd.classList.toggle('on'); save(); return;
    }
    const np = ev.target.closest('[data-np]');
    if (np) {
      s.newPerDay = Number(np.dataset.np);
      document.querySelectorAll('[data-np]').forEach((c) => c.classList.toggle('on', c === np));
      save(); return;
    }
    const df = ev.target.closest('[data-df]');
    if (df) {
      s.difficulty = Number(df.dataset.df);
      document.querySelectorAll('[data-df]').forEach((c) => c.classList.toggle('on', c === df));
      save(); return;
    }
    if (ev.target.closest('#tgListen')) { s.listen = !s.listen; ev.target.closest('#tgListen').classList.toggle('on'); save(); return; }
    if (ev.target.closest('#tgSpeak')) { s.autoSpeak = !s.autoSpeak; ev.target.closest('#tgSpeak').classList.toggle('on'); save(); return; }
    if (ev.target.closest('#exportBtn')) {
      const data = JSON.stringify(app.profile);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(data).then(() => toast('クリップボードにコピーした')).catch(() => prompt('コピーしてください', data));
      } else prompt('コピーしてください', data);
      return;
    }
    if (ev.target.closest('#importBtn')) {
      const raw = prompt('エクスポートしたデータを貼り付け:');
      if (!raw) return;
      try {
        const obj = JSON.parse(raw);
        if (!obj.cards) throw new Error('bad');
        saveProfile(obj);
        location.reload();
      } catch { toast('読み込めなかった'); }
      return;
    }
    if (ev.target.closest('#resetBtn')) {
      if (confirm('本当に全データを消す?言霊の記憶も消える')) {
        saveProfile(defaultProfile());
        location.reload();
      }
    }
  };
  $('#rate').oninput = (ev) => {
    s.rate = Number(ev.target.value);
    $('#rateVal').textContent = s.rate.toFixed(2);
    save();
  };
}
