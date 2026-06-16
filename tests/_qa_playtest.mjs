// 自己QAループの自動プレイ＆撮影機(skill: qa-playtest)。本番相当を headless で駆動し、要所を撮って manifest を出す。
// 次工程: docs/playtest-persona-director.md の視点で vision レビュー。
//
// 実行: npm run qa:shots   (= node tests/_qa_playtest.mjs。サンドボックス無効で実行のこと)
// 出力: $QA_OUT または <OS一時ディレクトリ>/qa_shots/NN_<label>.png ＋ manifest.json
//
// 前提(どのPCでも動かすため):
//   - 依存: playwright-core(devDeps)。ブラウザ本体は同梱されないので一度だけ:  npx playwright install chromium
//   - Linuxで共有ライブラリ不足(libnspr4/libnss3 等)の場合:  sudo npx playwright install-deps chromium
//   - ブラウザの場所は playwright が自動解決。見つからない時は ms-playwright キャッシュを走査して救済する。
//   - 起動できない時は、上記セットアップ手順を表示して exit 1(原因を黙って握りつぶさない)。
import http from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchBrowser } from './_browser.mjs';
import { defaultProfile } from '../js/storage.js';
import { WORDS } from '../data/words.js';
import { newCard, review } from '../js/srs.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = process.env.QA_OUT || path.join(tmpdir(), 'qa_shots');
const PORT = Number(process.env.QA_PORT || 8355);
const STORE_KEY = 'kotodama_reforge_v1'; // js/storage.js の localStorage キー(据え置き)

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
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://localhost:${PORT}/`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// ブラウザ起動(マシン非依存)。共有ヘルパ tests/_browser.mjs に集約。
const browser = await launchBrowser({ onFail: () => server.close() });

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
  if (profile) await ctx.addInitScript(`{const K=${JSON.stringify(STORE_KEY)}; if(!localStorage.getItem(K)) localStorage.setItem(K, ${JSON.stringify(JSON.stringify(profile))}); }`);
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
  p.scenario.read['c01_050'] = 1; // ev_c01_lights の gate.read を満たし、イベント1本を解放
  return p;
}

async function revealAll(page) {
  for (let i = 0; i < 15; i++) {
    if (!(await page.$('#storyBody .story-tap-hint'))) break;
    await page.click('#storyBody .story-text'); await page.waitForTimeout(110);
  }
}
const titleOf = (page) => page.$eval('#storyBody .story-title', (e) => e.textContent).catch(() => '');

// 物語リーダーを「指定タイトルが出るまで」進める。出たら撮影してそのシーンに留まる(true)。閉じたら false。
async function advanceUntil(page, contains, label, ctxText, max = 16) {
  for (let s = 0; s < max; s++) {
    if (await page.$('#storyOv.hidden')) return false;
    await revealAll(page);
    const title = await titleOf(page);
    if (contains.some((c) => title.includes(c))) { if (label) await shot(page, label, ctxText); return true; }
    await page.waitForTimeout(420);
    const choice = await page.$('#storyBody [data-sact="choice"]');
    const next = await page.$('#storyBody [data-sact="next"]');
    if (choice) await choice.click(); else if (next) await next.click(); else return false;
    await page.waitForTimeout(220);
  }
  return false;
}

