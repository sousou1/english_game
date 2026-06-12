// v5イベントモードの実走行: バナー→イベント開始→teach→cast(正答/誤答)→クリア報酬→アルバム
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { defaultProfile } from '../js/storage.js';
import { newCard, review } from '../js/srs.js';
import { WORDS } from '../data/words.js';
import { EVENTS } from '../data/events.js';

if (!EVENTS.length) { console.log('✖ EVENTSが空(data/events.js未投入)'); process.exit(1); }
const EV = EVENTS[0];

const p = defaultProfile();
p.story.intro = 99;
p.scenario.read['c01_010'] = 1;
p.scenario.read[EV.gate.read] = 1; // 最初のイベントを解放
const t0 = Date.now() - 3 * 86400000;
for (const w of WORDS.slice(0, 5)) p.cards[w.w] = review(newCard(t0), 2, t0);
p.gold = 1000;

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(`localStorage.setItem('kotodama_reforge_v1', ${JSON.stringify(JSON.stringify(p))})`);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });
const ok = (c, m) => { console.log(c ? '✔' : '✖', m); if (!c) process.exitCode = 1; };

await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });
await page.waitForSelector('#enemy', { timeout: 5000 });

// バナーが出る(UI強調の要望)
const banner = await page.$('#eventBanner:not(.hidden)');
ok(!!banner, 'イベントバナーがメイン画面で光っている');
const bTxt = await page.evaluate(() => document.querySelector('#eventBanner')?.textContent || '');
ok(bTxt.includes(EV.title), `バナーにタイトル『${EV.title}』`);

// 開始 → ステップを最後まで歩く
await banner.tap();
await page.waitForSelector('#eventOv:not(.hidden)', { timeout: 2000 });
ok(true, 'イベントオーバーレイが開いた');

const teachSeq = EV.beats.filter((b) => b.teach).map((b) => b.teach);
let teachPtr = 0;
let wrongTried = false;
let safety = 80;
while (safety-- > 0) {
  await page.waitForTimeout(380);
  const state = await page.evaluate(() => ({
    overlay: !document.querySelector('#eventOv').classList.contains('hidden'),
    hasNext: !!document.querySelector('#eventOv [data-act="next"]'),
    hasClose: !!document.querySelector('#eventOv [data-act="close"]'),
    jp: document.querySelector('#eventOv .ev-jp')?.textContent || '',
    choices: [...document.querySelectorAll('#eventOv [data-cast]')].map((b) => b.dataset.cast),
  }));
  if (!state.overlay) break;
  if (state.hasClose) {
    const reward = await page.evaluate(() => document.querySelector('#eventOv .ev-card')?.textContent || '');
    ok(reward.includes('クリア'), 'クリア画面が出た');
    ok(reward.includes('あたらしい言葉'), 'クリア画面に新出語の獲得が出る');
    await page.tap('#eventOv [data-act="close"]');
    continue;
  }
  if (state.hasNext) { await page.tap('#eventOv [data-act="next"]'); continue; }
  if (state.choices.length) {
    let answer;
    const m = state.jp.match(/お題:\s*(.+?)\)/);
    if (m) {
      const entry = WORDS.find((w) => w.j === m[1].trim());
      answer = entry?.w;
    } else {
      answer = teachSeq[teachPtr++];
    }
    if (!wrongTried) { // 一度だけ誤答を踏む(ペナルティなし・やり直し確認)
      wrongTried = true;
      const wrong = state.choices.find((c) => c !== answer);
      await page.tap(`#eventOv [data-cast="${wrong}"]`);
      await page.waitForTimeout(380);
      const still = await page.evaluate(() => !!document.querySelector('#eventOv [data-cast]'));
      ok(still, '誤答してもその場でやり直せる(没収なし)');
    }
    if (!state.choices.includes(answer)) { ok(false, `正解${answer}が選択肢にない: ${state.choices}`); break; }
    await page.tap(`#eventOv [data-cast="${answer}"]`);
    continue;
  }
}
ok(safety > 0, 'イベントが最後まで進んだ');

// 報酬の検証
const after = await page.evaluate(() => ({
  steps: Object.keys(window.__app.profile.steps),
  gold: window.__app.profile.gold,
  box: window.__app.profile.armory.box.length,
  cleared: Object.keys(window.__app.profile.events.cleared),
  banner: document.querySelector('#eventBanner').classList.contains('hidden'),
}));
ok(after.cleared.includes(EV.id), 'クリアが記録された');
ok(teachSeq.every((w) => after.steps.includes(w)), `新出語${teachSeq.length}語が学習ステップ入り`);
ok(after.gold > 1000, `gold増加(${after.gold})`);
ok(after.box >= 1, '武器ドロップが回収箱へ');

// アルバム再演
await page.tap('[data-sheet="story"]');
await page.waitForTimeout(450);
const albumBtn = await page.$(`[data-ev-replay="${EV.id}"]`);
ok(!!albumBtn, '物語シートのアルバムに再演ボタン');

if (errors.length) ok(false, `ブラウザエラー:\n${errors.slice(0, 5).join('\n')}`);
else ok(true, 'コンソールエラーなし');
await page.screenshot({ path: '/tmp/v5_probe.png' });
await browser.close();
