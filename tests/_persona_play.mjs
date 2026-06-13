// ペルソナプレイテスト: 中2男子になりきって新規プロフィールから通しプレイ
// 計測: タップ数 / 行数 / 所要ステップ。ログをJSONで吐く
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { WORDS } from '../data/words.js';
import { EVENTS } from '../data/events.js';

const byW = new Map(WORDS.map((w) => [w.w, w]));
const byJ = new Map(WORDS.map((w) => [w.j, w]));
const note = (tag, msg) => { console.log(`[${tag}] ${msg}`); };

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });

let tapCount = 0;
const tap = async (sel) => { await page.tap(sel); tapCount++; await page.waitForTimeout(420); };
const tapEl = async (el) => { await el.tap(); tapCount++; await page.waitForTimeout(420); };
const txt = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() || '', sel);
const visible = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.classList.contains('hidden'); }, sel);

await page.goto('http://localhost:8347/', { waitUntil: 'networkidle' });

// ---------- Phase 1: 導入 ----------
await page.waitForSelector('#intro:not(.hidden)', { timeout: 5000 });
let introTaps = 0;
for (let i = 0; i < 12; i++) {
  const go = await page.$('#introGo');
  if (go) { await tapEl(go); break; }
  const line = await txt('#intro');
  if (i === 0 || i === 3 || i === 6) note('intro', `表示: ${line.slice(0, 90)}`);
  await page.tap('#intro'); introTaps++; tapCount++;
  await page.waitForTimeout(250);
}
note('intro', `導入を抜けるまでのタップ: ${introTaps + 1}`);
await page.screenshot({ path: '/tmp/persona_01_intro.png' });

// ---------- Phase 2: 焚き火チュートリアル(最初の3語) ----------
await page.waitForTimeout(700);
const driveTakibi = async (label, { deliberateWrong = false, maxCards = 999 } = {}) => {
  let wrongDone = !deliberateWrong;
  let cards = 0, quiz = 0, safety = 200;
  while (safety-- > 0) {
    if (!(await visible('#takibi'))) break;
    const st = await page.evaluate(() => {
      const q = (s) => document.querySelector(`#takibi ${s}`);
      return {
        got: !!q('[data-act="got"]'),
        open: !!q('[data-act="open"]'),
        next: !!q('[data-act="next"]'),
        chestOpen: !!q('[data-act="chest-open"]'),
        chestMake: !!q('[data-act="chest-make"]'),
        close: !!q('[data-act="close"]'),
        word: q('.icard-word')?.textContent?.replace('🔊', '').trim() || '',
        isJa: !!q('.icard-word.ja'),
        cloze: q('.icard-cloze')?.textContent || '',
        choices: [...document.querySelectorAll('#takibi .ichoice:not([disabled])')].map((b) => b.textContent.trim()),
        body: q('.takibi-line')?.textContent || '',
        rest: q('.takibi-rest')?.textContent || '',
      };
    });
    if (st.got) {
      if (cards < 4) note(label, `新しい呪文カード: ${st.word}`);
      await tap('#takibi [data-act="got"]'); cards++; continue;
    }
    if (st.choices.length) {
      quiz++;
      let target = null;
      if (st.isJa) target = byJ.get(st.word)?.w;
      else if (st.cloze) target = st.choices.find((c) => byW.has(c));
      else target = byW.get(st.word)?.j;
      if (!target || !st.choices.includes(target)) target = st.choices[0];
      if (!wrongDone) {
        wrongDone = true;
        const wrong = st.choices.find((c) => c !== target) || target;
        const idx = st.choices.indexOf(wrong);
        await page.evaluate((i) => [...document.querySelectorAll('#takibi .ichoice')].filter((b) => !b.disabled)[i].click(), idx);
        tapCount++;
        note(label, `わざと誤答してみた(${st.word})`);
        await page.waitForTimeout(1000);
        continue;
      }
      const idx = st.choices.indexOf(target);
      await page.evaluate((i) => [...document.querySelectorAll('#takibi .ichoice')].filter((b) => !b.disabled)[i].click(), idx);
      tapCount++;
      await page.waitForTimeout(1000);
      if (cards >= maxCards) break;
      continue;
    }
    if (st.open) { await tap('#takibi [data-act="open"]'); continue; }
    if (st.next) { await tap('#takibi [data-act="next"]'); continue; }
    if (st.chestOpen) { note(label, '宝箱をひらいた'); await tap('#takibi [data-act="chest-open"]'); continue; }
    if (st.chestMake) { note(label, '宝箱をつくった'); await tap('#takibi [data-act="chest-make"]'); continue; }
    if (st.close) { note(label, `修行おわり画面: ${st.body.slice(0, 70)}`); await tap('#takibi [data-act="close"]'); break; }
    await page.waitForTimeout(300);
  }
  note(label, `見たカード=${cards} クイズ=${quiz}`);
};
const t0 = tapCount;
if (await visible('#takibi')) {
  await page.screenshot({ path: '/tmp/persona_02_takibi.png' });
  await driveTakibi('tutorial', { deliberateWrong: true });
} else note('tutorial', 'BUG? 導入後に修行が自動で開かなかった');
note('tutorial', `チュートリアル区間のタップ数: ${tapCount - t0}`);

