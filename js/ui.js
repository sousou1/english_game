// v3 UI: ノースクロールの単一画面RPG。
// 構成(縦): ステータス44 / ステージ(可変) / コンボ・ラッシュ帯44 / お題64 / 詠唱プール / メニュー56
// 規則: 偽タイマー禁止・16ms応答・描画後300msガード・全画面割込み禁止(プレイヤー起点のシートは可)
// SRS想起は「焚き火」(100%オーバーレイ)に物理隔離 — 同じ画面に敵がいない。
import { rarityIndex, retrievability, RARITY } from './srs.js';
import { POS_JA } from './quiz.js';
import { Workshop } from './workshop.js';
import { Pool, CURVE } from './pool.js';
import { Battle, BATTLE, enemyHp, isMidBoss, isChapterBoss, hpMax, levelOf, bossAtk } from './battle.js';
import { ARMORY } from '../data/weapons.js';
import { dropRoll, pushBox, openDrop, enhance, enhanceCost, salvage, equipped, equippedEffects, weaponDef, weaponMult } from './armory.js';
import { JOBS, currentJob, jobUnlocked } from './jobs.js';
import { letterAvailable, readLetter, consumeLetterBuff, COMPANIONS } from './party.js';
import { TIER_NAMES, FACILITIES, facilityPrice } from './economy.js';
import { SHOP_REVEAL, fireMilestones, maybeEvent, line, lineVar } from './story.js';
import { sfx, speak, initAudio, ttsAvailable, comboTone } from './audio.js';
import { saveProfile, defaultProfile, todayKey, FIELD_NAMES, LEVEL_NAMES, ALL_FIELDS, dayStat } from './storage.js';
import { SCENARIO, sceneById } from './scenario.js';

let app = null;
let ws = null;
let pool = null;
let battle = null;
let saveTimer = 0;
let rushEarned = 0;
let sheetKind = null;
let takibiState = null; // {queue, card:{mode,r}} 焚き火(修行)の状態
let renderedAt = { pool: 0, takibi: 0, sheet: 0 };
let tickerTimer = 0;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fresh = (k) => performance.now() - renderedAt[k] > 300;

function fmtBig(n) {
  if (n < 10000) return Math.floor(n).toLocaleString('ja-JP');
  if (n < 1e8) return `${(n / 1e4).toFixed(n < 1e6 ? 1 : 0)}万`;
  if (n < 1e12) return `${(n / 1e8).toFixed(n < 1e10 ? 1 : 0)}億`;
  if (n < 1e16) return `${(n / 1e12).toFixed(1)}兆`;
  return `${(n / 1e16).toFixed(1)}京`;
}
function hhmm(ts) { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function lazySave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => app.save(), 400); }

// ---------- ティッカー(ログ1行+履歴) ----------
function ticker(text, cls = '') {
  if (!text) return;
  const p = app.profile;
  p.story.log = p.story.log || [];
  p.story.log.push({ t: Date.now(), x: text });
  if (p.story.log.length > 60) p.story.log.splice(0, p.story.log.length - 60);
  const el = $('#ticker');
  if (el) {
    el.innerHTML = `<span class="${cls}">${esc(text)}</span>`;
    el.classList.remove('tick-in');
    void el.offsetWidth;
    el.classList.add('tick-in');
  }
  lazySave();
}

function checkMilestones(vars = {}) {
  if (!vars.word) {
    const grads = Object.keys(app.profile.cards);
    if (grads.length) vars.word = grads[Math.floor(Math.random() * grads.length)];
  }
  for (const t of fireMilestones(app.profile, ws, vars)) ticker(t, 'gold');
}

// ---------- 起動 ----------
export function initUI(appRef) {
  app = appRef;
  ws = new Workshop(app);
  pool = new Pool(app);
  battle = new Battle(app);
  document.body.addEventListener('pointerdown', () => initAudio());

  $('#screen').innerHTML = `
    <div id="stat" class="stat">
      <span id="stLv">Lv1</span>
      <span id="stHp">❤100</span>
      <span id="stAtk">⚔0</span>
      <span id="stMana">✨0<small id="stRate"></small></span>
      <span id="stGold">💰0</span>
    </div>
    <div id="stage" class="stage">
      <div class="stage-top"><span id="placeLbl"></span><span id="bossTimerWrap" class="hidden">⏳<b id="bossTimer"></b></span></div>
      <div id="enemyWrap" class="enemy-wrap">
        <div id="enemy" class="enemy">🐀</div>
      </div>
      <div class="ehp-wrap"><div class="ehp"><div id="ehpFill" class="ehp-fill"></div></div><span id="ehpPct">100%</span></div>
      <div id="bossPanel" class="boss-panel hidden">
        <span class="php-label">❤</span><div class="php"><div id="phpFill" class="php-fill"></div></div><span id="phpNum"></span>
        <button id="retreatBtn" class="mini-act">🏳 退く</button>
      </div>
      <button id="engageBtn" class="engage hidden">⚔ とどめの間合いに踏み込む</button>
      <div id="ticker" class="ticker" ></div>
    </div>
    <div id="band" class="band">
      <span id="combo" class="combo"></span>
      <div class="gauge"><div id="gaugeFill" class="gauge-fill"></div></div>
      <span id="gaugeNum" class="gauge-num">0/25</span>
      <button id="igniteBtn" class="ignite hidden">⚡解放</button>
    </div>
    <div id="cueBar" class="cue-bar">
      <div id="cue" class="cue"></div>
      <div id="freshBar" class="fresh-bar"><div id="freshFill"></div></div>
    </div>
    <div id="poolGrid" class="pool-grid"></div>
    <div id="menu" class="menu">
      <button data-sheet="story">📜<small>物語</small></button>
      <button data-sheet="weapons">⚔<small>武器屋</small><b id="bWeap" class="badge hidden">!</b></button>
      <button data-sheet="base">🏘<small>拠点</small></button>
      <button data-sheet="spellbook">📖<small>呪文書</small></button>
      <button data-sheet="takibi">🔔<small>修行</small><b id="bTrain" class="badge hidden"></b></button>
      <button data-sheet="settings">⚙<small>設定</small></button>
    </div>
    <div id="sheetScrim" class="scrim hidden"></div>
    <div id="sheet" class="sheet hidden"><div class="grabber"></div><div id="sheetBody" class="sheet-body"></div></div>
    <div id="takibi" class="takibi hidden"><div id="takibiBody"></div></div>
    <div id="fx" class="fx"></div>
    <div id="intro" class="intro hidden"></div>
  `;

  $('#menu').onclick = (e) => {
    const b = e.target.closest('[data-sheet]');
    if (!b) return;
    if (b.dataset.sheet === 'takibi') openTakibi();
    else openSheet(b.dataset.sheet);
  };
  $('#sheetScrim').onclick = closeSheet;
  $('#sheet').onclick = (e) => { if (e.target.closest('.grabber')) closeSheet(); };
  $('#poolGrid').onclick = (e) => {
    const t = e.target.closest('[data-tap]');
    if (t && fresh('pool')) poolTap(t.dataset.tap, t);
  };
  $('#igniteBtn').onclick = () => {
    if (pool.ignite()) {
      sfx('kyuin');
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      rushEarned = 0;
      document.body.classList.add('rush');
      renderBand();
    }
  };
  $('#engageBtn').onclick = () => {
    const fx = equippedEffects(app.profile);
    const hpBonus = consumeLetterBuff(app.profile);
    if (hpBonus > 0) ticker('💌 ノノの手紙が、胸の中であたたかい。(HP+15%)', 'gold');
    if (battle.engageBoss({ dmgReduce: fx.bossGuard, hpBonus })) {
      sfx('zawa');
      ticker('魔物の眼が、こちらを向いた。');
      renderStage();
    }
  };
  $('#retreatBtn').onclick = () => {
    battle.retreat();
    sfx('land');
    ticker('無理は禁物だ。体勢を立て直そう。(魔素もゴールドもそのまま)');
    renderStage();
  };

  const p = app.profile;
  if (p.story.intro < 99) startIntro();
  else boot();
  startLoops();
}

