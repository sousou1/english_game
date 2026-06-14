// 第1章(新canon)の実機検収: 確定稿どおりの通しプレイ・挿絵・主人公命名・フィードバックUIを撮影/検証する。
//   node tests/_shot_ch1.mjs   (サンドボックス無効で実行のこと)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { defaultProfile } from '../js/storage.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await readFile(fp);
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(8352, r));
const BASE = 'http://localhost:8352/';

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
let browser;
try { browser = await chromium.launch({ executablePath: exe }); }
catch { browser = await chromium.launch(); }
const errors = [];
const log = (m) => console.log(m);

async function newPage(profile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  if (profile) await ctx.addInitScript(`localStorage.setItem('kotodama_reforge_v1', ${JSON.stringify(JSON.stringify(profile))})`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return page;
}

// 物語シートを開いた状態のプロフィール: 命名済み・ゲート無視(dev.story)で頭から読める
function storyProfile(name) {
  const p = defaultProfile();
  p.story.intro = 99;
  p.named = true;
  p.playerName = name;
  p.facilities.fire = 1;
  p.dev = { mult: 1, story: true }; // ゲート/費用を無視して通しで読める
  p.gold = 100000;
  return p;
}

const NAME = 'ナギサ';
const ILLUST = ['c01_010', 'c01_040', 'c01_060', 'c01_140', 'c01_180'];
let pass = true;

// ---- (A) 第1章 通しプレイ: 25シーン・挿絵5枚・主人公名置換 ----
{
  const page = await newPage(storyProfile(NAME));
  await page.waitForTimeout(500);
  // 物語シートは起動時に自動で開く(未読の先頭シーン)。開いていなければメニューから開く。
  if (!(await page.$('#sheetBody .scene'))) {
    await page.click('[data-sheet="story"]');
    await page.waitForTimeout(300);
  }

  const seenIds = [];
  const illustOk = {};
  let nameShown = false, tokenLeak = false, akiLeak = false;

  for (let step = 0; step < 60; step++) {
    await page.waitForTimeout(330); // 描画後300msの誤タップ防止ガードを必ず超える
    const h3 = await page.$eval('#sheetBody h3', (e) => e.textContent).catch(() => '');
    const bodyTxt = await page.$eval('#sheetBody .scene', (e) => e.textContent).catch(() => '');
    // どのシーンか(art の src から id を拾う)
    const artSrc = await page.$eval('#sheetBody .ev-art', (e) => e.getAttribute('src')).catch(() => null);
    const m = artSrc && artSrc.match(/scene_(c01_\d+)\.webp/);
    if (m) {
      // 画像のロード完了を待ってから naturalWidth を読む(描画直後は 0 のことがある)
      await page.waitForFunction(() => { const i = document.querySelector('#sheetBody .ev-art'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 2000 }).catch(() => {});
      const artW = await page.$eval('#sheetBody .ev-art', (e) => e.naturalWidth).catch(() => 0);
      illustOk[m[1]] = artW > 0;
    }

    if (bodyTxt.includes(NAME)) nameShown = true;
    if (bodyTxt.includes('{name}')) tokenLeak = true;
    if (/おれはアキ|アキ「/.test(bodyTxt)) akiLeak = true; // 命名したのに既定名が出ていないか

    // 撮影(節目)
    if (m && ILLUST.includes(m[1])) await page.screenshot({ path: `/tmp/ch1_${m[1]}.png` });

    // 進める: 温度3択は先頭、それ以外は story-next
    const choice = await page.$('#sheetBody [data-choice="0"]');
    const next = await page.$('#sheetBody [data-act="story-next"]');
    if (choice) { await choice.click(); }
    else if (next) {
      const label = await next.evaluate((e) => e.textContent.trim());
      if (step === 0) log(`A) c01_002 ボタン文言: "${label}"`); // アクション点ラベル確認
      await next.click();
    } else { break; }
    await page.waitForTimeout(150);

    // ゲート止まり(章ゲート)に当たったら終了
    const done = await page.$eval('#sheetBody', (e) => /続きの旅支度|続きはこれから/.test(e.textContent)).catch(() => false);
    if (done) { log('A) 章ゲート/読了に到達'); break; }
  }

  log(`A) 主人公名「${NAME}」が本文に出た: ${nameShown}`);
  log(`A) {name}トークン残留: ${tokenLeak}(false期待) / 既定名アキ漏れ: ${akiLeak}(false期待)`);
  log(`A) 挿絵ロード: ${ILLUST.map((id) => `${id}=${illustOk[id] ? 'OK' : '✗'}`).join(' ')}`);
  if (!nameShown || tokenLeak || akiLeak) pass = false;
  for (const id of ILLUST) if (!illustOk[id]) { pass = false; }
  await page.context().close();
}

// ---- (B) 導入(イントロ)+命名フロー: 靄を払い→名前入力→開始 ----
{
  const p = defaultProfile(); // intro=0, named=false の新規
  const page = await newPage(p);
  await page.waitForTimeout(400);
  // 靄を6回払う
  for (let i = 0; i < 6; i++) { await page.mouse.click(195, 300); await page.waitForTimeout(120); }
  const hasInput = await page.$('#nameInput');
  log(`B) 命名フォーム表示: ${!!hasInput}`);
  if (hasInput) {
    await page.fill('#nameInput', 'ホシ');
    await page.screenshot({ path: '/tmp/ch1_intro_naming.png' });
    await page.click('#introGo');
    await page.waitForTimeout(500);
    const nm = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')).playerName);
    const named = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')).named);
    log(`B) 保存された playerName: ${nm} / named: ${named}`);
    if (nm !== 'ホシ' || named !== true) pass = false;
  } else pass = false;
  await page.context().close();
}

// ---- (C) ゲーム内フィードバック: ✎で開き、タグ+コメントを残し、JSON化される ----
{
  const page = await newPage(storyProfile(NAME));
  await page.waitForTimeout(500);
  // ✎は物語シートの上に浮く(読み物中でもメモできる)。そのまま押せる。
  await page.click('#fbBtn');
  await page.waitForTimeout(400); // 描画後300msの誤タップ防止ガードを超えてから操作
  const ctxLine = await page.$eval('.fb-where', (e) => e.textContent).catch(() => '(なし)');
  log(`C) フィードバック文脈: ${ctxLine}`);
  await page.fill('#fbComment', 'ここの間が少し長く感じた(テスト)');
  await page.click('[data-fbtag="テンポ/間"]'); // タグ切替で再描画→ガード再起動
  await page.waitForTimeout(400);
  await page.click('[data-act="fb-add"]');
  await page.waitForTimeout(250);
  const count = await page.$$eval('.fb-item', (els) => els.length);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')).feedback);
  log(`C) メモ件数(UI): ${count} / 保存: ${JSON.stringify(saved)}`);
  await page.screenshot({ path: '/tmp/ch1_feedback.png' });
  if (count !== 1 || !saved?.length || saved[0].tags[0] !== 'テンポ/間') pass = false;
  await page.context().close();
}

await browser.close();
server.close();
log(errors.length ? `\n⚠ JSエラー:\n${errors.join('\n')}` : '\n✔ JSエラーなし');
log(pass && !errors.length ? '\n✅ 第1章 実機検収 PASS' : '\n❌ 第1章 実機検収 FAIL');
process.exit(pass && !errors.length ? 0 : 1);