// ---------- Phase 3: シナリオ読み ----------
const closeSheetIfOpen = async () => {
  if (await visible('#sheet')) { await page.touchscreen.tap(195, 40); tapCount++; await page.waitForTimeout(450); }
};
const grindBattle = async (goalGold) => {
  await closeSheetIfOpen();
  let safety = 300, taps0 = tapCount;
  while (safety-- > 0) {
    const g = await page.evaluate(() => window.__app.profile.gold);
    if (g >= goalGold) break;
    if (await visible('#engageBtn')) { note('battle', '討伐チャンス! engage'); await tap('#engageBtn'); }
    const cueW = await page.evaluate(() => {
      const cue = document.querySelector('#cue b')?.textContent;
      const W = window.__app.words.find((x) => x.j === cue);
      return W ? W.w : null;
    });
    if (cueW) {
      const tile = await page.$(`[data-tap="${cueW}"]`);
      if (tile) { await tile.tap(); tapCount++; await page.waitForTimeout(240); continue; }
    }
    await page.waitForTimeout(300);
  }
  const st = await page.evaluate(() => ({ gold: window.__app.profile.gold, kills: window.__app.profile.battle.kills, lv: document.querySelector('#stLv')?.textContent }));
  note('battle', `グラインド後: gold=${st.gold} kills=${st.kills} ${st.lv} (タップ${tapCount - taps0})`);
};

const readScenes = async (label) => {
  if (!(await visible('#sheet'))) await tap('[data-sheet="story"]');
  let safety = 60;
  while (safety-- > 0) {
    const st = await page.evaluate(() => {
      const b = document.querySelector('#sheetBody');
      return {
        title: b?.querySelector('h3')?.textContent || '',
        lines: [...(b?.querySelectorAll('.scene-line') || [])].map((e) => e.textContent),
        faces: b?.querySelectorAll('.dlg-face').length || 0,
        art: !!b?.querySelector('img.ev-art'),
        choices: [...(b?.querySelectorAll('[data-choice]') || [])].map((e) => e.textContent),
        nextBtn: b?.querySelector('[data-act="story-next"]')?.textContent?.trim() || null,
        nextDisabled: b?.querySelector('[data-act="story-next"]')?.disabled || false,
        evStart: b?.querySelector('[data-ev-start]') ? b.querySelector('[data-ev-start]').getAttribute('data-ev-start') : null,
        hint: b?.querySelector('.story-hint')?.textContent || '',
      };
    });
    if (st.lines.length) note(label, `シーン「${st.title}」 行数=${st.lines.length} 挿絵=${st.art ? 'あり' : 'なし'} 顔アイコン=${st.faces}`);
    if (st.choices.length) {
      note(label, `選択肢: ${st.choices.join(' / ')}`);
      const pick = Math.floor(Math.random() * st.choices.length);
      await page.evaluate((i) => document.querySelectorAll('#sheetBody [data-choice]')[i].click(), pick);
      tapCount++; await page.waitForTimeout(500); continue;
    }
    if (st.nextBtn && !st.nextDisabled) {
      if (st.nextBtn.includes('💰')) note(label, `読むのにゴールドが要る: 「${st.nextBtn}」`);
      await tap('#sheetBody [data-act="story-next"]'); continue;
    }
    if (st.nextDisabled) { note(label, `ゴールド不足で続き読めず: 「${st.nextBtn}」`); return { blocked: 'gold' }; }
    note(label, `物語トップ: hint=「${st.hint.slice(0, 70)}」 イベント=${st.evStart || 'なし'}`);
    return { ev: st.evStart };
  }
  return {};
};