// ========== シーケンス1: 完全新規(導入→命名→ロック物語→初灯→戦闘チュートリアル) ==========
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
  // c01_004(ユイ井戸端・挿絵スロット)→ c01_010(温度3択・挿絵)→ c01_040(初灯)まで
  await advanceUntil(page, ['いつか谷の外へ'], 'story_c01_004_yui', 'c01_004 いつか谷の外へ(ユイ紹介の地の文＋挿絵スロット)', 4);
  await advanceUntil(page, ['屋根の上'], 'story_c01_010_choices', '挿絵シーン c01_010(温度3択・ボタン中央・挿絵はみ出し確認)', 6);
  await advanceUntil(page, ['__never__'], null, '', 10); // c01_040 のチュートリアル起動まで素通し
  // c01_040 で初灯チュートリアル起動
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
  // c01_050(3択)→ c01_055(灰の手先=戦闘チュートリアル)へ。出たら action で本編へ落とす。
  if (await advanceUntil(page, ['灰の手先'], 'story_c01_055_combat_tutorial', 'c01_055 戦闘チュートリアル(声は世界観のまま・action=灰の手先に立ち向かう)', 8)) {
    const combatAction = await page.$('#storyBody [data-sact="next"]');
    if (combatAction) {
      await page.waitForTimeout(420);
      await combatAction.click();
      await page.waitForTimeout(500);
      await shot(page, 'combat_tutorial_dropin', '戦闘導入: 本編へ落下後(お題バーspot＋ティッカー「お題タップ=攻撃/倒すと魔素」)');
    }
  }
  await page.context().close();
}

// ========== シーケンス2: 中盤(本編メイン画面・各シート・✎・イベント) ==========
{
  const page = await newPage(midProfile());
  await page.waitForTimeout(700);
  // 起動時に物語リーダー(挿絵フロンティア)が開くので、本文を出し切って✕で確実に閉じる(eventBadge等を覆わせない)
  for (let i = 0; i < 6 && (await page.$('#storyOv:not(.hidden)')); i++) {
    await revealAll(page);
    await page.click('#storyBody [data-sact="close"]', { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await shot(page, 'main_battle', '本編メイン画面(ステータス/ステージ/お題/詠唱プール/メニュー)');
  // 設定シート
  await page.click('[data-sheet="settings"]'); await page.waitForTimeout(500);
  await shot(page, 'sheet_settings', '設定シート(命名変更/レベル/分野/フィードバック書出)');
  await page.click('#sheet .grabber').catch(() => {}); await page.waitForTimeout(300);
  // 呪文書
  await page.click('[data-sheet="spellbook"]').catch(() => {}); await page.waitForTimeout(500);
  await shot(page, 'sheet_spellbook', '呪文書シート(覚えた言葉一覧)');
  await page.click('#sheet .grabber').catch(() => {}); await page.waitForTimeout(300);
  // 物語シート(イベント解放行/ゲート待ちヒント)
  await page.click('[data-sheet="story"]').catch(() => {}); await page.waitForTimeout(500);
  await shot(page, 'sheet_story', '物語シート(イベント解放行/ゲート待ちヒント)');
  await page.click('#sheet .grabber').catch(() => {}); await page.waitForTimeout(300);
  // ✎ フィードバック(本編から)
  await page.click('#fbBtn').catch(() => {}); await page.waitForTimeout(450);
  await shot(page, 'feedback_panel', '✎ゲーム内フィードバック(タグ/コメント/JSON書出)');
  await page.click('#fbOv .grabber').catch(() => {}); await page.waitForTimeout(300);
  // イベント(解放されていれば。バッジは #eventBadge)
  if (await page.$('#eventBadge:not(.hidden)')) {
    await page.click('#eventBadge', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
    await shot(page, 'event_intro', 'イベント開幕(物語×穴埋め詠唱)');
    for (let i = 0; i < 12; i++) {
      if (await page.$('#eventBody .ev-cast')) break; // cast(穴埋め詠唱)に到達したら止めて撮る
      const nx = await page.$('#eventBody [data-act="next"]') || await page.$('#eventBody [data-act="page"]');
      if (!nx) break;
      await nx.click(); await page.waitForTimeout(450);
    }
    if (await page.$('#eventBody .ev-cast')) await shot(page, 'event_cast', 'イベントcast(複数語=穴埋め行で統一・単語=英文cloze。空欄ごとに表示が化けないこと)');
  }
  await page.context().close();
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ generatedFor: 'docs/playtest-persona-director.md', base: BASE, out: OUT, shots: manifest }, null, 2));
await browser.close();
server.close();
console.log(`\n撮影 ${manifest.length} 枚 → ${OUT}/  (manifest.json)`);
console.log(errors.length ? `⚠ JSエラー(${errors.length}):\n${errors.join('\n')}` : '✔ JSエラーなし');
