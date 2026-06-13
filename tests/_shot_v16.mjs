// v16の新機能を実機描画で撮影する自己完結スクリプト。
// 静的サーバをこのプロセス内に建て、headless shellで撮る(サンドボックス無効で実行のこと)。
//   node tests/_shot_v16.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { defaultProfile } from '../js/storage.js';
import { newCard, review } from '../js/srs.js';
import { WORDS } from '../data/words.js';
import { EVENTS } from '../data/events.js';

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
await new Promise((r) => server.listen(8351, r));
const BASE = 'http://localhost:8351/';

function seedProfile({ kills = 0 } = {}) {
  const p = defaultProfile();
  p.story.intro = 99;
  p.facilities.fire = 1;
  p.scenario.read['c01_010'] = 1;
  p.scenario.read[EVENTS[0].gate.read] = 1;
  const t0 = Date.now() - 3 * 86400000;
  for (const w of WORDS.slice(0, 14)) p.cards[w.w] = review(newCard(t0), 2, t0);
  p.gold = 5000;
  p.battle = { kills, dmg: 0 };
  p.exp = 500;
  return p;
}

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const errors = [];

async function newPage(profile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(`localStorage.setItem('kotodama_reforge_v1', ${JSON.stringify(JSON.stringify(profile))})`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return page;
}
const log = (m) => console.log(m);

// ---- (A) Task4: イベントの新語cast=英文穴埋め ----
{
  const page = await newPage(seedProfile({ kills: 0 }));
  await page.click('#eventBanner').catch(() => {});
  await page.waitForTimeout(300);
  // lines/teach は next で進め、cast はタイルを総当たりで正答(誤答は無害・E3)。
  // .ev-cloze が出たら成功(beat1=open[非cloze]→door[cloze] の途中で出る)。
  let found = false;
  for (let i = 0; i < 80; i++) {
    if (await page.$('.ev-cloze')) { found = true; break; }
    const next = await page.$('#eventBody [data-act="next"]');
    if (next) { await next.click(); await page.waitForTimeout(160); continue; }
    const tiles = await page.$$eval('#eventBody [data-cast]', (els) => els.map((e) => e.dataset.cast)).catch(() => []);
    if (tiles.length) {
      // 現ptrの正答が分からないので一巡ずつ総当たり(正答だけ前進)
      for (const w of tiles) {
        const t = await page.$(`#eventBody [data-cast="${w}"]:not([disabled])`);
        if (t) { await t.click(); await page.waitForTimeout(110); }
        if (await page.$('.ev-cloze')) break;
      }
      continue;
    }
    break;
  }
  log(`A) ev-cloze 表示: ${found}`);
  if (found) {
    log(`   英文: ${await page.$eval('.ev-cloze', (e) => e.textContent)}`);
    log(`   和訳: ${await page.$eval('.ev-cloze-ja', (e) => e.textContent)}  / mark=${await page.$eval('.ev-cloze-ja mark', (e) => e.textContent).catch(() => '(なし)')}`);
  }
  await page.screenshot({ path: '/tmp/v16_A_cast_cloze.png' });
  await page.context().close();
}

// ---- (B) Task3/2: メイン周回の「お使い」皮 + drift ----
{
  const page = await newPage(seedProfile({ kills: 10 })); // k=10 → skin=errand(📦), 非ボス
  await page.waitForTimeout(400);
  log(`B) placeLbl: ${await page.$eval('#placeLbl', (e) => e.textContent)}`);
  log(`   enemyアイコン: ${await page.$eval('#enemy', (e) => e.textContent.trim())}`);
  log(`   HPバー文言: ${await page.$eval('#ehpPct', (e) => e.textContent)}`);
  // タイルを正答で連打して drift をトリガ(お題=cueの和訳に一致するタイルを w→j マップで特定)
  const J = new Map(WORDS.map((w) => [w.w, w.j]));
  for (let n = 0; n < 7; n++) {
    const cueJ = await page.$eval('#cue b', (e) => e.textContent).catch(() => null);
    const tiles = await page.$$('#poolGrid .tile');
    if (!tiles.length || !cueJ) break;
    let target = null;
    for (const t of tiles) { const w = await t.getAttribute('data-tap'); if (J.get(w) === cueJ) { target = t; break; } }
    await (target || tiles[0]).click();
    await page.waitForTimeout(240);
  }
  const drift = await page.$eval('#driftLine', (e) => ({ text: e.textContent, shown: e.classList.contains('show') })).catch(() => null);
  log(`   drift: ${JSON.stringify(drift)}`);
  await page.screenshot({ path: '/tmp/v16_B_errand_drift.png' });
  await page.context().close();
}

// ---- (C) 通常戦闘(回帰: 皮なしの素の画面) ----
{
  const page = await newPage(seedProfile({ kills: 0 }));
  await page.waitForTimeout(300);
  log(`C) placeLbl(通常): ${await page.$eval('#placeLbl', (e) => e.textContent)} / enemy: ${await page.$eval('#enemy', (e) => e.textContent.trim() || '(sprite)')}`);
  await page.screenshot({ path: '/tmp/v16_C_combat.png' });
  await page.context().close();
}

await browser.close();
server.close();
console.log(errors.length ? `\n⚠ JSエラー:\n${errors.join('\n')}` : '\n✔ JSエラーなし');
