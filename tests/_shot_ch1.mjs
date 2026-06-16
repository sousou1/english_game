// 第1章(新canon)の実機検収: 全画面VNリーダーで確定稿どおり通しプレイ・挿絵・命名・戻る・リセット→導入・FBを検証/撮影。
//   node tests/_shot_ch1.mjs   (サンドボックス無効で実行のこと)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './_browser.mjs';
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

const browser = await launchBrowser({ onFail: () => server.close() });
const errors = [];
const log = (m) => console.log(m);

async function newPage(profile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  // 種は「未設定のときだけ」入れる(リセット→リロードで書かれた新規プロフィールを上書きしないため)
  if (profile) await ctx.addInitScript(`{ const K='kotodama_reforge_v1'; if(!localStorage.getItem(K)) localStorage.setItem(K, ${JSON.stringify(JSON.stringify(profile))}); }`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return page;
}

function storyProfile(name, { firstLight = 1 } = {}) {
  const p = defaultProfile();
  p.story.intro = 99;
  p.story.firstLight = firstLight; // 既定=初灯済(ロックなし)。A は 0 にして初灯チュートリアルを通す
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

// 現在シーンの全行を公開する(タップで一文ずつ→ヒントが消えるまで)
async function revealAll(page) {
  for (let i = 0; i < 15; i++) {
    if (!(await page.$('#storyBody .story-tap-hint'))) break;
    await page.click('#storyBody .story-text');
    await page.waitForTimeout(110);
  }
}

// 初灯チュートリアル(c01_040で起動する焚き火)を最後まで進める。fresh('takibi')=300msガードに合わせ待つ。
async function driveTutorial(page) {
  await page.click('#takibiBody [data-act="tut-start"]').catch(() => {});
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(360);
    if (await page.$('#takibiBody [data-act="tut-done"]')) { await page.click('#takibiBody [data-act="tut-done"]'); return true; }
    if (await page.$('#takibiBody [data-act="got"]')) { await page.click('#takibiBody [data-act="got"]'); continue; }
    if (await page.$('#takibiBody [data-act="open"]')) { await page.click('#takibiBody [data-act="open"]'); continue; }
    if (await page.$('#takibiBody .ichoice:not([disabled])')) { await page.click('#takibiBody .ichoice'); continue; }
    if (await page.$('#takibiBody [data-act="next"]')) { await page.click('#takibiBody [data-act="next"]'); continue; }
    if (await page.$('#takibi.hidden')) return true;
  }
  return false;
}

// ---- (A) 全画面リーダーで第1章を通しプレイ: 25シーン・挿絵5枚・主人公名置換 ----
{
  const page = await newPage(storyProfile(NAME, { firstLight: 0 })); // 初灯前=ロック&チュートリアルを通す
  await page.waitForSelector('#storyOv:not(.hidden)', { timeout: 4000 });
  const illustOk = {}; let nameShown = false, tokenLeak = false, akiLeak = false, reached180 = false, tutorialDone = false;

  for (let step = 0; step < 80; step++) {
    // c01_040 で物語リーダーが閉じ、初灯チュートリアル(焚き火)へ。完走したら物語(c01_050)に戻る。
    if (await page.$('#storyOv.hidden')) {
      if (await page.$('#takibi:not(.hidden)')) {
        const ok = await driveTutorial(page);
        tutorialDone = tutorialDone || ok;
        await page.waitForSelector('#storyOv:not(.hidden)', { timeout: 4000 }).catch(() => {});
        continue;
      }
      log('A) リーダー終了(ハブへ=読了/旅支度)'); break;
    }
    await revealAll(page);
    const artSrc = await page.$eval('#storyBody .story-art', (e) => e.getAttribute('src')).catch(() => null);
    const m = artSrc && artSrc.match(/scene_(c01_\d+)\.webp/);
    if (m) {
      await page.waitForFunction(() => { const i = document.querySelector('#storyBody .story-art'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 2000 }).catch(() => {});
      illustOk[m[1]] = await page.$eval('#storyBody .story-art', (e) => e.naturalWidth).catch(() => 0) > 0;
      if (ILLUST.includes(m[1])) await page.screenshot({ path: `/tmp/ch1_${m[1]}.png` });
      if (m[1] === 'c01_180') reached180 = true;
    }
    const txt = await page.$eval('#storyBody .story-text', (e) => e.textContent).catch(() => '');
    if (txt.includes(NAME)) nameShown = true;
    if (txt.includes('{name}')) tokenLeak = true;
    if (/おれはアキ|アキ「/.test(txt)) akiLeak = true;

    await page.waitForTimeout(400); // commitボタン出現直後の誤爆ガード(350ms)を超える
    const choice = await page.$('#storyBody [data-sact="choice"]');
    const next = await page.$('#storyBody [data-sact="next"]');
    if (step === 0 && next) log(`A) c01_002 行動ボタン: "${(await next.evaluate((e) => e.textContent.trim()))}"`);
    if (choice) await choice.click();
    else if (next) await next.click();
    else break;
    await page.waitForTimeout(200);
  }
  const flAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')).story.firstLight);
  log(`A) 初灯チュートリアル完走: ${tutorialDone} / firstLight=${flAfter}`);
  log(`A) 主人公名「${NAME}」表示: ${nameShown} / {name}残留: ${tokenLeak}(false期待) / アキ漏れ: ${akiLeak}(false期待)`);
  log(`A) 挿絵ロード: ${ILLUST.map((id) => `${id}=${illustOk[id] ? 'OK' : '✗'}`).join(' ')} / c01_180到達: ${reached180}`);
  if (!nameShown || tokenLeak || akiLeak || !reached180 || !tutorialDone || !flAfter) pass = false;
  for (const id of ILLUST) if (!illustOk[id]) pass = false;
  await page.context().close();
}

// ---- (B) 導入+命名(連打で名前入力を飛ばさないガード込み) ----
{
  const page = await newPage(defaultProfile());
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i++) { await page.mouse.click(195, 300); await page.waitForTimeout(120); }
  const hasInput = await page.$('#nameInput');
  log(`B) 命名フォーム表示: ${!!hasInput}`);
  if (hasInput) {
    await page.waitForTimeout(700); // フォーム出現直後はガードで確定不可(連打スキップ防止)
    await page.fill('#nameInput', 'ホシ');
    await page.screenshot({ path: '/tmp/ch1_intro_naming.png' });
    await page.click('#introGo');
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')));
    log(`B) playerName: ${st.playerName} / named: ${st.named} / intro: ${st.story.intro}`);
    if (st.playerName !== 'ホシ' || st.named !== true) pass = false;
  } else pass = false;
  await page.context().close();
}

// ---- (C) ✎フィードバック(物語リーダーの上から押せる=読み物中でもメモ) ----
{
  const page = await newPage(storyProfile(NAME));
  await page.waitForSelector('#storyOv:not(.hidden)', { timeout: 4000 });
  await page.click('#fbBtn');
  await page.waitForTimeout(400);
  log(`C) FB文脈: ${await page.$eval('.fb-where', (e) => e.textContent).catch(() => '(なし)')}`);
  await page.fill('#fbComment', 'ここの間が少し長く感じた(テスト)');
  await page.click('[data-fbtag="テンポ/間"]');
  await page.waitForTimeout(400);
  await page.click('[data-act="fb-add"]');
  await page.waitForTimeout(200);
  const count = await page.$$eval('.fb-item', (els) => els.length);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')).feedback);
  log(`C) メモ件数: ${count} / 保存tags: ${JSON.stringify(saved?.[0]?.tags)}`);
  await page.screenshot({ path: '/tmp/ch1_feedback.png' });
  if (count !== 1 || saved?.[0]?.tags?.[0] !== 'テンポ/間') pass = false;
  await page.context().close();
}

// ---- (D) 戻る: フロンティアから直前の既読シーンへ戻れる ----
{
  const p = storyProfile(NAME);
  p.scenario.read = { c01_002: 1, c01_004: 1, c01_006: 1, c01_010: 1 };
  p.scenario.scene = 'c01_015';
  const page = await newPage(p);
  await page.waitForTimeout(400);
  await page.click('[data-sheet="story"]'); // 読みかけ(sc.scene設定済)は自動オープンしないのでメニューから
  await page.waitForSelector('#storyOv:not(.hidden)', { timeout: 4000 });
  const before = await page.$eval('#storyBody .story-title', (e) => e.textContent);
  await page.click('#storyBody [data-sact="back"]'); // shown=1のフロンティア→直前既読(c01_010)へ
  await page.waitForTimeout(250);
  const after = await page.$eval('#storyBody .story-title', (e) => e.textContent);
  log(`D) 戻る: "${before}" → "${after}"`);
  // 進むで戻れること(読み返し→続きへ)
  await page.click('#storyBody [data-sact="fwd"]').catch(() => {});
  await page.waitForTimeout(250);
  const fwd = await page.$eval('#storyBody .story-title', (e) => e.textContent);
  log(`D) 進む: "${after}" → "${fwd}"`);
  if (before === after || after !== '屋根の上') pass = false;
  await page.context().close();
}

// ---- (E) 「すべて忘れる」→ 最初(導入/命名)から ----
// newPage は種を「未設定のときだけ」入れるので、reset が書く新規プロフィールはリロード後も生き、
// 本当に導入から始まる(実リロードを伴うので page.on('dialog') で confirm を承認する)。
{
  const page = await newPage(storyProfile(NAME));
  page.on('dialog', (d) => d.accept()); // confirm("本当にすべて忘れる?")
  await page.waitForTimeout(400);
  if (await page.$('#storyOv:not(.hidden)')) await page.click('#storyBody [data-sact="close"]').catch(() => {});
  await page.waitForTimeout(200);
  await page.click('[data-sheet="settings"]');
  await page.waitForTimeout(450);
  await page.click('[data-act="reset"]');
  await page.waitForTimeout(1200); // saveProfile(defaultProfile()) → 実 location.reload()
  const introVisible = await page.$('#intro:not(.hidden)') != null;
  const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('kotodama_reforge_v1')));
  log(`E) リセット→リロード後: 導入表示=${introVisible} / intro=${prof.story.intro} / named=${prof.named}`);
  if (!introVisible || prof.story.intro !== 0 || prof.named !== false) pass = false;
  await page.context().close();
}

await browser.close();
server.close();
log(errors.length ? `\n⚠ JSエラー:\n${errors.join('\n')}` : '\n✔ JSエラーなし');
log(pass && !errors.length ? '\n✅ 第1章 実機検収 PASS' : '\n❌ 第1章 実機検収 FAIL');
process.exit(pass && !errors.length ? 0 : 1);