await page.waitForTimeout(500);
let r = await readScenes('story1');
await page.screenshot({ path: '/tmp/persona_03_scene.png' });

// ---------- Phase 4: 開発者モードON ----------
await closeSheetIfOpen();
await tap('[data-sheet="settings"]');
const dev = await page.$('[data-dev="100"]');
if (dev) { await tapEl(dev); note('dev', '開発者モード×100をON'); } else note('dev', '×100チップが見つからない');
await closeSheetIfOpen();

// ---------- Phase 5: バトル体験 ----------
await grindBattle(100);
await page.screenshot({ path: '/tmp/persona_04_battle.png' });

// ---------- Phase 6: イベント×6(シナリオ読みと交互) ----------
const playEvent = async (evId) => {
  const EV = EVENTS.find((e) => e.id === evId);
  const teachCasts = EV.beats.filter((b) => b.teach).map((b) => (b.cast.answers || [b.cast.answer]));
  let castPtr = 0;
  const m0 = { taps: tapCount, t: Date.now() };
  let linesSteps = 0, lineCount = 0, castSteps = 0, teachSteps = 0;
  let wrongTried = false, grayChecked = false;
  if (await visible('#eventBanner')) await tap('#eventBanner');
  else {
    if (!(await visible('#sheet'))) await tap('[data-sheet="story"]');
    await tap(`[data-ev-start="${evId}"]`);
  }
  await page.waitForSelector('#eventOv:not(.hidden)', { timeout: 3000 });
  let curSeq = null;
  let safety = 200;
  while (safety-- > 0) {
    await page.waitForTimeout(330);
    const st = await page.evaluate(() => {
      const ov = document.querySelector('#eventOv');
      if (ov.classList.contains('hidden')) return { closed: true };
      return {
        hasNext: !!ov.querySelector('[data-act="next"]'),
        hasClose: !!ov.querySelector('[data-act="close"]'),
        isTeach: !!ov.querySelector('.ev-word'),
        jp: ov.querySelector('.ev-jp')?.textContent || '',
        lines: ov.querySelectorAll('.ev-lines .scene-line').length,
        filled: ov.querySelectorAll('.ev-blank b.ok').length,
        choices: [...ov.querySelectorAll('[data-cast]:not([disabled])')].map((b) => b.dataset.cast),
        usedN: ov.querySelectorAll('[data-cast][disabled]').length,
        clearTxt: ov.querySelector('.ev-card.clear')?.textContent || '',
      };
    });
    if (st.closed) break;
    if (st.hasClose) {
      note(evId, `クリア画面: ${st.clearTxt.replace(/\s+/g, ' ').slice(0, 140)}`);
      await page.screenshot({ path: `/tmp/persona_ev_${evId}_clear.png` });
      await tap('#eventOv [data-act="close"]');
      continue;
    }
    if (st.isTeach) { teachSteps++; await tap('#eventOv [data-act="next"]'); continue; }
    if (st.hasNext) { linesSteps++; lineCount += st.lines; await tap('#eventOv [data-act="next"]'); continue; }
    if (st.choices.length) {
      const m = st.jp.match(/お題:\s*(.+?)\)/);
      if (st.filled === 0) {
        castSteps++;
        curSeq = m ? [byJ.get(m[1].trim())?.w] : teachCasts[castPtr++];
        if (m && castSteps <= 2) note(evId, `反芻詠唱: 「${st.jp.replace(/\s+/g, ' ').slice(0, 70)}」`);
      }
      const target = curSeq?.[st.filled];
      if (!target) { note(evId, `BUG? 期待解不明 jp=${st.jp.slice(0, 50)}`); break; }
      if (!wrongTried && st.choices.length > 1) {
        wrongTried = true;
        const wrong = st.choices.find((c) => c !== target);
        await tap(`#eventOv [data-cast="${wrong}"]`);
        const still = await page.evaluate(() => !!document.querySelector('#eventOv [data-cast]:not([disabled])'));
        note(evId, `誤答テスト: そのままやり直し可=${still}`);
      }
      if (!st.choices.includes(target)) { note(evId, `BUG? 正解${target}が選択肢にない: ${st.choices}`); break; }
      await tap(`#eventOv [data-cast="${target}"]`);
      if (curSeq.length > 1 && !grayChecked && st.filled === 0) {
        grayChecked = true;
        const gray = await page.evaluate((w) => {
          const b = document.querySelector(`#eventOv [data-cast="${w}"]`);
          return b ? { disabled: b.disabled, usedClass: b.classList.contains('used') } : null;
        }, target);
        note(evId, `複数語ビート: 1語目タップ後のグレーアウト=${JSON.stringify(gray)}`);
        await page.screenshot({ path: `/tmp/persona_ev_multiword.png` });
      }
      continue;
    }
  }
  if (safety <= 0) note(evId, 'BUG? イベントが進まず打ち切り');
  const dur = Math.round((Date.now() - m0.t) / 1000);
  note(evId, `計測: タップ${tapCount - m0.taps}回 / 地の文ステップ${linesSteps}(計${lineCount}行) / 新語カード${teachSteps} / 詠唱${castSteps}場面 / 自動${dur}秒`);
};

