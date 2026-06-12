// v2のヘッドレス実走行: 導入→初想起→火をおこす→招く→ふいご→設定
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

// 導入: 靄を払う
await page.waitForSelector('.intro-line', { timeout: 5000 });
ok(true, '導入の一行が出た');
for (let i = 0; i < 7; i++) { await page.touchscreen.tap(195, 380); await page.waitForTimeout(90); }
await page.waitForSelector('#introGo', { timeout: 3000 });
ok(true, 'タップで靄を払うと[おもいだす]が現れた');
await page.waitForTimeout(300);
await page.tap('#introGo');

// 導入3語: 紹介 → おぼえた → 選択肢をひらく → 回答(正解を内部から特定)
let answered = 0;
for (let i = 0; i < 60 && answered < 3; i++) {
  await page.waitForTimeout(320);
  if (await page.$('[data-act="got"]')) { await page.tap('[data-act="got"]'); continue; }
  if (await page.$('[data-act="open"]')) { await page.tap('[data-act="open"]'); continue; }
  if (await page.$('[data-act="next"]')) { await page.tap('[data-act="next"]'); continue; }
  const n = (await page.$$('.ichoice:not([disabled])')).length;
  if (n >= 4) {
    const idx = await page.evaluate(() => {
      const t = window.__correctText;
      return t || null;
    });
    void idx;
    // 正解テキストはプロフィールから引けないので、紹介で見た意味=訳をDOMから照合する
    const correctIdx = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.ichoice')];
      const word = document.querySelector('.icard-word')?.textContent?.trim().split(' ')[0];
      const W = window.__app.words.find((x) => x.w === word);
      if (!W) return 0;
      const i = els.findIndex((el) => el.textContent.trim() === W.j || el.textContent.trim() === W.w);
      return i >= 0 ? i : 0;
    });
    const btns = await page.$$('.ichoice');
    await btns[correctIdx].tap();
    answered++;
  }
}
ok(answered === 3, `導入の3語を想起できた (${answered}/3)`);

// 灯火カウンタと[火をおこす]
await page.waitForTimeout(800);
ok(!(await page.$('#res.hidden')), '灯火カウンタが現れた');
const fireBtn = await page.waitForSelector('[data-act="buy-fire"]', { timeout: 4000 }).catch(() => null);
ok(!!fireBtn, '[火をおこす]が現れた');
if (fireBtn) { await page.waitForTimeout(300); await fireBtn.tap(); }
await page.waitForTimeout(600);
const rate = await page.evaluate(() => document.querySelector('#rateTag')?.textContent || '');
ok(true, `火を購入(レート表示: "${rate.trim() || 'まだ0'}")`);

// 招く
const inviteBtn = await page.$('[data-act="invite"]');
ok(!!inviteBtn, '[招く]が現れた');
if (inviteBtn) {
  await inviteBtn.tap();
  await page.waitForSelector('[data-invite]', { timeout: 3000 });
  await page.waitForTimeout(300);
  await page.tap('[data-invite="0"]');
  await page.waitForTimeout(300);
  const stepCount = await page.evaluate(() => Object.keys(window.__app.profile.steps).length);
  ok(stepCount >= 1, `招いた言霊がねむりに入った (steps=${stepCount})`);
  const closeBtn = await page.$('[data-act="close"]');
  if (closeBtn) await closeBtn.tap();
}

// ふいご(クリッカー): 連打でブーストが乗る
for (let i = 0; i < 6; i++) { await page.touchscreen.tap(195, 800); await page.waitForTimeout(70); }
const boost = await page.evaluate(() => window.__app && document.querySelector('#fanGlow').style.opacity);
ok(Number(boost) > 0.2, `ふいご連打でグローが強まる (opacity=${boost})`);

// 設定パネル(インライン)
await page.tap('#gear');
await page.waitForSelector('.settings-panel:not(.hidden)', { timeout: 2000 });
ok(true, '設定がインラインで開く');
await page.tap('[data-lv="3"]');
const lv = await page.evaluate(() => window.__app.profile.settings.levels);
ok(lv.includes(3), 'レベル設定が保存される');

// 永続化
const stored = await page.evaluate(() => !!localStorage.getItem('kotodama_reforge_v1'));
ok(stored, 'localStorageに保存されている');

// ログが流れている
const logCount = await page.evaluate(() => document.querySelectorAll('.log-line').length);
ok(logCount >= 4, `ログが${logCount}行流れている`);

if (errors.length) ok(false, `ブラウザエラー:\n${errors.join('\n')}`);
else ok(true, 'コンソールエラーなし');

await page.screenshot({ path: '/tmp/v2_smoke.png' });
await browser.close();
