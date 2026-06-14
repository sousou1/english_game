// 自己QAループの自動プレイ＆撮影機。本番相当をheadlessで駆動し、要所を撮って manifest を出す。
// 出力: /tmp/qa_shots/NN_<label>.png ＋ /tmp/qa_shots/manifest.json
// 次工程: docs/playtest-persona-director.md の視点で vision レビュー(skill: qa-playtest)。
//   node tests/_qa_playtest.mjs   (サンドボックス無効で実行のこと)
import http from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { defaultProfile } from '../js/storage.js';
import { WORDS } from '../data/words.js';
import { newCard, review } from '../js/srs.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = '/tmp/qa_shots';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel); if (!fp.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await readFile(fp);
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(8355, r));
const BASE = 'http://localhost:8355/';

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
let browser; try { browser = await chromium.launch({ executablePath: exe }); } catch { browser = await chromium.launch(); }
const errors = [];
const manifest = [];
let n = 0;
async function shot(page, label, context) {
  const id = String(++n).padStart(2, '0');
  const file = `${id}_${label}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  manifest.push({ id, label, context, file });
  console.log(`  撮影 ${file}  (${context})`);
}

async function newPage(profile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  if (profile) await ctx.addInitScript(`{const K='kotodama_reforge_v1'; if(!localStorage.getItem(K)) localStorage.setItem(K, ${JSON.stringify(JSON.stringify(profile))}); }`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return page;
}

function freshProfile() { return null; } // 種なし=完全新規(導入から)

function midProfile() {
  const p = defaultProfile();
  p.story.intro = 99; p.story.firstLight = 1; p.named = true; p.playerName = 'アキ';
  p.facilities.fire = 1; p.gold = 8000; p.exp = 500; p.battle = { kills: 6, dmg: 0 };
  const t0 = Date.now() - 3 * 86400000;
  for (const w of WORDS.slice(0, 16)) p.cards[w.w] = review(newCard(t0), 2, t0);
  // 物語を c01_010 まで読んだ状態(挿絵シーンを再読できる)
  for (const id of ['c01_002', 'c01_004', 'c01_006']) p.scenario.read[id] = 1;
  p.scenario.scene = 'c01_010';
  p.scenario.read[require_ev_gate()] = 1; // イベント1本を解放
  return p;
}
function require_ev_gate() { return 'c01_050'; } // ev_c01_lights の gate.read

async function revealAll(page) {
  for (let i = 0; i < 15; i++) {
    if (!(await page.$('#storyBody .story-tap-hint'))) break;
    await page.click('#storyBody .story-text'); await page.waitForTimeout(110);
  }
}

// ========== シーケンス1: 完全新規(導入→命名→ロック物語→初灯チュートリアル) ==========
{
  const page = await newPage(freshProfile());
  await page.waitForTimeout(500);
  await shot(page, 'intro_mist', 'イントロ: 靄(1枚目・本文1行目)');
  for (let i = 0; i < 3; i++) { await page.mouse.click(195, 320); await page.waitForTimeout(150); }
  await shot(page, 'intro_mid', 'イントロ: 靄を払う途中(本文2行目)');
  for (let i = 0; i < 3; i++) { await page.mouse.click(195, 320); await page.waitForTimeout(150); }
  await page.waitForTimeout(300);
  await shot(page, 'naming', 'イントロ末: 命名フォーム');
  if (await page.$('#nameInput')) {
    await page.waitForTimeout(700);
    await page.fill('#nameInput', 'ソウ');
    await page.click('#introGo'); await page.waitForTimeout(600);
  }
  // ロックされた物語リーダー(c01_002)
  await page.waitForSelector('#storyOv:not(.hidden)', { timeout: 4000 }).catch(() => {});
  await revealAll(page);
  await shot(page, 'story_locked_c01_002', '初灯前のロック物語 c01_002(右上が🔒・✎が押せるか)');
  // 進んで挿絵+温度3択のシーン(c01_010)→さらに c01_040 の初灯チュートリアルまで
  for (let s = 0; s < 14; s++) {
    if (await page.$('#storyOv.hidden')) break;
    await revealAll(page);
    const title = await page.$eval('#storyBody .story-title', (e) => e.textContent).catch(() => '');
    if (title.includes('屋根の上')) { await shot(page, 'story_c01_010_choices', '挿絵シーン c01_010(温度3択・ボタン中央・挿絵)'); }
    await page.waitForTimeout(420);
    const choice = await page.$('#storyBody [data-sact="choice"]');
    const next = await page.$('#storyBody [data-sact="next"]');
    if (choice) await choice.click(); else if (next) await next.click(); else break;
    await page.waitForTimeout(220);
  }
  // c01_040 でチュートリアル起動
  if (await page.$('#takibi:not(.hidden)')) {
    await shot(page, 'tutorial_howto', '初灯チュートリアル: 手引き(覚える/詠める/罰なし)');
    await page.click('#takibiBody [data-act="tut-start"]').catch(() => {});
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(360);
      if (await page.$('#takibiBody [data-act="got"]')) { await shot(page, 'tutorial_study', '初灯: 意味カード(study・🔊)'); await page.click('#takibiBody [data-act="got"]'); continue; }
      if (await page.$('#takibiBody [data-act="open"]')) { await shot(page, 'tutorial_recall', '初灯: 想起(選択肢を開く前)'); await page.click('#takibiBody [data-act="open"]'); continue; }
      if (await page.$('#takibiBody .ichoice:not([disabled])')) { await page.click('#takibiBody .ichoice'); continue; }
      if (await page.$('#takibiBody [data-act="next"]')) { await page.click('#takibiBody [data-act="next"]'); continue; }
      if (await page.$('#takibiBody [data-act="tut-done"]')) { await shot(page, 'tutorial_done', '初灯: 灯った! 完了'); await page.click('#takibiBody [data-act="tut-done"]'); break; }
    }
    await page.waitForTimeout(500);
    await shot(page, 'story_after_firstlight', '初灯後 c01_050(ロック解除・✕が出る)');
  }
  await page.context().close();
}

// ========== シーケンス2: 中盤(本編メイン画面・シート・✎・イベント) ==========
{
  const page = await newPage(midProfile());
  await page.waitForTimeout(700);
  // 起動時に物語リーダーが開く場合は閉じる(firstLight済→✕で閉じられる)
  if (await page.$('#storyOv:not(.hidden)')) { await page.click('#storyBody [data-sact="close"]').catch(() => {}); await page.waitForTimeout(300); }
  await shot(page, 'main_battle', '本編メイン画面(ステータス/ステージ/お題/詠唱プール/メニュー)');
  // 設定シート
  await page.click('[data-sheet="settings"]'); await page.waitForTimeout(500);
  await shot(page, 'sheet_settings', '設定シート(命名変更/レベル/分野/フィードバック書出)');
  await page.click('#sheet .grabber').catch(() => {}); await page.waitForTimeout(300);
  // 呪文書
  await page.click('[data-sheet="spellbook"]').catch(() => {}); await page.waitForTimeout(500);
  await shot(page, 'sheet_spellbook', '呪文書シート(覚えた言葉一覧)');
  await page.click('#sheet .grabber').catch(() => {}); await page.waitForTimeout(300);
  // ✎ フィードバック(本編から)
  await page.click('#fbBtn').catch(() => {}); await page.waitForTimeout(450);
  await shot(page, 'feedback_panel', '✎ゲーム内フィードバック(タグ/コメント/JSON書出)');
  await page.click('#fbOv .grabber').catch(() => {}); await page.waitForTimeout(300);
  // イベント(解放されていれば)
  if (await page.$('#eventBanner:not(.hidden)')) {
    await page.click('#eventBanner'); await page.waitForTimeout(600);
    await shot(page, 'event_intro', 'イベント開幕(物語×穴埋め詠唱)');
    // 1ステップ進める
    if (await page.$('#eventBody [data-act="next"]')) { await page.click('#eventBody [data-act="next"]'); await page.waitForTimeout(500); await shot(page, 'event_step2', 'イベント2画面目'); }
  }
  await page.context().close();
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ generatedFor: 'docs/playtest-persona-director.md', base: BASE, shots: manifest }, null, 2));
await browser.close();
server.close();
console.log(`\n撮影 ${manifest.length} 枚 → ${OUT}/  (manifest.json)`);
console.log(errors.length ? `⚠ JSエラー(${errors.length}):\n${errors.join('\n')}` : '✔ JSエラーなし');