for (const EV of EVENTS) {
  const evId = EV.id;
  let guard = 12;
  while (guard-- > 0) {
    const avail = await page.evaluate(() => {
      const p = window.__app.profile;
      return { read: Object.keys(p.scenario.read), gold: p.gold };
    });
    if (avail.read.includes(EV.gate.read)) break;
    const res = await readScenes(`story_to_${evId}`);
    if (res.blocked === 'gold') { await grindBattle(avail.gold + 3000); }
    else if (res.ev === evId) break;
    await closeSheetIfOpen();
  }
  await closeSheetIfOpen();
  const banner = await txt('#eventBanner');
  note(evId, `バナー表示: 「${banner || '(非表示)'}」`);
  await playEvent(evId);
  await closeSheetIfOpen();
  if (evId === 'ev_c01_fire' || evId === 'ev_c01_work') {
    await tap('[data-sheet="takibi"]');
    await driveTakibi(`takibi_after_${evId}`);
  }
}
await page.screenshot({ path: '/tmp/persona_05_after_events.png' });

// ---------- Phase 7: 残りのシナリオ(〜第2章ゲート) ----------
await readScenes('story_tail');
await closeSheetIfOpen();

// ---------- Phase 8: 主要ループ ----------
await tap('[data-sheet="weapons"]');
let body = await txt('#sheetBody');
note('weapons', `武器シート冒頭: ${body.replace(/\s+/g, ' ').slice(0, 220)}`);
const openBtn = await page.$('[data-open]');
if (openBtn) { await tapEl(openBtn); note('weapons', '回収箱から1個開封'); }
await page.screenshot({ path: '/tmp/persona_06_weapons.png' });
const eqBtn = await page.$('[data-equip]');
if (eqBtn) { await tapEl(eqBtn); note('weapons', '開封品を装備した'); }
const jobsTab = await page.$('[data-tab="jobs"]');
if (jobsTab) { await tapEl(jobsTab); body = await txt('#sheetBody'); note('jobs', body.replace(/\s+/g, ' ').slice(0, 220)); }
await closeSheetIfOpen();

await tap('[data-sheet="spellbook"]');
body = await txt('#sheetBody');
note('spellbook', body.replace(/\s+/g, ' ').slice(0, 300));
await page.screenshot({ path: '/tmp/persona_07_spellbook.png' });
await closeSheetIfOpen();

await tap('[data-sheet="base"]');
body = await txt('#sheetBody');
note('base', body.replace(/\s+/g, ' ').slice(0, 300));
note('base', `「招」の文字がある: ${body.includes('招')}`);
await closeSheetIfOpen();

// +1日スキップ → 復習サイクル
await tap('[data-sheet="settings"]');
const skip = await page.$('[data-skip]');
if (skip) { await tapEl(skip); note('dev', '+1日スキップ'); }
await closeSheetIfOpen();
const badge = await txt('#bTrain');
note('takibi2', `時間経過後の修行バッジ数字: 「${badge}」`);
await tap('[data-sheet="takibi"]');
await driveTakibi('takibi_day2', { maxCards: 0 });
await page.screenshot({ path: '/tmp/persona_08_day2.png' });

// ---------- 最終状態 ----------
const fin = await page.evaluate(() => {
  const p = window.__app.profile;
  return {
    gold: p.gold, kills: p.battle.kills, lights: Math.round(p.lights),
    cards: Object.keys(p.cards).length, steps: Object.keys(p.steps).length,
    cleared: Object.keys(p.events.cleared), readScenes: Object.keys(p.scenario.read).length,
  };
});
note('final', JSON.stringify(fin));
note('final', `総タップ数: ${tapCount}`);
note('errors', errors.length ? errors.slice(0, 10).join(' | ') : 'なし');
await browser.close();
console.log('=== END ===');
