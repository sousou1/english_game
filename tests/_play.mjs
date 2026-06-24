// 共有プレイ・ハーネス: 本番相当を headless で駆動するための土台(現フローのセレクタを1箇所に集約)。
// QAスクショ(_qa_playtest.mjs)とスモーク(smoke.browser.mjs)が共用し、UI変更時の追従を一元化する。
// 現フロー: 導入(#intro)→命名(#introGo)→全画面ストーリーリーダー(#storyOv/#storyBody)→
//   初灯チュートリアル(#takibi)→戦闘チュートリアル(c01_055)→本編(.tile/#cue)。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './_browser.mjs';
import { defaultProfile } from '../js/storage.js';
import { WORDS } from '../data/words.js';
import { newCard, review } from '../js/srs.js';

export { launchBrowser };
export const STORE_KEY = 'kotodama_reforge_v1'; // js/storage.js の localStorage キー(据え置き)
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// 自前の静的サーバ(ループバック)。npm run serve を別に立てなくても1コマンドで動く。
export async function startServer(port) {
  const server = http.createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
      const fp = path.join(ROOT, rel); if (!fp.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const buf = await readFile(fp);
      res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
      res.end(buf);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => server.listen(port, r));
  return { server, base: `http://localhost:${port}/`, close: () => server.close() };
}

// 完全新規(導入から)。種なし。
export function freshProfile() { return null; }

// 中盤プロフィール(本編メイン画面・戦闘・各シートを検証する状態)。
export function midProfile() {
  const p = defaultProfile();
  p.story.intro = 99; p.story.firstLight = 1; p.named = true; p.playerName = 'アキ';
  p.facilities.fire = 1; p.gold = 8000; p.exp = 500; p.battle = { kills: 6, dmg: 0 };
  const t0 = Date.now() - 3 * 86400000;
  for (const w of WORDS.slice(0, 16)) p.cards[w.w] = review(newCard(t0), 2, t0);
  for (const id of ['c01_002', 'c01_004', 'c01_006']) p.scenario.read[id] = 1;
  p.scenario.scene = 'c01_010';
  p.scenario.read['c01_050'] = 1; // ev_c01_lights の gate.read を満たし、イベント1本を解放
  return p;
}

export async function newPage(browser, profile, base) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  if (profile) await ctx.addInitScript(`{const K=${JSON.stringify(STORE_KEY)}; if(!localStorage.getItem(K)) localStorage.setItem(K, ${JSON.stringify(JSON.stringify(profile))}); }`);
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000); // 操作/待機の既定上限(既定30sだと、覆われた/無い要素で各30s固まる)。明示指定で個別に上書き。
  await page.goto(base, { waitUntil: 'networkidle' });
  return page;
}

// pageerror / console.error を配列に集める(404は無視)。テスト側で errors.length を最終ゲートにする。
export function trackErrors(page, errors) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });
}

// ストーリーリーダー: 未公開の一文をすべて出し切る(フロンティアの▾タップ送り)。
export async function revealAll(page) {
  for (let i = 0; i < 15; i++) {
    if (!(await page.$('#storyBody .story-tap-hint'))) break;
    await page.click('#storyBody .story-text'); await page.waitForTimeout(110);
  }
}

export const titleOf = (page) => page.$eval('#storyBody .story-title', (e) => e.textContent).catch(() => '');

// 物語リーダーを「指定タイトルが出るまで」進める。出たら true(そのシーンに留まる)。閉じたら false。
export async function advanceUntil(page, contains, max = 16) {
  for (let s = 0; s < max; s++) {
    if (await page.$('#storyOv.hidden')) return false;
    await revealAll(page);
    const title = await titleOf(page);
    if (contains.some((c) => title.includes(c))) return true;
    await page.waitForTimeout(420);
    const choice = await page.$('#storyBody [data-sact="choice"]');
    const next = await page.$('#storyBody [data-sact="next"]');
    if (choice) await choice.click(); else if (next) await next.click(); else return false;
    await page.waitForTimeout(220);
  }
  return false;
}
