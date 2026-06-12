// v1(塔)のセーブデータがv2(工房)に正しく移行されるか
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
const exe = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ok = (c, m) => { console.log(c ? '✔' : '✖', m); if (!c) process.exitCode = 1; };

// アプリのスクリプトが走る前にv1プロフィールを仕込む
await ctx.addInitScript(() => {
  if (window.__seeded) return;
  window.__seeded = true;
  const now = Date.now();
  localStorage.setItem('kotodama_reforge_v1', JSON.stringify({
    v: 1,
    settings: { levels: [2, 3], fields: ['daily', 'food'], newPerDay: 8, listen: true, autoSpeak: true, rate: 0.9, difficulty: 1 },
    cards: {
      water: { S: 12, D: 4, last: now - 86400000 * 3, due: now - 86400000, reps: 5, lapses: 0 },
      apple: { S: 2.5, D: 5, last: now - 86400000 * 4, due: now - 86400000, reps: 1, lapses: 1 },
    },
    pendingNew: [], chests: [], streak: { count: 7, best: 9, lastDay: '2026-06-11' },
    stats: { runs: 4, wins: 2, reviews: 60, correct: 48, byDay: {} }, created: now - 86400000 * 7,
  }));
});

const page = await ctx.newPage();
await page.goto(process.argv[2] || 'http://localhost:8347/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const r = await page.evaluate(() => {
  const p = window.__app.profile;
  return {
    v: p.v, cards: Object.keys(p.cards).length, S: p.cards.water?.S,
    levels: p.settings.levels, streak: p.streak.count, fire: p.facilities.fire,
    introSkipped: p.story.intro >= 99,
    verbs: document.querySelector('#verbs')?.textContent || '',
    placeShown: !document.querySelector('#place')?.classList.contains('hidden'),
  };
});
ok(r.v === 2, `v2に移行 (v=${r.v})`);
ok(r.cards === 2 && r.S === 12, `言霊の記憶を引き継ぎ (${r.cards}体, water S=${r.S})`);
ok(r.levels.join() === '2,3', `設定を引き継ぎ (Lv${r.levels})`);
ok(r.streak === 7, `たね火を引き継ぎ (${r.streak}日)`);
ok(r.fire === 1 && r.introSkipped, '既習者は火の入った工房から始まる(導入スキップ)');
ok(r.verbs.includes('起こす'), `期日の言霊が[起こす]に出ている (${r.verbs.trim()})`);
ok(r.placeShown, '工房の見出しが見えている');
await browser.close();
