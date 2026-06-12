// ヘッドレスブラウザでのスモークテスト(UIの実走行)。CIではなく手元検証用。
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const fail = (msg) => { console.error('✖', msg); process.exitCode = 1; };
const ok = (msg) => console.log('✔', msg);

await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });

// ホーム画面
await page.waitForSelector('.hero h1', { timeout: 5000 });
ok('ホーム画面が描画された');
const title = await page.textContent('.hero h1');
if (!title.includes('錆と忘却の塔')) fail(`タイトル不正: ${title}`);

// 設定画面
await page.click('[data-act="settings"]');
await page.waitForSelector('#lvChips');
await page.click('[data-lv="3"]');
const lv = await page.evaluate(() => window.__app.profile.settings.levels);
if (!lv.includes(3)) fail('レベル設定が保存されない');
else ok('設定(レベル切替)が動く');
await page.click('[data-act="back"]');

// ラン開始 → 新出スタディカード
await page.click('[data-act="start"]');
await page.waitForSelector('.stage', { timeout: 5000 });
await page.waitForSelector('.study .big-word, .qa .prompt', { timeout: 5000 });
ok('ランが開始し最初のカードが出た');

// 20問ぶん自動プレイ(スタディ→炉にくべる、想起の間→タップ→正解を選ぶ)
let answered = 0;
for (let i = 0; i < 60 && answered < 20; i++) {
  if (await page.$('.study [data-act="forge"]')) {
    await page.click('[data-act="forge"]');
    continue;
  }
  if (await page.$('.miss-panel [data-act="next"]')) {
    await page.click('[data-act="next"]');
    continue;
  }
  if (await page.$('.cleared .reward-card')) {
    await page.click('.reward-card');
    ok('ノード突破→鍛冶具を選択');
    continue;
  }
  if (await page.$('.result')) break;
  if (await page.$('.qa .think-bar')) {
    // 想起の間: タップで選択肢を出す
    await page.click('.prompt-area').catch(() => {});
    await page.waitForSelector('.choice', { timeout: 4000 }).catch(() => {});
  }
  const choices = await page.$$('.choice');
  if (choices.length === 4) {
    // 正解を特定してクリック(__appから現在の問題を読む)
    const correctIdx = await page.evaluate(() => {
      const stage = document.querySelectorAll('.choice');
      return [...stage].findIndex((c, i) => {
        // ui.js内部に直接アクセスできないので、ゲーム側でなく総当たり: 正解クラスは回答後のみ。
        return false;
      });
    });
    // 1つ目をクリック(正誤どちらでもフローが進めば良い)
    await choices[0].click();
    answered++;
    await page.waitForTimeout(1100);
    continue;
  }
  await page.waitForTimeout(300);
}
if (answered >= 10) ok(`${answered}問回答してフローが進んだ`);
else fail(`回答が${answered}問しか進まない`);

// 図鑑
// ランの途中でも想起の記録は保存されている
const seen = await page.evaluate(() => Object.values(window.__app.profile.cards).filter((c) => c.reps > 0).length);
if (seen >= 5) ok(`想起の記録が保存されている(${seen}体)`);
else fail(`カード記録が少なすぎる: ${seen}`);

// localStorage 永続化
const stored = await page.evaluate(() => !!localStorage.getItem('kotodama_reforge_v1'));
if (stored) ok('localStorageに保存されている');
else fail('localStorageが空');

if (errors.length) {
  fail(`ブラウザエラー:\n${errors.join('\n')}`);
} else ok('コンソールエラーなし');

await page.screenshot({ path: '/tmp/kotodama_smoke.png' });
await browser.close();