function boot() {
  const p = app.profile;
  if (!p.facilities.fire) { p.facilities.fire = 1; } // v3: 火は物語の冒頭で灯る
  const ret = ws.settleReturn();
  if (ret.away > 90 * 1000 && ret.gained > 0) ticker(lineVar('settle_return', { n: fmtBig(ret.gained) }));
  if (ws.canOpenChest()) ticker(line('chest_wait'), 'gold');
  if (letterAvailable(p)) ticker('💌 ノノから手紙が届いている。(物語シートで読める)', 'gold');
  pool.refill();
  renderAll();
  const sc = p.scenario;
  if (!sc.scene && !sc.read['c01_010']) { sc.scene = SCENARIO.start; openSheet('story'); }
}

// ---------- 導入 ----------
function startIntro() {
  const p = app.profile;
  const intro = $('#intro');
  intro.classList.remove('hidden');
  const render = () => {
    const k = p.story.intro;
    intro.innerHTML = `
      <div class="mist" style="opacity:${Math.max(0.15, 1 - k * 0.11)}"></div>
      ${k === 0 ? `<p class="intro-line">${esc(SCENARIO.introLines[0])}</p>` : ''}
      ${k >= 3 && k < 6 ? `<p class="intro-line dim">${esc(SCENARIO.introLines[1])}</p>` : ''}
      ${k >= 6 ? `<div class="ember"></div><p class="intro-line">${esc(SCENARIO.introLines[2])}</p><button class="primary-btn" id="introGo">ことばを、おもいだす</button>` : ''}
      ${k < 6 ? '<p class="intro-hint">タップで靄(もや)を払う</p>' : ''}
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
      app.save();
      boot();
      openTakibi(); // 最初の3語をおもいだす
    }
  };
}

// ---------- 演出 ----------
function spark(x, y, big = false) {
  const s = document.createElement('div');
  s.className = `spark ${big ? 'big' : ''}`;
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  $('#fx').appendChild(s);
  setTimeout(() => s.remove(), 700);
}

function dmgPop(text, crit = false) {
  const d = document.createElement('div');
  d.className = `dmg-pop ${crit ? 'crit' : ''}`;
  d.textContent = text;
  const e = $('#enemyWrap').getBoundingClientRect();
  d.style.left = `${e.x + e.width / 2 + (Math.random() * 60 - 30)}px`;
  d.style.top = `${e.y + 20}px`;
  $('#fx').appendChild(d);
  setTimeout(() => d.remove(), 800);
}

function goldRain(amount) {
  const n = Math.min(24, Math.max(4, Math.round(Math.log2(amount + 1) * 2)));
  const target = $('#stGold').getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin';
    c.style.left = `${100 + Math.random() * 190}px`;
    c.style.top = `${140 + Math.random() * 120}px`;
    c.style.setProperty('--tx', `${target.x + 20 - (100 + Math.random() * 190)}px`);
    c.style.setProperty('--ty', `${target.y - (140 + Math.random() * 120)}px`);
    c.style.animationDelay = `${i * 28}ms`;
    $('#fx').appendChild(c);
    setTimeout(() => c.remove(), 900 + i * 28);
  }
}

function cutin(word, ja) {
  const d = document.createElement('div');
  d.className = 'cutin';
  d.innerHTML = `<b>${esc(word)}</b><span>${esc(ja)}</span>`;
  $('#fx').appendChild(d);
  setTimeout(() => d.remove(), 700);
}

// ---------- 全体描画 ----------
function renderAll() {
  renderStat();
  renderStage();
  renderBand();
  renderPool();
  renderMenuBadges();
}

function chapterOf(kills) {
  let c = 1;
  for (const b of BATTLE.chapterBosses) if (kills >= b) c++;
  return c;
}

function renderStat() {
  const p = app.profile;
  const lv = levelOf(p.exp);
  battle.app.battleLevel = lv.level;
  pool.app.battleLevel = lv.level;
  $('#stLv').textContent = `${currentJob(p).icon}Lv${lv.level}`;
  const maxHp = hpMax(lv.level);
  const curHp = p.boss.engaged ? Math.max(0, p.boss.hp) : maxHp;
  $('#stHp').textContent = `❤${curHp}/${maxHp}`;
  $('#stHp').classList.toggle('danger', curHp / maxHp < 0.35);
  $('#stAtk').textContent = `⚔${fmtBig(Math.max(1, p.vref))}`;
  $('#stGold').textContent = `💰${fmtBig(p.gold)}`;
}

const ENEMIES = [
  ['🐀', '🦇', '🕷', '👺'],          // 章1: 村周辺
  ['🐍', '🃏', '🗡', '👤'],          // 章2: 都の路地
  ['🐺', '🦂', '👻', '🧟'],          // 章3
  ['🦅', '🧛', '💀', '🌑'],          // 章4
  ['🐉', '😈', '🌪', '🔥'],          // 章5+
];
const MIDBOSS = ['🦌', '🐊', '🦁', '🦑', '🐲'];
const CHBOSS = ['🐉', '🗿', '🧊', '😈'];

function enemyEmoji(k) {
  const ch = chapterOf(k) - 1;
  if (isChapterBoss(k)) return CHBOSS[Math.min(ch, CHBOSS.length - 1)];
  if (isMidBoss(k)) return MIDBOSS[Math.min(ch, MIDBOSS.length - 1)];
  const set = ENEMIES[Math.min(ch, ENEMIES.length - 1)];
  return set[k % set.length];
}

function renderStage() {
  const p = app.profile;
  const k = p.battle.kills;
  const boss = battle.isBossNow();
  const ch = chapterOf(k);
  $('#placeLbl').textContent = `${SCENARIO.places[Math.min(ch - 1, SCENARIO.places.length - 1)]}・${k + 1}体目${boss ? (isChapterBoss(k) ? '【章ボス】' : '【ボス】') : ''}`;
  const en = $('#enemy');
  en.textContent = enemyEmoji(k);
  en.classList.toggle('boss', boss);

  // 敵HP
  const total = enemyHp(k);
  let remain;
  if (boss && p.boss.engaged) remain = Math.max(0, p.boss.bodyHp);
  else if (boss) remain = Math.max(0, Math.round(total * BATTLE.barrierShare) - p.battle.dmg) + Math.round(total * (1 - BATTLE.barrierShare));
  else remain = Math.max(0, total - p.battle.dmg);
  const pct = Math.max(0, Math.min(100, (remain / total) * 100));
  $('#ehpFill').style.width = `${pct}%`;
  $('#ehpPct').textContent = `${Math.ceil(pct)}%`;
  $('#ehpFill').classList.toggle('low', pct < 25);

  // 討伐チャンス
  const barrierDown = boss && !p.boss.engaged && p.battle.dmg >= battle.barrierMax();
  $('#engageBtn').classList.toggle('hidden', !barrierDown);
  $('#bossPanel').classList.toggle('hidden', !p.boss.engaged);
  $('#bossTimerWrap').classList.toggle('hidden', !p.boss.engaged);
  if (p.boss.engaged) {
    const max = hpMax(levelOf(p.exp).level);
    $('#phpFill').style.width = `${Math.max(0, (p.boss.hp / max) * 100)}%`;
    const atk = Math.round(bossAtk(battle.bossNumber()) * (1 - (p.boss.dmgReduce || 0)));
    const hits = Math.max(0, Math.ceil(p.boss.hp / Math.max(1, atk)));
    $('#phpNum').textContent = `${Math.max(0, p.boss.hp)}/${max} あと${hits}発`;
  }
}

function renderBand() {
  const now = Date.now();
  $('#combo').textContent = pool.combo >= 2 ? `🔥×${pool.comboMult().toFixed(2)}` : '';
  const g = $('#gaugeFill');
  if (pool.rushActive(now)) {
    $('#gaugeNum').textContent = `×${pool.rushMult().toFixed(2)}`;
    $('#igniteBtn').classList.add('hidden');
  } else {
    g.style.width = `${(pool.g / CURVE.fever.gaugeMax) * 100}%`;
    $('#gaugeNum').textContent = pool.afterglow(now) ? `余韻 ${pool.g}/25` : `${pool.g}/25`;
    $('#igniteBtn').classList.toggle('hidden', pool.mode !== 'ready');
  }
  // 段階発光(先読み予告: 実コンボ数に正直対応)
  const band = $('#band');
  band.className = 'band' + (pool.combo >= 20 ? ' t3' : pool.combo >= 15 ? ' t2' : pool.combo >= 10 ? ' t1' : '');
}

function renderPool() {
  const p = app.profile;
  renderedAt.pool = performance.now();
  if (!pool.cue) pool.refill();
  const cueEl = $('#cue');
  const grid = $('#poolGrid');
  if (!pool.cue) {
    cueEl.innerHTML = '<small>ことばを覚えると、ここで詠唱できる</small>';
    grid.innerHTML = '';
    return;
  }
  cueEl.innerHTML = `<small>唱えよ —</small><b>${esc(pool.cue.j)}</b>`;
  grid.innerHTML = pool.tiles.map((e) => {
    const taps = p.taps[e.w] || 0;
    let stars = 0;
    for (const m of CURVE.milestones) if (taps >= m) stars++;
    return `<button class="tile" data-tap="${esc(e.w)}">${esc(e.w)}<small>${'★'.repeat(Math.min(4, stars))}</small></button>`;
  }).join('');
}

function renderMenuBadges() {
  const n = ws.drowsyCount() + ws.introQueue().length;
  const bt = $('#bTrain');
  bt.classList.toggle('hidden', n === 0);
  bt.textContent = n;
  const bw = $('#bWeap');
  const boxN = app.profile.armory.box.length;
  bw.classList.toggle('hidden', boxN === 0);
  bw.textContent = boxN;
}

// ---------- 詠唱(タップ) ----------
function poolTap(w, tileEl) {
  const p = app.profile;
  const res = pool.tap(w);
  if (!res) return;
  if (!res.correct) {
    sfx('bad');
    if (res.guarded) ticker('短剣が手元の乱れを受け流した。(コンボ維持)');
    tileEl.classList.add('shake');
    tileEl.disabled = true;
    setTimeout(() => { tileEl.classList.remove('shake'); tileEl.disabled = false; }, 400);
    renderBand();
    return;
  }
  // 収入(攻撃=収入)。開発者モードは進行倍率(vrefは正直なまま)
  const devGain = res.gain * (p.dev?.mult || 1);
  p.lights += devGain;
  p.totalLights += devGain;
  if (pool.rushActive()) rushEarned += devGain;

  comboTone(pool.combo);
  if (navigator.vibrate) navigator.vibrate(res.crit ? 25 : 5);
  const r = tileEl.getBoundingClientRect();
  spark(r.x + r.width / 2, r.y + 10, res.crit);
  dmgPop(`-${fmtBig(devGain)}`, res.crit);
  if (res.crit) { cutin(pool.tiles.find(() => true) ? w : w, ''); sfx('crit'); }
  const en = $('#enemy');
  en.classList.remove('hitfx');
  void en.offsetWidth;
  en.classList.add('hitfx');

  if (res.gaugeReady) { sfx('reach'); ticker('力が満ちた——⚡解放できる!', 'gold'); }
  if (res.milestone) ticker(line('milestone_word', { word: w }));

  // バトル適用
  const br = battle.applyDamage(devGain);
  if (br.levelUp) {
    sfx('fanfare');
    ticker(`レベルアップ! Lv${br.levelUp} — 体が軽い。`, 'gold');
  }
  if (br.barrierBroken) {
    sfx('reach');
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    document.body.classList.add('reach-dark');
    setTimeout(() => document.body.classList.remove('reach-dark'), 1500);
    ticker('結界が砕けた——奴の素顔が見える。', 'gold');
  }
  if (br.kill) onKill(br);

  renderStat();
  renderStage();
  renderBand();
  renderPool();
  lazySave();
}

function onKill(br) {
  const p = app.profile;
  sfx('open');
  sfx('payout');
  // 装備のゴールドボーナス
  const fx = equippedEffects(p);
  const bonus = Math.round(br.gold * (fx.goldGain || 0));
  if (bonus > 0) p.gold += bonus;
  goldRain(br.gold + bonus);
  if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  const name = br.chapterBoss ? '強大な魔物' : br.midBoss ? '森の主クラスの魔物' : '魔物';
  ticker(`${name}を討伐! 💰${fmtBig(br.gold + bonus)} を手に入れた。`, 'gold');
  // 武器ドロップ(ハクスラ): 雑魚30% / 中ボス確定 / 章ボス2個
  const kind = br.chapterBoss ? 'chapter' : br.midBoss ? 'mid' : 'mob';
  const rolls = kind === 'chapter' ? [dropRoll(p, 'chapter', 0), dropRoll(p, 'chapter', 1)] : [dropRoll(p, kind)];
  for (const roll of rolls) {
    if (!roll) continue;
    pushBox(p, roll);
    const rc = ARMORY.rarities[roll.rar];
    sfx(roll.rar === 'SSR' ? 'kyuin' : roll.rar === 'SR' ? 'reach' : 'flip');
    if (rc.pillar) {
      const en = $('#enemyWrap');
      const pillar = document.createElement('div');
      pillar.className = `pillar ${rc.pillar}`;
      en.appendChild(pillar);
      setTimeout(() => pillar.remove(), 1600);
    }
    ticker(`✦ 武器がドロップ! ${roll.rar === 'SSR' ? '【金色の光柱…!】' : roll.rar === 'SR' ? '【紫の光柱】' : ''} 武器庫の回収箱へ`, roll.rar === 'N' ? '' : 'gold');
  }
  if (br.chapterBoss) {
    const ch = chapterOf(p.battle.kills);
    p.scenario.chapter = ch;
    ticker(`【第${ch}章】 への道がひらいた。物語を読もう。`, 'gold');
  }
  // シナリオ解放チェック(討伐数ゲート)
  scenarioGateCheck();
  checkMilestones();
  renderMenuBadges();
}

// ---------- シナリオ ----------
function settledCount() {
  return Object.values(app.profile.cards).filter((c) => c.reps > 0 && c.S >= 3).length;
}

function sceneCost(scene) {
  if (!scene.costW) return 0;
  return Math.round(scene.costW * enemyHp(app.profile.battle.kills));
}

function applyFlag(flagStr) {
  if (!flagStr) return;
  const m = flagStr.match(/^(\w+)\+(\d+)$/);
  const sc = app.profile.scenario;
  if (m) sc.flags[m[1]] = (sc.flags[m[1]] || 0) + Number(m[2]);
  else sc.flags[flagStr] = true;
}

function canPassGate(gate) {
  if (!gate) return true;
  if (gate.settled && settledCount() < gate.settled) return false;
  if (gate.kills && app.profile.battle.kills < gate.kills) return false;
  return true;
}

function scenarioGateCheck() {
  const sc = app.profile.scenario;
  if (sc.scene) return;
  const next = SCENARIO.scenes.find((s) => !sc.read[s.id]);
  if (next && canPassGate(next.gate)) ticker('📜 物語の続きが読める。', 'gold');
}

function nextScene() {
  const sc = app.profile.scenario;
  if (sc.scene) return sceneById(sc.scene);
  return SCENARIO.scenes.find((s) => !sc.read[s.id]) || null;
}

function renderStorySheet() {
  const p = app.profile;
  const sc = p.scenario;
  const scene = nextScene();
  const body = $('#sheetBody');
  if (!scene || (scene.gate && !canPassGate(scene.gate))) {
    const hint = scene && scene.gate && scene.gate.settled
      ? `続きの旅支度: 言霊を${scene.gate.settled}体、青銅の絆(S≥3)に。いま${settledCount()}体——焚き火の修行で根づかせよう。`
      : '続きはこれから書かれる——。';
    const letter = letterAvailable(p);
    body.innerHTML = `<h3>📜 物語</h3>
      <p class="story-done">${esc(SCENARIO.title)}</p>
      ${letter ? '<button class="buy-row" data-act="letter"><div><b>💌 ノノからの手紙</b><small>読むと今日はじめてのボス戦でHP+15%</small></div></button>' : ''}
      <p class="story-hint">${esc(hint)}</p>
      <div class="story-read">${SCENARIO.scenes.filter((s) => sc.read[s.id]).map((s) => `<button class="read-row" data-reread="${s.id}">${esc(s.title)}</button>`).join('')}</div>`;
    body.onclick = (e) => {
      if (!fresh('sheet')) return;
      if (e.target.closest('[data-act="letter"]')) {
        const txt = readLetter(p);
        if (txt) { sfx('flip'); ticker(txt, 'gold'); app.save(); renderStorySheet(); }
        return;
      }
      const r = e.target.closest('[data-reread]');
      if (r) renderScene(sceneById(r.dataset.reread), true);
    };
    renderedAt.sheet = performance.now();
    return;
  }
  renderScene(scene, false);
}

function renderScene(scene, reread) {
  const p = app.profile;
  const sc = p.scenario;
  const cost = reread ? 0 : (sc.read[scene.id] ? 0 : sceneCost(scene));
  const body = $('#sheetBody');
  const canAfford = p.gold >= cost;
  const letter = !reread && letterAvailable(p);
  body.innerHTML = `
    <h3>📜 ${esc(scene.title)}</h3>
    ${letter ? '<button class="buy-row" data-act="letter"><div><b>💌 ノノからの手紙</b><small>読むと今日はじめてのボス戦でHP+15%</small></div></button>' : ''}
    <div class="scene">${scene.lines.map((l) => `<p class="scene-line">${esc(l)}</p>`).join('')}</div>
    ${scene.choice && !reread ? `
      <div class="choices">
        <p class="choice-prompt">${esc(scene.choice.prompt)}</p>
        ${scene.choice.options.map((o, i) => `<button class="choice-btn" data-choice="${i}">${esc(o.text)}</button>`).join('')}
      </div>` : `
      <button class="primary-btn" data-act="story-next" ${!reread && !canAfford ? 'disabled' : ''}>
        ${reread ? 'とじる' : cost > 0 ? (canAfford ? `つづける(💰${fmtBig(cost)})` : `💰${fmtBig(cost)} 必要 — 魔物を倒そう`) : 'つづける'}
      </button>`}
  `;
  body.onclick = (e) => {
    if (!fresh('sheet')) return;
    if (e.target.closest('[data-act="letter"]')) {
      const txt = readLetter(p);
      if (txt) { sfx('flip'); ticker(txt, 'gold'); app.save(); renderScene(scene, reread); }
      return;
    }
    const c = e.target.closest('[data-choice]');
    if (c && scene.choice) {
      const opt = scene.choice.options[Number(c.dataset.choice)];
      applyFlag(opt.flag);
      sc.read[scene.id] = 1;
      sc.scene = (opt.next || scene.next) === 'end' ? null : (opt.next || scene.next);
      app.save();
      renderStorySheet();
      return;
    }
    const a = e.target.closest('[data-act="story-next"]');
    if (a) {
      if (reread) { renderStorySheet(); return; }
      if (cost > 0) { p.gold -= cost; renderStat(); }
      sc.read[scene.id] = 1;
      sc.scene = scene.next === 'end' ? null : scene.next;
      app.save();
      renderStorySheet();
    }
  };
  renderedAt.sheet = performance.now();
}

// ---------- シート ----------
function openSheet(kind) {
  sheetKind = kind;
  $('#sheetScrim').classList.remove('hidden');
  $('#sheet').classList.remove('hidden');
  renderedAt.sheet = performance.now();
  if (kind === 'story') renderStorySheet();
  if (kind === 'weapons') renderWeaponsSheet();
  if (kind === 'base') renderBaseSheet();
  if (kind === 'spellbook') renderSpellbookSheet();
  if (kind === 'settings') renderSettingsSheet();
}

function closeSheet() {
  sheetKind = null;
  $('#sheetScrim').classList.add('hidden');
  $('#sheet').classList.add('hidden');
  renderAll();
}

let weaponsTab = 'arms';
function renderWeaponsSheet() {
  const p = app.profile;
  const body = $('#sheetBody');
  const tabs = `<div class="chips" style="margin-bottom:10px">
    <button class="chip ${weaponsTab === 'arms' ? 'on' : ''}" data-tab="arms">⚔ 武器庫</button>
    <button class="chip ${weaponsTab === 'jobs' ? 'on' : ''}" data-tab="jobs">🎭 ジョブ</button>
  </div>`;

  if (weaponsTab === 'jobs') {
    const settled = settledCount();
    body.innerHTML = `<h3>🎭 詠唱の型 <small>${currentJob(p).icon}${currentJob(p).name}</small></h3>${tabs}
      ${JOBS.map((j) => {
        const ok = jobUnlocked(p, j, settled);
        const need = j.unlock.type === 'kills' ? `討伐${j.unlock.n}体で解禁(いま${p.battle.kills})` : j.unlock.type === 'words' ? `定着語${j.unlock.n}で解禁(いま${settled})` : '';
        return `<button class="weapon-row ${p.job === j.id ? 'on' : ''} ${ok ? '' : 'poor'}" data-job="${j.id}" ${ok ? '' : 'disabled'}>
          <span>${j.icon} ${esc(j.name)}</span><small>${esc(j.desc)}</small>
          ${p.job === j.id ? '<b>この型で詠唱中</b>' : ok ? '' : `<small>${esc(need)}</small>`}
        </button>`;
      }).join('')}
      <p class="story-hint">型はいつでも無料で変えられる(ボス戦中はだめ)。火力の主役はあくまで語彙——型は「手癖」を変える。</p>`;
    body.onclick = (e) => {
      if (!fresh('sheet')) return;
      const t = e.target.closest('[data-tab]');
      if (t) { weaponsTab = t.dataset.tab; renderWeaponsSheet(); renderedAt.sheet = performance.now(); return; }
      const j = e.target.closest('[data-job]');
      if (j && !p.boss.engaged) {
        p.job = j.dataset.job;
        sfx('promote');
        ticker(`${currentJob(p).icon} ${currentJob(p).name}の型に切りかえた。`, 'gold');
        app.save();
        renderWeaponsSheet();
        renderedAt.sheet = performance.now();
        renderStat();
      }
    };
    return;
  }

  // 武器庫タブ
  const eq = equipped(p);
  const boxHtml = p.armory.box.map((b) => {
    const rc = ARMORY.rarities[b.rar];
    return `<button class="buy-row" data-open="${b.uid}" style="border-color:${rc.color}">
      <div><b style="color:${rc.color}">? ? ?</b><small>ふれると正体がわかる(${b.rar})</small></div>
      <span style="color:${rc.color}">✦</span>
    </button>`;
  }).join('');
  const invHtml = [...p.armory.inv].sort((a, b) => (b.uid === p.armory.equip) - (a.uid === p.armory.equip)).map((w) => {
    const def = weaponDef(w.wid);
    const rc = ARMORY.rarities[w.rar];
    const isEq = w.uid === p.armory.equip;
    const subs = (w.subs || []).map((sb) => {
      const m = ARMORY.substats.find((x) => x.id === sb.id);
      const v = sb.rolls.reduce((a2, r) => a2 + m.max * r, 0);
      const txt = m.fmt.includes('%') ? `${m.fmt.startsWith('-') ? '−' : '+'}${(v * 100).toFixed(1)}%` : `${m.fmt.startsWith('-') ? '−' : '+'}${v.toFixed(1)}秒`;
      return `${m.name}${txt}`;
    }).join(' / ');
    const cost = enhanceCost(p, w);
    return `<div class="weapon-row ${isEq ? 'on' : ''}" style="border-left:3px solid ${rc.color}">
      <span>${def.icon} <b style="color:${rc.color}">${esc(def.name)}</b> <small>${w.rar} G${w.grade} Lv${w.lv}</small> ${isEq ? '<b>装備中</b>' : ''}</span>
      <small>攻撃×${weaponMult(w).toFixed(2)}${def.traitDesc ? ` ・ ${esc(def.traitDesc)}` : ''}</small>
      ${subs ? `<small class="subs">${esc(subs)}</small>` : ''}
      <span class="row-acts">
        ${isEq ? '' : `<button class="mini-act warm" data-equip="${w.uid}">装備</button>`}
        ${w.lv < ARMORY.enhance.maxLv ? `<button class="mini-act" data-enh="${w.uid}" ${p.gold >= cost ? '' : 'disabled'}>強化 💰${fmtBig(cost)}</button>` : '<small>Lv MAX</small>'}
        ${isEq ? '' : `<button class="mini-act" data-salv="${w.uid}">分解</button>`}
      </span>
    </div>`;
  }).join('');
  body.innerHTML = `<h3>⚔ 武器庫 <small>💰${fmtBig(p.gold)} ・ 砥石${p.armory.whet || 0} ・ 図鑑${p.armory.codex.length}</small></h3>${tabs}
    ${p.armory.box.length ? `<h4>回収箱(タップで開封)</h4>${boxHtml}` : ''}
    <h4>持ちもの(${p.armory.inv.length}/${ARMORY.inventory.cap})— 4Lvごとにランダム強化がつく</h4>
    ${invHtml}
    <p class="story-hint">天井: SSRが出ないままドロップ${ARMORY.dropTable.pity}回で次は確定SSR(いま${p.armory.pity || 0}回)。分解しても図鑑ボーナス+1%は残る。</p>`;
  body.onclick = (e) => {
    if (!fresh('sheet')) return;
    const t = e.target.closest('[data-tab]');
    if (t) { weaponsTab = t.dataset.tab; renderWeaponsSheet(); renderedAt.sheet = performance.now(); return; }
    const op = e.target.closest('[data-open]');
    if (op) {
      const r = openDrop(p, op.dataset.open);
      if (r) {
        const rc = ARMORY.rarities[r.item.rar];
        const def = weaponDef(r.item.wid);
        sfx(r.item.rar === 'SSR' ? 'kyuin' : 'open');
        if (navigator.vibrate) navigator.vibrate(r.item.rar === 'SSR' ? [30, 40, 80] : 15);
        ticker(`${def.icon}『${def.name}』(${r.item.rar})を手に入れた!${r.isNew ? ' 図鑑+1%(永続)' : ''}`, 'gold');
        app.save();
        renderWeaponsSheet();
        renderedAt.sheet = performance.now();
        renderMenuBadges();
      }
      return;
    }
    const eqb = e.target.closest('[data-equip]');
    if (eqb) { p.armory.equip = eqb.dataset.equip; sfx('flip'); app.save(); renderWeaponsSheet(); renderedAt.sheet = performance.now(); renderStat(); return; }
    const en = e.target.closest('[data-enh]');
    if (en) {
      const r = enhance(p, en.dataset.enh);
      if (r) {
        sfx(r.sub ? 'crit' : 'ok');
        if (r.sub) {
          const m = ARMORY.substats.find((x) => x.id === r.sub.id);
          ticker(`✨ 強化Lv${r.lv}! ランダム強化【${m.name}】が${r.sub.rolls.length > 1 ? '伸びた' : 'ついた'}!`, 'gold');
        }
        app.save();
        renderWeaponsSheet();
        renderedAt.sheet = performance.now();
        renderStat();
      }
      return;
    }
    const sv = e.target.closest('[data-salv]');
    if (sv) {
      const r = salvage(p, sv.dataset.salv);
      if (r) { sfx('flip'); ticker(`分解した。砥石+${r.whet}${r.refund ? ` 💰${fmtBig(r.refund)}返却` : ''}(図鑑は残る)`); app.save(); renderWeaponsSheet(); renderedAt.sheet = performance.now(); }
      return;
    }
  };
}

function renderBaseSheet() {
  const p = app.profile;
  const body = $('#sheetBody');
  const rows = [];
  for (const f of FACILITIES) {
    if (f.id === 'fire') continue;
    const revealed = SHOP_REVEAL[f.id] ? SHOP_REVEAL[f.id](p, ws) : true;
    const owned = p.facilities[f.id] || 0;
    if (!revealed) { rows.push(`<div class="shop-row teaser"><span>${esc(f.name)}</span><small>……まだ作れない</small></div>`); continue; }
    if (owned >= f.max) { rows.push(`<div class="shop-row done"><span>${f.icon} ${esc(f.name)} ×${owned}</span><small>${esc(f.desc)}</small></div>`); continue; }
    const price = facilityPrice(f, owned);
    const ok = p.lights >= price;
    rows.push(`<button class="shop-row ${ok ? '' : 'poor'}" data-buy="${f.id}">
      <span>${f.icon} ${esc(f.name)}${owned ? ` ×${owned}` : ''}</span>
      <small>${esc(f.desc)}</small>
      <b>${ok ? `✨${fmtBig(price)}` : `あと✨${fmtBig(price - p.lights)}`}</b>
    </button>`);
  }
  body.innerHTML = `<h3>🏘 拠点 <small>✨${fmtBig(p.lights)}</small></h3>
    <p class="story-hint">魔素(✨)で村を立て直す。施設は留守中も魔素を生む。</p>${rows.join('')}`;
  body.onclick = (e) => {
    if (!fresh('sheet')) return;
    const b = e.target.closest('[data-buy]');
    if (b && ws.buy(b.dataset.buy)) {
      sfx('open');
      checkMilestones();
      renderBaseSheet();
      renderedAt.sheet = performance.now();
      renderStat();
    }
  };
}

function renderSpellbookSheet() {
  const p = app.profile;
  const now = Date.now();
  const body = $('#sheetBody');
  const items = [];
  for (const [w, s] of Object.entries(p.steps)) {
    const e = app.index.byKey.get(w);
    if (e) items.push({ w, e, kind: 'step', sort: -2 });
  }
  for (const [w, c] of Object.entries(p.cards)) {
    const e = app.index.byKey.get(w);
    if (!e || !c.reps) continue;
    const R = retrievability(c, now);
    items.push({ w, e, c, kind: 'card', R, tier: rarityIndex(c), sort: R < 0.9 ? -1 : R });
  }
  items.sort((a, b) => a.sort - b.sort);
  const left = Math.min(ws.inviteCapToday(), Math.max(0, ws.roomLeft()));
  const open = body.dataset?.open || '';
  body.innerHTML = `
    <h3>📖 呪文書 <small>${items.length}語</small></h3>
    <button class="primary-btn small" data-act="invite" ${left ? '' : 'disabled'}>新しい呪文を編む${left ? `(きょうあと${left})` : '(きょうは終わり)'}</button>
    <div id="inviteArea"></div>
    <div class="spell-list">
    ${items.slice(0, 60).map((it) => {
      const color = it.kind === 'step' ? '#9a8fa8' : RARITY[it.tier].color;
      const status = it.kind === 'step' ? 'おぼえかけ' : `${TIER_NAMES[it.tier]}${it.R < 0.9 ? '・修行どき' : ''}`;
      return `<div class="spell-row" data-w="${esc(it.w)}">
        <span style="color:${color}">◆</span><b>${esc(it.w)}</b><small>${esc(it.e.j)}</small><i>${status}</i>
      </div>${open === it.w ? spellDetail(it) : ''}`;
    }).join('')}
    ${items.length > 60 ? `<p class="story-hint">ほか${items.length - 60}語</p>` : ''}
    </div>
  `;
  body.onclick = (e) => {
    if (!fresh('sheet')) return;
    if (e.target.closest('[data-act="invite"]')) { renderInvite(); return; }
    const inv = e.target.closest('[data-invite-w]');
    if (inv) {
      const w = inv.dataset.inviteW;
      if (ws.invite(w)) {
        battle.addExp('invite');
        sfx('flip');
        const entry = app.index.byKey.get(w);
        ticker(`新しい呪文『${w}』(${entry.j})を書きとめた。`);
        if (p.settings.autoSpeak || p.settings.listen) speak(w, p.settings.rate);
        pool.refill();
        renderSpellbookSheet();
        renderedAt.sheet = performance.now();
      }
      return;
    }
    const sp = e.target.closest('[data-speak]');
    if (sp) { speak(sp.dataset.speak, p.settings.rate); return; }
    const row = e.target.closest('.spell-row');
    if (row) {
      body.dataset.open = body.dataset.open === row.dataset.w ? '' : row.dataset.w;
      renderSpellbookSheet();
      renderedAt.sheet = performance.now();
    }
  };
}

function spellDetail(it) {
  const e = it.e;
  return `<div class="spell-detail">
    <div>${esc(e.j)} <span class="pos">${POS_JA[e.p] || ''}</span> <button class="mini-act" data-speak="${esc(e.w)}">🔊</button></div>
    ${e.ex ? `<div class="spell-ex">${esc(e.ex)}<br><small>${esc(e.jx)}</small></div>` : ''}
    ${it.c ? `<small>つよさ ${(it.R * 100).toFixed(0)}% ・ 唱えた回数 ${app.profile.taps[it.w] || 0}</small>` : ''}
  </div>`;
}

function renderInvite() {
  const cands = ws.inviteCandidates(3);
  const area = $('#inviteArea');
  if (!cands.length) { area.innerHTML = `<p class="story-hint">${esc(line('invite_empty'))}</p>`; return; }
  area.innerHTML = cands.map((e) => `
    <div class="cand">
      <b>${esc(e.w)}</b> <span>${esc(e.j)}</span> <small>${LEVEL_NAMES[e.l]}・${FIELD_NAMES[e.f] || ''}</small>
      <button class="mini-act" data-speak="${esc(e.w)}">🔊</button>
      <button class="mini-act warm" data-invite-w="${esc(e.w)}">書きとめる</button>
    </div>`).join('');
}

function renderSettingsSheet() {
  const s = app.profile.settings;
  const body = $('#sheetBody');
  body.innerHTML = `
    <h3>⚙ 設定</h3>
    <h4>呪文のレベル</h4>
    <div class="chips">${[1, 2, 3, 4, 5].map((l) => `<button class="chip ${s.levels.includes(l) ? 'on' : ''}" data-lv="${l}">${LEVEL_NAMES[l]}</button>`).join('')}</div>
    <h4>分野</h4>
    <div class="chips">${ALL_FIELDS.map((f) => `<button class="chip ${s.fields.includes(f) ? 'on' : ''}" data-fd="${f}">${FIELD_NAMES[f]}</button>`).join('')}</div>
    <h4>1日に編める呪文(無制限でも、忘却曲線が翌日からの復習で支えます)</h4>
    <div class="chips">${[10, 20, 50, 999].map((n) => `<button class="chip ${s.newPerDay === n ? 'on' : ''}" data-np="${n}">${n >= 999 ? '∞ 無制限' : n + '語'}</button>`).join('')}</div>
    <h4>音</h4>
    <div class="chips">
      <button class="chip ${s.listen ? 'on' : ''}" data-tg="listen">聴き取り${ttsAvailable() ? '' : '(非対応)'}</button>
      <button class="chip ${s.autoSpeak ? 'on' : ''}" data-tg="autoSpeak">自動読み上げ</button>
    </div>
    <label class="slider-row">速さ <input type="range" id="rateSlider" min="0.6" max="1.2" step="0.05" value="${s.rate}"></label>
    <h4>記録</h4>
    <div class="chips">
      <button class="chip" data-act="export">書き出す</button>
      <button class="chip" data-act="import">読み込む</button>
      <button class="chip danger" data-act="reset">すべて忘れる</button>
    </div>
    <h4>開発者モード(進行倍率と時間送り)</h4>
    <div class="chips">
      ${[1, 10, 100].map((m) => `<button class="chip ${(app.profile.dev?.mult || 1) === m ? 'on' : ''}" data-dev="${m}">×${m}</button>`).join('')}
      <button class="chip" data-skip="3600000">+1時間</button>
      <button class="chip" data-skip="86400000">+1日</button>
      <button class="chip" data-skip="604800000">+1週間</button>
    </div>
    <p class="story-hint">たね火 ${app.profile.streak.count}日 ・ 確かな想起 ${app.profile.surely} ・ 討伐 ${app.profile.battle.kills}体</p>
  `;
  body.onclick = (ev) => {
    if (!fresh('sheet')) return;
    const reopen = () => { renderSettingsSheet(); renderedAt.sheet = performance.now(); };
    const lv = ev.target.closest('[data-lv]');
    if (lv) { const l = Number(lv.dataset.lv); if (s.levels.includes(l)) { if (s.levels.length > 1) s.levels = s.levels.filter((x) => x !== l); } else s.levels = [...s.levels, l].sort(); app.save(); reopen(); return; }
    const fd = ev.target.closest('[data-fd]');
    if (fd) { const f = fd.dataset.fd; if (s.fields.includes(f)) { if (s.fields.length > 1) s.fields = s.fields.filter((x) => x !== f); } else s.fields.push(f); app.save(); reopen(); return; }
    const np = ev.target.closest('[data-np]');
    if (np) { s.newPerDay = Number(np.dataset.np); app.save(); reopen(); return; }
    const tg = ev.target.closest('[data-tg]');
    if (tg) { s[tg.dataset.tg] = !s[tg.dataset.tg]; app.save(); reopen(); return; }
    const dv = ev.target.closest('[data-dev]');
    if (dv) { app.profile.dev = { mult: Number(dv.dataset.dev) }; app.save(); reopen(); ticker(`開発者モード ×${dv.dataset.dev}`); return; }
    const sk = ev.target.closest('[data-skip]');
    if (sk) {
      const ms = Number(sk.dataset.skip);
      const pr = app.profile;
      for (const c of Object.values(pr.cards)) { c.last -= ms; c.due -= ms; }
      for (const st of Object.values(pr.steps)) { st.due -= ms; }
      pr.settledAt -= ms;
      if (pr.chest) { const d = new Date(); d.setTime(d.getTime() - ms); }
      pr.party.letterDay = '';
      app.save();
      ticker(`⏩ 時間を${ms >= 86400000 ? Math.round(ms / 86400000) + '日' : '1時間'}送った(復習期日・鐘・手紙が進む)`);
      pool.refill();
      renderAll();
      return;
    }
    const act = ev.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'export') {
      const data = JSON.stringify(app.profile);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(data).then(() => ticker('記録を書き出した。')).catch(() => prompt('コピーしてください', data));
      else prompt('コピーしてください', data);
    }
    if (act.dataset.act === 'import') {
      const raw = prompt('書き出した記録を貼り付け:');
      if (!raw) return;
      try { const obj = JSON.parse(raw); if (!obj.cards) throw 0; saveProfile(obj); location.reload(); } catch { ticker('読み込めなかった。'); }
    }
    if (act.dataset.act === 'reset') {
      if (confirm('本当にすべて忘れる?')) { saveProfile(defaultProfile()); location.reload(); }
    }
  };
  $('#rateSlider').oninput = (ev) => { s.rate = Number(ev.target.value); lazySave(); };
}

// ---------- 焚き火(修行=SRS。敵もタイマーもない場所) ----------
function openTakibi() {
  takibiState = { queue: [...ws.introQueue(), ...ws.wakeQueue().map((x) => x.w)], card: null };
  $('#takibi').classList.remove('hidden');
  document.body.classList.add('in-takibi');
  nextTakibi();
}

function closeTakibi() {
  takibiState = null;
  $('#takibi').classList.add('hidden');
  document.body.classList.remove('in-takibi');
  pool.refill();
  renderAll();
}

function nextTakibi() {
  const p = app.profile;
  if (!takibiState.queue.length) {
    renderTakibiDone();
    return;
  }
  const w = takibiState.queue.shift();
  const isFresh = !p.cards[w] && !p.steps[w];
  const r = ws.openRecall(w);
  if (!r) { nextTakibi(); return; }
  takibiState.card = { mode: isFresh ? 'study' : 'recall', r };
  renderTakibi();
  if (isFresh && (p.settings.autoSpeak || p.settings.listen)) speak(w, p.settings.rate);
  if (!isFresh && r.form === 'listen') speak(w, p.settings.rate);
}

function renderTakibiDone() {
  const p = app.profile;
  const body = $('#takibiBody');
  const chest = ws.canOpenChest() ? 'open' : ws.canMakeChest() ? 'make' : null;
  body.innerHTML = `
    <div class="takibi-head">🔥</div>
    <p class="takibi-line">${esc(line('wake_none'))}</p>
    ${chest === 'open' ? '<button class="primary-btn" data-act="chest-open">宝箱をひらく</button>' : ''}
    ${chest === 'make' ? '<button class="primary-btn" data-act="chest-make">今日のことばを宝箱へ</button>' : ''}
    <p class="takibi-line dim">つぎの鐘は ${hhmm(ws.snapshot().nextBell.ts)} ごろ。</p>
    <button class="ghost-btn" data-act="close">たちあがる</button>
  `;
  body.onclick = (e) => {
    if (!fresh('takibi')) return;
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'close') closeTakibi();
    if (a.dataset.act === 'chest-make') { if (ws.makeChest()) { sfx('flip'); ticker(line('chest_make'), 'gold'); renderTakibiDone(); renderedAt.takibi = performance.now(); } }
    if (a.dataset.act === 'chest-open') {
      if (ws.openChest()) {
        sfx('open');
        ticker(line('chest_open'), 'gold');
        takibiState.queue = [...ws.introQueue(), ...ws.wakeQueue().map((x) => x.w)];
        nextTakibi();
      }
    }
  };
  renderedAt.takibi = performance.now();
}

function renderTakibi() {
  const p = app.profile;
  const { mode, r } = takibiState.card;
  const body = $('#takibiBody');
  renderedAt.takibi = performance.now();
  let inner = '';
  if (mode === 'study') {
    inner = `
      <div class="icard-tag">新しい呪文</div>
      <div class="icard-word">${esc(r.entry.w)} <button class="mini-act" data-act="spk">🔊</button></div>
      <div class="icard-ja">${esc(r.entry.j)} <span class="pos">${POS_JA[r.entry.p] || ''}</span></div>
      ${r.entry.ex ? `<div class="icard-ex">${esc(r.entry.ex)}<br><small>${esc(r.entry.jx)}</small></div>` : ''}
      <button class="primary-btn" data-act="got">おぼえた</button>`;
  } else if (mode === 'recall') {
    const f = r.form;
    let prompt;
    if (f === 'listen') prompt = `<button class="replay" data-act="spk">🔊</button>`;
    else if (f === 'j2e') prompt = `<div class="icard-word ja">${esc(r.entry.j)}</div><div class="icard-sub">${POS_JA[r.entry.p] || ''}・異界の言葉で?</div>`;
    else if (f === 'cloze') prompt = `<div class="icard-cloze">${esc(clozePrompt(r.entry))}</div><div class="icard-sub">${esc(r.entry.jx || '')}</div>`;
    else prompt = `<div class="icard-word">${esc(r.entry.w)}</div><div class="icard-sub">${POS_JA[r.entry.p] || ''}・意味は?</div>`;
    inner = `
      ${r.stepState ? '<div class="icard-tag dim">おぼえかけの呪文</div>' : ''}
      ${r.mikiri ? '<div class="icard-tag pinto">ピンときた!</div>' : ''}
      <div class="icard-prompt">${prompt}</div>
      ${r.q ? `<div class="ichoices">${r.q.choices.map((c, i) => `<button class="ichoice" data-choice="${i}">${esc(c.t)}</button>`).join('')}</div>`
        : `<div class="icard-actions">
            ${p.surely >= 6 && !r.mikiri ? '<button class="ghost-btn" data-act="pinto">ピンときた</button>' : ''}
            <button class="primary-btn" data-act="open">選択肢をひらく</button>
          </div>`}
      <div class="takibi-rest">${takibiState.queue.length ? `あと${takibiState.queue.length + 1}語` : ''}</div>`;
  } else if (mode === 'answer') {
    const e = takibiState.card.res.entry;
    inner = `
      <div class="icard-word small">${esc(e.w)} <button class="mini-act" data-act="spk">🔊</button></div>
      <div class="icard-ja">${esc(e.j)}</div>
      ${e.ex ? `<div class="icard-ex">${esc(e.ex)}<br><small>${esc(e.jx)}</small></div>` : ''}
      <button class="primary-btn" data-act="next">つぎへ</button>`;
  }
  body.innerHTML = `<div class="takibi-head">🔥</div><div class="icard">${inner}</div><button class="text-btn" data-act="close">やめておく</button>`;
  body.onclick = (e) => {
    if (!fresh('takibi')) return;
    const ch = e.target.closest('[data-choice]');
    if (ch) { answerTakibi(Number(ch.dataset.choice)); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'spk') speak(takibiState.card.r ? takibiState.card.r.entry.w : takibiState.card.res.entry.w, p.settings.rate);
    if (act === 'got') { takibiState.card.mode = 'recall'; renderTakibi(); }
    if (act === 'pinto') { ws.declareMikiri(); takibiState.card.r.mikiri = true; sfx('flip'); renderTakibi(); }
    if (act === 'open') { ws.openChoices(); renderTakibi(); }
    if (act === 'next') nextTakibi();
    if (act === 'close') closeTakibi();
  };
}

function clozePrompt(entry) {
  return entry.ex.replace(new RegExp(`\\b${entry.w.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'), '____');
}

function answerTakibi(idx) {
  const p = app.profile;
  const r = takibiState.card.r;
  if (!r || !r.q) return;
  const res = ws.submitRecall(idx);
  if (!res) return;
  document.querySelectorAll('#takibi .ichoice').forEach((el, i) => {
    el.disabled = true;
    if (r.q.choices[i].correct) el.classList.add('ok');
    else if (i === idx) el.classList.add('ng');
  });
  if (res.correct) {
    battle.addExp(res.mikiri ? 'mikiri' : 'recall');
    if (res.graduated) battle.addExp('graduate');
    sfx(res.burstM >= 2.2 || res.graduated ? 'crit' : 'ok');
    if (navigator.vibrate) navigator.vibrate(10);
    const total = res.reward + res.manaReleased;
    p.lights += 0; // 報酬はsubmitRecall内で加算済み
    if (res.manaReleased > 0) ticker(`『${res.entry.w}』が目を覚ました。${lineVar('mana_burst') || ''} +✨${fmtBig(total)}`);
    if (res.graduated) ticker(line(p.story.seen.first_grad ? 'first_promote' : 'first_grad', { word: res.entry.w, n: Math.max(1, Math.round(p.cards[res.entry.w]?.S || 2.5)) }), 'gold');
    else if (res.promoted) ticker(lineVar('promote', { word: res.entry.w, tier: res.promoted }), 'gold');
    if (!p.story.seen.first_grad && res.graduated) p.story.seen.first_grad = 1;
    if (p.settings.autoSpeak && r.form !== 'listen') speak(res.entry.w, p.settings.rate);
    setTimeout(() => { if (takibiState) nextTakibi(); }, 550);
  } else {
    sfx('bad');
    speak(res.entry.w, p.settings.rate);
    setTimeout(() => {
      if (!takibiState) return;
      takibiState.card = { mode: 'answer', res };
      renderTakibi();
    }, 450);
  }
}

// ---------- ループ ----------
function startLoops() {
  setInterval(() => {
    const now = Date.now();
    ws.tick(now);
    const t = pool.tickSecond(now);
    if (t.rushEnded) {
      document.body.classList.remove('rush');
      sfx('land');
      ticker(`詠唱ラッシュ +✨${fmtBig(rushEarned)} — 余韻のあいだ、ためが速い(45秒以内の再点火で ×${(CURVE.fever.mult + CURVE.fever.chainStep * Math.min(pool.chain + 1, CURVE.fever.chainCap)).toFixed(2)})`, 'gold');
      rushEarned = 0;
    }
    const atk = battle.tick(now);
    if (atk && atk.attacked) {
      sfx('hit');
      if (navigator.vibrate) navigator.vibrate(40);
      document.body.classList.add('shake-body');
      setTimeout(() => document.body.classList.remove('shake-body'), 350);
      if (atk.defeated) ticker('押し返された……だが、得たものは何も失っていない。');
      renderStage();
    }
    const ev = maybeEvent(app.profile, now);
    if (ev && !sheetKind && !takibiState) ticker(ev);
    helperTick();
    checkMilestones();
    renderBand();
    renderMenuBadges();
    lazySave();
  }, 1000);

  // rAF: 魔素カウンタ補間・ラッシュ残時間・ボス攻撃カウントダウン
  const frame = () => {
    const p = app.profile;
    const now = Date.now();
    const snap = ws.snapshot(now);
    const idleRoom = Math.max(0, snap.cap - p.lights);
    const interp = p.lights + Math.min((snap.rate * (now - p.settledAt)) / 60000, idleRoom);
    const m = $('#stMana');
    if (m) m.innerHTML = `✨${fmtBig(interp)}<small id="stRate">${snap.rate > 0 ? ` +${snap.rate.toFixed(1)}/分` : ''}</small>`;
    if (pool.rushActive(now)) {
      const remain = (pool.rushEndsAt - now) / 1000;
      $('#gaugeFill').style.width = `${Math.min(100, (remain / (CURVE.fever.capMs / 1000)) * 100)}%`;
      $('#gaugeNum').textContent = `×${pool.rushMult().toFixed(2)} ${remain.toFixed(1)}s`;
    }
    if (p.boss.engaged) {
      const s = Math.max(0, (p.boss.nextAtk - now) / 1000);
      $('#bossTimer').textContent = `${s.toFixed(1)}`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const ret = ws.settleReturn();
      if (ret.gained > 2 && ret.away > 5 * 60000) {
        ticker(lineVar('settle_return', { n: fmtBig(ret.gained) }));
      }
      renderAll();
    } else {
      battle.retreat(); // 離席中にボスに殴られ続けない(正直な凍結)
    }
  });
}

// からくりの手: 見ている間お題にひとりでに応える(価値×0.5、ゲージ・敵HPに乗らない)
let helperAcc = 0;
function helperTick() {
  const p = app.profile;
  const lv = p.facilities.helper || 0;
  if (!lv || !pool.cue || document.hidden || sheetKind || takibiState) return;
  helperAcc += lv;
  if (helperAcc < 8) return;
  helperAcc = 0;
  const cueW = pool.cue.w;
  const res = pool.tap(cueW, { auto: true });
  if (res && res.correct) {
    p.lights += res.gain;
    p.totalLights += res.gain;
    const tile = document.querySelector(`[data-tap="${CSS.escape(cueW)}"]`);
    if (tile) { tile.classList.add('auto'); setTimeout(() => tile.classList.remove('auto'), 400); }
    renderPool();
  }
}

export function toast(msg) { ticker(msg); }
