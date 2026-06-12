// ゲームフィール監査プローブ: think-fill遷移 / 回答後ロックアウト / scoreNow不整合 / 自動リビール競合
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:8347/', { waitUntil: 'networkidle' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function toPrompt() {
  for (let i = 0; i < 50; i++) {
    if (await page.$('.qa .think-bar')) return true;
    if (await page.$('.study [data-act="forge"]')) { await page.click('[data-act="forge"]'); continue; }
    if (await page.$('.miss-panel [data-act="next"]')) { await page.click('[data-act="next"]'); continue; }
    if (await page.$('.cleared .reward-card')) { await page.click('.reward-card'); continue; }
    if (await page.$('.result')) return false;
    await sleep(120);
  }
  return false;
}

await page.click('[data-act="start"]');

// --- Probe 1: think-fillの遷移は実際に走るか / 幅の時系列 ---
if (await toPrompt()) {
  const t0 = Date.now();
  const widths = [];
  for (const at of [30, 300, 800, 1500, 2100, 2250, 2500]) {
    const wait = t0 + at - Date.now();
    if (wait > 0) await sleep(wait);
    const w = await page.evaluate(() => {
      const f = document.querySelector('#thinkFill');
      const bar = document.querySelector('.think-bar');
      if (!f || !bar) return { gone: true, phase: document.querySelector('.choices-phase') ? 'choices' : '?' };
      return { fill: f.getBoundingClientRect().width, track: bar.getBoundingClientRect().width };
    });
    widths.push({ at, ...w });
  }
  console.log('PROBE1 think-fill timeline:', JSON.stringify(widths));
}

// --- Probe 2: 回答後ロックアウト計測(正解タップ→連打→次画面までの時間と連打の効果) ---
async function nextChoices() {
  // promptフェーズならタップでリビール
  if (await page.$('.qa .think-bar')) {
    await page.tap('.prompt-area').catch(() => page.click('.prompt-area'));
  }
  await page.waitForSelector('.choice', { timeout: 4000 });
}
if (await toPrompt()) {
  await nextChoices();
  const correctIdx = await page.evaluate(() => {
    const r = window.__app; // smoke test exposes __app? if not, find via DOM after answer
    return null;
  });
  // 正解を当てるのは難しいので、どれかをタップ → フィードバック → 次画面までの所要を計る
  const t0 = Date.now();
  await page.click('.choice');
  // 100ms毎に連打しつつ画面が切り替わるまで計測
  let switched = 0; let tapsDuringLock = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(80);
    const state = await page.evaluate(() => {
      if (document.querySelector('.miss-panel')) return 'miss';
      if (document.querySelector('.study')) return 'study';
      if (document.querySelector('.think-bar')) return 'prompt';
      if (document.querySelector('.choice[disabled]')) return 'feedback';
      return 'other';
    });
    if (state === 'feedback') {
      tapsDuringLock++;
      await page.mouse.click(195, 500); // 連打
    } else { switched = Date.now() - t0; break; }
  }
  console.log('PROBE2 feedback lockout: ms until screen switched =', switched, '| taps swallowed =', tapsDuringLock);
}

// --- Probe 3: scoreNow vs 実スコア(ノード遷移後の表示残留) ---
// ノードクリアまで正解し続ける必要があるので、window側でsubmitを覗くのは省略し、
// 報酬画面が出たら受け取り→直後の #scoreNow / #scoreFill を読む
let probe3done = false;
for (let i = 0; i < 300 && !probe3done; i++) {
  if (await page.$('.result')) break;
  if (await page.$('.cleared .reward-card')) {
    await page.click('.reward-card');
    await sleep(150);
    const s = await page.evaluate(() => ({
      scoreNow: document.querySelector('#scoreNow')?.textContent,
      fillWidth: document.querySelector('#scoreFill')?.getBoundingClientRect().width,
      target: document.querySelector('#scoreTarget')?.textContent,
    }));
    console.log('PROBE3 after node transition:', JSON.stringify(s));
    probe3done = true;
    break;
  }
  if (await page.$('.study [data-act="forge"]')) { await page.click('[data-act="forge"]'); continue; }
  if (await page.$('.miss-panel [data-act="next"]')) { await page.click('[data-act="next"]'); continue; }
  if (await page.$('.qa .think-bar')) {
    await page.click('.prompt-area').catch(() => {});
    await page.waitForSelector('.choice', { timeout: 4000 }).catch(() => {});
  }
  if (await page.$('.choice:not([disabled])')) {
    // 正解の選択肢を当てるため、全choiceを順に試せないので適当に1つ
    await page.click('.choice');
    await sleep(950);
    continue;
  }
  await sleep(100);
}

// --- Probe 4: 自動リビール(2300ms)を跨ぐ上スワイプ → 見切りのつもりがトップ選択肢を回答してしまうか ---
if (await toPrompt()) {
  // プロンプト描画直後から2250ms待ち、スワイプ開始→2350msでリリース
  await sleep(2240);
  const stillPrompt = await page.evaluate(() => !!document.querySelector('.think-bar'));
  await page.mouse.move(195, 600);
  await page.mouse.down();
  await sleep(120); // この間に2300msの自動リビールが発火する
  await page.mouse.move(195, 450, { steps: 3 });
  await page.mouse.up();
  await sleep(150);
  const after = await page.evaluate(() => ({
    mikiriTag: !!document.querySelector('.tag-mikiri'),
    feedback: !!document.querySelector('.choice[disabled]'),
    choices: !!document.querySelector('.choice'),
    miss: !!document.querySelector('.miss-panel'),
  }));
  console.log('PROBE4 swipe spanning auto-reveal: startedInPrompt =', stillPrompt, '| result =', JSON.stringify(after));
}

await browser.close();
