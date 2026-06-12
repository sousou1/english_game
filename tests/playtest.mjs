// ペルソナ・プレイテスト: 状態が変わるたびにスクショ+タイムログを記録しながら1ラン通しでプレイする。
// 「せっかちな15歳」を模して、待ち時間は最短タップで進める。
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '/tmp/playtest';
mkdirSync(OUT, { recursive: true });

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const t0 = Date.now();
const log = [];
let shotN = 0;
const seenStates = new Set();
async function shot(state, force = false) {
  if (!force && seenStates.has(state)) return;
  seenStates.add(state);
  shotN++;
  const name = `${String(shotN).padStart(2, '0')}_${state}.png`;
  await page.screenshot({ path: `${OUT}/${name}` });
  log.push(`[${((Date.now() - t0) / 1000).toFixed(1)}s] 📸 ${name}`);
}
function note(msg) { log.push(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`); }

await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });
await shot('home');
note('ホーム表示');

await page.click('[data-act="start"]');
note('出発タップ');

let answers = 0, studies = 0, rewards = 0, waits = 0;
let questionStart = 0;
const qTimes = [];

for (let i = 0; i < 400; i++) {
  // リザルト
  if (await page.$('.result')) {
    await shot('result', true);
    note(`リザルト到達 — 回答${answers}問 / 新出${studies}枚 / 報酬${rewards}回`);
    break;
  }
  // 報酬選択
  if (await page.$('.cleared .reward-card')) {
    await shot('reward');
    rewards++;
    await page.click('.reward-card');
    note(`ノード突破→鍛冶具選択(${rewards}回目)`);
    continue;
  }
  // 新出スタディカード
  if (await page.$('.study [data-act="forge"]')) {
    studies++;
    if (studies === 1) { await shot('study_card'); note('新出カード1枚目 — せっかちなので読まずに即タップ'); }
    await page.click('[data-act="forge"]');
    continue;
  }
  // ミスパネル
  if (await page.$('.miss-panel [data-act="next"]')) {
    await shot('miss_panel');
    await page.click('[data-act="next"]');
    note('ミスパネル→続行');
    continue;
  }
  // 想起の間(考える時間バー)
  if (await page.$('.qa .think-bar')) {
    questionStart = Date.now();
    await shot('prompt_phase');
    // せっかち: 即タップで選択肢を出す
    await page.click('.prompt-area').catch(() => {});
    const ok = await page.waitForSelector('.choice', { timeout: 4000 }).catch(() => null);
    if (!ok) { waits++; note('⚠️ タップしても選択肢が出ず待たされた'); }
    continue;
  }
  // 選択肢
  const choices = await page.$$('.choice:not([disabled])');
  if (choices.length === 4) {
    await shot('choices_phase');
    // 8割正解・2割ミスのつもりで(知らない単語は適当に押す)
    const correctIdx = await page.evaluate(() => {
      // ランの内部状態から正解を覗く(テスト用)
      const r = window.__app && Object.keys(window.__app).length; void r;
      return null;
    });
    void correctIdx;
    const pick = Math.random() < 0.8
      ? await page.evaluate(() => {
          const els = [...document.querySelectorAll('.choice')];
          // 正解クラスは回答後にしか付かないので、storage直読みはせず単に最初を押す
          return 0;
        })
      : 2;
    await choices[pick].click();
    answers++;
    if (questionStart) { qTimes.push(Date.now() - questionStart); questionStart = 0; }
    // 正解演出 or ミスパネルを待つ
    await page.waitForTimeout(1250);
    await shot('feedback', answers === 1);
    continue;
  }
  await page.waitForTimeout(250);
}

const total = (Date.now() - t0) / 1000;
const avgQ = qTimes.length ? (qTimes.reduce((a, b) => a + b, 0) / qTimes.length / 1000).toFixed(1) : '?';
note(`--- 集計 ---`);
note(`総プレイ時間: ${total.toFixed(0)}秒 / 1問あたり平均 ${avgQ}秒(出題表示→回答タップまで)`);
note(`回答${answers}問・新出カード${studies}枚・報酬選択${rewards}回`);

writeFileSync(`${OUT}/flow.log`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
