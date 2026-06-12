// v4新UIの実走行プローブ: 武器庫(開封/装備/強化/分解)・ジョブ切替・ノノの手紙・開発者モード
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { defaultProfile } from '../js/storage.js';
import { newCard, review } from '../js/srs.js';
import { WORDS } from '../data/words.js';

// 中盤プレイヤーの想定プロフィール: 討伐20体(魔導士解禁・ノノ加入)、語彙5語、軍資金あり
const p = defaultProfile();
p.story.intro = 99;
p.scenario.read['c01_010'] = true;
const t0 = Date.now() - 3 * 86400000;
for (const w of WORDS.slice(0, 5)) p.cards[w.w] = review(newCard(t0), 2, t0);
p.battle.kills = 20;
p.gold = 500000;
p.armory.box.push(
  { wid: 'w_verdiete', rar: 'SSR', grade: 2, uid: 'probe_ssr' },
  { wid: 'w_dagger', rar: 'R', grade: 1, uid: 'probe_r' },
);

const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(`localStorage.setItem('kotodama_reforge_v1', ${JSON.stringify(JSON.stringify(p))})`);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const ok = (c, m) => { console.log(c ? '✔' : '✖', m); if (!c) process.exitCode = 1; };
const closeSheet = async () => { await page.touchscreen.tap(195, 60); await page.waitForTimeout(350); };

await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });
await page.waitForSelector('#enemy', { timeout: 5000 });
ok(true, '注入プロフィールで導入スキップ起動');

// 自分のHPが常時見える(今回の修正点)
const hpText = await page.evaluate(() => document.querySelector('#stHp')?.textContent || '');
ok(/❤\d+\/\d+/.test(hpText), `ステータスバーに自HP表示 (${hpText})`);
const jobText = await page.evaluate(() => document.querySelector('.stat')?.textContent || '');
ok(jobText.includes('🤺'), 'ジョブアイコンがステータスに出る');

// ---- 武器庫: 開封→装備→強化→分解 ----
await page.tap('[data-sheet="weapons"]');
await page.waitForTimeout(400);
let body = await page.evaluate(() => document.querySelector('#sheetBody')?.textContent || '');
ok(body.includes('? ? ?'), '回収箱に未開封ドロップが見える');
ok(body.includes('天井'), '天井カウンタの説明がある');
await page.tap('[data-open="probe_ssr"]');
await page.waitForTimeout(400);
const inv = await page.evaluate(() => window.__app.profile.armory.inv.map((w) => `${w.wid}:${w.rar}:${w.subs.length}`));
ok(inv.some((s) => s.startsWith('w_verdiete:SSR:3')), `SSR開封で初期サブステ3つ (${inv.join(' / ')})`);
await page.waitForTimeout(350);
const ssrUid = await page.evaluate(() => window.__app.profile.armory.inv.find((w) => w.wid === 'w_verdiete')?.uid);
await page.tap(`[data-equip="${ssrUid}"]`);
await page.waitForTimeout(400);
const equipped = await page.evaluate(() => window.__app.profile.armory.equip);
ok(equipped === ssrUid, '開封したSSRを装備できた');
// 強化4回 → サブステ4つ目が付く(SSR subMax=4)
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(350);
  await page.tap(`[data-enh="${ssrUid}"]`);
}
await page.waitForTimeout(300);
const enh = await page.evaluate(() => {
  const w = window.__app.profile.armory.inv.find((x) => x.uid === window.__app.profile.armory.equip);
  return { lv: w.lv, subs: w.subs.length };
});
ok(enh.lv === 4 && enh.subs === 4, `強化Lv4でサブステイベント (Lv${enh.lv}, subs=${enh.subs})`);
// 残りのR武器を開封→分解
await page.waitForTimeout(350);
await page.tap('[data-open="probe_r"]');
await page.waitForTimeout(400);
const rUid = await page.evaluate(() => window.__app.profile.armory.inv.find((w) => w.wid === 'w_dagger')?.uid);
const whetBefore = await page.evaluate(() => window.__app.profile.armory.whet);
await page.tap(`[data-salv="${rUid}"]`);
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({ whet: window.__app.profile.armory.whet, codex: window.__app.profile.armory.codex.length }));
ok(after.whet > whetBefore, `分解で砥石+${after.whet - whetBefore}`);
ok(after.codex >= 3, `図鑑が残る (${after.codex}件)`);

// ---- ジョブ: 討伐20体で魔導士解禁→切替 ----
await page.tap('[data-tab="jobs"]');
await page.waitForTimeout(400);
body = await page.evaluate(() => document.querySelector('#sheetBody')?.textContent || '');
ok(body.includes('魔導士') && body.includes('狩人'), 'ジョブ一覧が見える');
await page.tap('[data-job="mage"]');
await page.waitForTimeout(400);
const job = await page.evaluate(() => window.__app.profile.job);
ok(job === 'mage', '魔導士に転職できた(討伐20体で解禁)');
const hunterDisabled = await page.evaluate(() => document.querySelector('[data-job="hunter"]')?.disabled);
ok(hunterDisabled === true, '未解禁ジョブ(狩人)は選べない');
await closeSheet();

// ---- ノノの手紙(kills20で文通開始) ----
await page.tap('[data-sheet="story"]');
await page.waitForTimeout(450);
const letterBtn = await page.$('[data-act="letter"]');
ok(!!letterBtn, '物語シートに💌手紙ボタンが出る');
if (letterBtn) {
  await letterBtn.tap();
  await page.waitForTimeout(400);
  const buff = await page.evaluate(() => window.__app.profile.party.letterBuff);
  ok(buff === true, '手紙を読むと初ボスHP+15%バフが付く');
}
await closeSheet();

// ---- 開発者モード: ×100で詠唱ゲインが跳ねる ----
await page.tap('[data-sheet="settings"]');
await page.waitForTimeout(450);
const devChip = await page.$('[data-dev="100"]');
ok(!!devChip, '設定に開発者モード×100チップがある');
await devChip.tap();
await page.waitForTimeout(300);
const mult = await page.evaluate(() => window.__app.profile.dev.mult);
ok(mult === 100, '×100が保存される');
const skipBtn = await page.$('[data-skip="86400000"]');
await skipBtn.tap();
await page.waitForTimeout(400);
ok(true, '+1日スキップがエラーなく動く');
await closeSheet();

// ×100タップ検証
await page.waitForSelector('.tile', { timeout: 3000 });
const lightsBefore = await page.evaluate(() => window.__app.profile.lights);
let cast = false;
for (let i = 0; i < 8 && !cast; i++) {
  const cueW = await page.evaluate(() => {
    const cue = document.querySelector('#cue b')?.textContent;
    const W = window.__app.words.find((x) => x.j === cue);
    return W ? W.w : null;
  });
  const tile = cueW ? await page.$(`[data-tap="${cueW}"]`) : null;
  if (tile) { await tile.tap(); cast = true; }
  else await page.waitForTimeout(200);
}
await page.waitForTimeout(200);
const lightsAfter = await page.evaluate(() => window.__app.profile.lights);
ok(cast && lightsAfter - lightsBefore >= 100, `開発者モード×100でゲイン増幅 (+${Math.round(lightsAfter - lightsBefore)})`);

if (errors.length) ok(false, `ブラウザエラー:\n${errors.slice(0, 5).join('\n')}`);
else ok(true, 'コンソールエラーなし');

await page.screenshot({ path: '/tmp/v4_probe.png' });
await browser.close();
