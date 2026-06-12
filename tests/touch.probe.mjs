// タッチ端末でのゴーストクリック検証: 想起の間を1タップ→選択肢が「表示されるだけ」で回答されないこと
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const ok = (c, m) => { console.log(c ? '✔' : '✖', m); if (!c) process.exitCode = 1; };

await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });
await page.tap('[data-act="start"]');

// 最初の出題(想起の間)まで進める
for (let i = 0; i < 40; i++) {
  if (await page.$('.study [data-act="forge"]')) { await page.tap('[data-act="forge"]'); await page.waitForTimeout(350); continue; }
  if (await page.$('.qa .think-bar')) break;
  await page.waitForTimeout(150);
}
ok(!!(await page.$('.qa .think-bar')), '想起の間に到達');

// 【再現手順】画面中央(単語の位置)を1回タップ
await page.touchscreen.tap(195, 430);
await page.waitForTimeout(120);

const state = await page.evaluate(() => {
  const choices = [...document.querySelectorAll('.choice')];
  return {
    choiceCount: choices.length,
    anyDisabled: choices.some((c) => c.disabled),
    anyMarked: choices.some((c) => c.classList.contains('correct') || c.classList.contains('wrong')),
    missPanel: !!document.querySelector('.miss-panel'),
  };
});
ok(state.choiceCount === 4, '選択肢が表示された');
ok(!state.anyDisabled && !state.anyMarked && !state.missPanel, `勝手に回答されていない (disabled=${state.anyDisabled} marked=${state.anyMarked} miss=${state.missPanel})`);

// 300ms経過後の正規のタップは普通に効くこと
await page.waitForTimeout(350);
const target = await page.$('.choice.top');
const box = await target.boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(150);
const after = await page.evaluate(() => ({
  marked: [...document.querySelectorAll('.choice')].some((c) => c.classList.contains('correct') || c.classList.contains('wrong')),
  miss: !!document.querySelector('.miss-panel'),
}));
ok(after.marked || after.miss, '正規のタップで回答が確定する');

// フィードバック中のタップで先送りできること(完全凍結の解消)
await page.waitForTimeout(300);
await page.touchscreen.tap(195, 400);
await page.waitForTimeout(200);
const moved = await page.evaluate(() => ({
  prompt: !!document.querySelector('.think-bar'),
  study: !!document.querySelector('.study'),
  miss: !!document.querySelector('.miss-panel'),
  reward: !!document.querySelector('.cleared'),
  marked: [...document.querySelectorAll('.choice')].some((c) => c.classList.contains('correct')),
}));
ok(moved.prompt || moved.study || moved.miss || moved.reward || !moved.marked, `タップで次へ進んだ (${JSON.stringify(moved)})`);

await browser.close();
