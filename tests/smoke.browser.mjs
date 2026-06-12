// v3スペルライトのヘッドレス実走行: 導入→焚き火(修行)→詠唱バトル→物語→シート
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const ok = (c, m) => { console.log(c ? '✔' : '✖', m); if (!c) process.exitCode = 1; };

await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });

// 導入
await page.waitForSelector('.intro-line', { timeout: 5000 });
for (let i = 0; i < 7; i++) { await page.touchscreen.tap(195, 380); await page.waitForTimeout(80); }
await page.waitForSelector('#introGo', { timeout: 3000 });
ok(true, '導入: 靄を払うと[ことばを、おもいだす]');
await page.waitForTimeout(300);
await page.tap('#introGo');

// 焚き火: 導入3語(紹介→おぼえた→選択肢→正解)
await page.waitForSelector('#takibi:not(.hidden)', { timeout: 3000 });
ok(true, '焚き火(修行)が開いた — 敵もタイマーもいない空間');
let answered = 0;
for (let i = 0; i < 60 && answered < 3; i++) {
  await page.waitForTimeout(330);
  if (await page.$('#takibi [data-act="got"]')) { await page.tap('#takibi [data-act="got"]'); continue; }
  if (await page.$('#takibi [data-act="open"]')) { await page.tap('#takibi [data-act="open"]'); continue; }
  if (await page.$('#takibi [data-act="next"]')) { await page.tap('#takibi [data-act="next"]'); continue; }
  const choices = await page.$$('#takibi .ichoice:not([disabled])');
  if (choices.length >= 4) {
    const correctIdx = await page.evaluate(() => {
      const els = [...document.querySelectorAll('#takibi .ichoice')];
      const word = document.querySelector('#takibi .icard-word')?.textContent?.trim().split(' ')[0];
      const W = window.__app.words.find((x) => x.w === word);
      if (!W) return 0;
      const i2 = els.findIndex((el) => el.textContent.trim() === W.j || el.textContent.trim() === W.w);
      return i2 >= 0 ? i2 : 0;
    });
    await choices[correctIdx].tap();
    answered++;
  }
}
ok(answered === 3, `導入の3語を想起できた (${answered}/3)`);

// 焚き火を出る(描画直後の入力ガードがあるためリトライ)
let closed = false;
for (let i = 0; i < 6 && !closed; i++) {
  await page.waitForTimeout(450);
  const btn = await page.$('#takibi:not(.hidden) [data-act="close"]');
  if (btn) await btn.tap().catch(() => {});
  closed = !!(await page.$('#takibi.hidden'));
}
ok(closed, '焚き火から出た');

// 立ち上がると物語シート(第1章冒頭)が開いている → 1シーン読んで閉じる
await page.waitForTimeout(400);
const storyOpen = await page.evaluate(() => !document.querySelector('#sheet').classList.contains('hidden'));
ok(storyOpen, '物語シートが自動で開く(第1章冒頭)');
if (storyOpen) { await page.touchscreen.tap(195, 60); await page.waitForTimeout(350); }

// メイン画面: 敵・ステータス・プール
const enemyVisible = await page.evaluate(() => document.querySelector('#enemy')?.textContent?.length > 0);
ok(enemyVisible, '敵がステージにいる');
const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2);
ok(noScroll, `メイン画面はスクロールなし (${await page.evaluate(() => document.documentElement.scrollHeight)}px)`);

// 詠唱: お題に合うタイルをタップ→敵HPが減り魔素が増える
await page.waitForSelector('.tile', { timeout: 3000 });
const before = await page.evaluate(() => ({
  lights: window.__app.profile.lights,
  dmg: window.__app.profile.battle.dmg,
}));
let casts = 0;
for (let i = 0; i < 10 && casts < 6; i++) {
  const cueW = await page.evaluate(() => {
    const cue = document.querySelector('#cue b')?.textContent;
    const W = window.__app.words.find((x) => x.j === cue);
    return W ? W.w : null;
  });
  if (!cueW) break;
  const tile = await page.$(`[data-tap="${cueW}"]`);
  if (!tile) break;
  await tile.tap();
  casts++;
  await page.waitForTimeout(130);
}
const after = await page.evaluate(() => ({
  lights: window.__app.profile.lights,
  dmg: window.__app.profile.battle.dmg,
  kills: window.__app.profile.battle.kills,
}));
ok(casts >= 6 && after.lights > before.lights, `詠唱${casts}回で魔素+${Math.round(after.lights - before.lights)}`);
ok(after.dmg > before.dmg || after.kills > 0, `敵にダメージが通っている (dmg=${Math.round(after.dmg)}, kills=${after.kills})`);

// 物語シート: 第1章のシーンと選択肢
await page.tap('[data-sheet="story"]');
await page.waitForSelector('#sheet:not(.hidden)', { timeout: 2000 });
const sceneText = await page.evaluate(() => document.querySelector('#sheetBody')?.textContent || '');
ok(sceneText.includes('屋根の上') || sceneText.includes('夜祭'), `物語が開く: ${sceneText.slice(4, 24)}…`);
await page.waitForTimeout(400);
const choiceBtn = await page.$('.choice-btn');
if (choiceBtn) {
  await choiceBtn.tap();
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => document.querySelector('#sheetBody h3')?.textContent || '');
  ok(!t2.includes('屋根の上'), `選択肢で次のシーンへ (${t2.trim()})`);
}
await page.touchscreen.tap(195, 60);
await page.waitForTimeout(300);

// 武器屋シート
await page.tap('[data-sheet="weapons"]');
await page.waitForTimeout(400);
const wText = await page.evaluate(() => document.querySelector('#sheetBody')?.textContent || '');
ok(wText.includes('樫の杖'), '武器屋: 初期装備が見える');
await page.touchscreen.tap(195, 60);
await page.waitForTimeout(250);

// 設定シート
await page.tap('[data-sheet="settings"]');
await page.waitForTimeout(400);
await page.tap('[data-lv="3"]');
const lv = await page.evaluate(() => window.__app.profile.settings.levels);
ok(lv.includes(3), 'レベル設定が保存される');
await page.touchscreen.tap(195, 60);

const stored = await page.evaluate(() => !!localStorage.getItem('kotodama_reforge_v1'));
ok(stored, 'localStorageに保存されている');

if (errors.length) ok(false, `ブラウザエラー:\n${errors.slice(0, 5).join('\n')}`);
else ok(true, 'コンソールエラーなし');

await page.screenshot({ path: '/tmp/v3_smoke.png' });
await browser.close();
