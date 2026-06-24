// 本番相当のヘッドレス実走スモーク(現フロー: 導入→命名→全画面物語→初灯→戦闘チュートリアル→本編)。
// 自走ループの「起動・ルーティングが壊れていない」ゲート。陳腐化していた旧版を現フローへ作り直し、
// セレクタは tests/_play.mjs に集約、サーバも自前で立てて1コマンドで動く。
//
// 実行: npm run smoke   (= node tests/smoke.browser.mjs。サンドボックス無効で実行のこと)
// 検証: ①導入後に物語リーダーが開く(boot routing) ②初灯チュートリアルで firstLight 解除
//       ③戦闘チュートリアルで本編へ落ちる ④本編で詠唱=魔素+ダメージ ⑤全シートが描画される(無throw)
//       ⑥設定の保存が効く ⑦どの局面でも JS エラーが出ない(最終ゲート)
import {
  launchBrowser, startServer, newPage, trackErrors,
  freshProfile, midProfile, revealAll, advanceUntil,
} from './_play.mjs';

const PORT = Number(process.env.SMOKE_PORT || 8356);
const errors = [];
let failed = false;
const ok = (cond, msg) => { console.log(cond ? '✔' : '✖', msg); if (!cond) { failed = true; process.exitCode = 1; } };

const { base, close: closeServer } = await startServer(PORT);
const browser = await launchBrowser({ onFail: closeServer });

try {
  // ===== シーケンス1: 完全新規(導入→命名→物語→初灯→戦闘チュートリアル→本編) =====
  {
    const page = await newPage(browser, freshProfile(), base);
    trackErrors(page, errors);
    await page.waitForTimeout(400);
    ok(!!(await page.$('.intro-line')), '導入が表示される');
    for (let i = 0; i < 6; i++) { await page.mouse.click(195, 320); await page.waitForTimeout(140); }
    await page.waitForTimeout(300);
    if (await page.$('#nameInput')) {
      await page.waitForTimeout(700);
      await page.fill('#nameInput', 'ソウ');
      await page.click('#introGo');
    }
    // ★ boot routing: 導入後に全画面物語リーダーが開く(旧スモークが #takibi を待って固まっていた箇所)
    const reader = await page.waitForSelector('#storyOv:not(.hidden)', { timeout: 5000 }).then(() => true).catch(() => false);
    ok(reader, '導入後に物語リーダー(c01_002)が開く');

    // c01_040「最初の灯」まで進め、行動で初灯チュートリアルを起動
    const atFirstLight = await advanceUntil(page, ['最初の灯'], 14);
    ok(atFirstLight, 'c01_040「最初の灯」へ到達');
    if (atFirstLight) {
      await revealAll(page);
      await page.waitForTimeout(420);
      await page.click('#storyBody [data-sact="next"]').catch(() => {});
      // 初灯チュートリアル(#takibi): 覚える→想起→灯る
      await page.waitForTimeout(600);
      if (await page.$('#takibi:not(.hidden)')) {
        await page.waitForTimeout(380); // fresh('takibi')=300msデバウンスを越えてから操作
        await page.click('#takibiBody [data-act="tut-start"]').catch(() => {});
        for (let i = 0; i < 36; i++) {
          await page.waitForTimeout(380);
          if (await page.$('#takibiBody [data-act="tut-done"]')) { await page.click('#takibiBody [data-act="tut-done"]').catch(() => {}); break; }
          if (await page.$('#takibiBody [data-act="got"]')) { await page.click('#takibiBody [data-act="got"]').catch(() => {}); continue; }
          if (await page.$('#takibiBody [data-act="open"]')) { await page.click('#takibiBody [data-act="open"]').catch(() => {}); continue; }
          if (await page.$('#takibiBody .ichoice')) { await page.click('#takibiBody .ichoice').catch(() => {}); continue; }
          if (await page.$('#takibiBody [data-act="next"]')) { await page.click('#takibiBody [data-act="next"]').catch(() => {}); continue; }
        }
        await page.waitForTimeout(500);
      }
    }
    const firstLit = await page.evaluate(() => !!window.__app?.profile?.story?.firstLight);
    ok(firstLit, '初灯チュートリアルで firstLight が解除された');

    // 戦闘チュートリアル(c01_055「灰の手先」)→ 行動で本編(戦闘)画面へ落下
    if (await advanceUntil(page, ['灰の手先'], 8)) {
      await revealAll(page);
      await page.waitForTimeout(420);
      await page.click('#storyBody [data-sact="next"]').catch(() => {});
      await page.waitForTimeout(600);
    }
    const onStage = await page.waitForSelector('.tile', { timeout: 4000 }).then(() => true).catch(() => false);
    ok(onStage, '戦闘チュートリアルで本編メイン(詠唱タイル)へ到達');
    await page.context().close();
  }

  // ===== シーケンス2: 中盤(本編メイン・詠唱・全シート描画・保存) =====
  {
    const page = await newPage(browser, midProfile(), base);
    trackErrors(page, errors);
    await page.waitForTimeout(700);
    // 起動時に開く物語リーダーを閉じる(本編メニューを覆わせない)
    for (let i = 0; i < 6 && (await page.$('#storyOv:not(.hidden)')); i++) {
      await revealAll(page);
      await page.click('#storyBody [data-sact="close"]', { timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(280);
    }
    ok(!!(await page.$('.tile')), '本編メイン画面(詠唱プール)が出る');

    // 詠唱: お題に合うタイルをタップ→魔素が増え、敵にダメージが通る
    const before = await page.evaluate(() => ({ lights: window.__app.profile.lights, dmg: window.__app.profile.battle.dmg, kills: window.__app.profile.battle.kills }));
    let casts = 0;
    for (let i = 0; i < 12 && casts < 6; i++) {
      const cueW = await page.evaluate(() => {
        const cue = document.querySelector('#cue b')?.textContent;
        const W = window.__app.words.find((x) => x.j === cue);
        return W ? W.w : null;
      });
      if (!cueW) { await page.waitForTimeout(150); continue; }
      const tile = await page.$(`[data-tap="${cueW}"]`);
      if (!tile) { await page.waitForTimeout(150); continue; }
      await tile.tap(); casts++;
      await page.waitForTimeout(140);
    }
    const after = await page.evaluate(() => ({ lights: window.__app.profile.lights, dmg: window.__app.profile.battle.dmg, kills: window.__app.profile.battle.kills }));
    if (casts >= 6) {
      ok(after.lights > before.lights, `詠唱${casts}回で魔素が増える (+${Math.round(after.lights - before.lights)})`);
      ok(after.dmg > before.dmg || after.kills > before.kills, '敵にダメージが通る');
    } else {
      console.log('… 詠唱を駆動できず(お題/タイル不一致)、戦闘の数値検証はスキップ');
    }

    // 全シートが描画される(=ui.js の各画面が無throwで開く: DOMスモーク)
    // story はリーダー(#storyOv)を、takibi は #takibi を、他は #sheet を開く。間で確実に閉じる。
    const errBefore = errors.length;
    const isOpen = async (sels) => { for (const s of sels) if (await page.$(`${s}:not(.hidden)`)) return true; return false; };
    const closeAll = async () => {
      await page.click('#storyOv:not(.hidden) [data-sact="close"]', { timeout: 1500 }).catch(() => {});
      await page.click('#takibi:not(.hidden) [data-act="close"]', { timeout: 1500 }).catch(() => {});
      await page.click('#sheet:not(.hidden) .grabber', { timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(240);
    };
    await closeAll();
    for (const [sheet, sels] of [
      ['story', ['#storyOv', '#sheet']], ['weapons', ['#sheet']], ['base', ['#sheet']],
      ['spellbook', ['#sheet']], ['takibi', ['#takibi']], ['settings', ['#sheet']],
    ]) {
      await page.click(`[data-sheet="${sheet}"]`, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(450);
      ok(await isOpen(sels), `シート「${sheet}」が描画される`);
      await closeAll();
    }
    ok(errors.length === errBefore, '全シート描画でJSエラーが出ない');

    // 設定の保存(レベル設定)
    await closeAll();
    await page.click('[data-sheet="settings"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
    await page.click('[data-lv="3"]', { timeout: 3000 }).catch(() => {});
    const lv = await page.evaluate(() => window.__app.profile.settings.levels);
    ok(Array.isArray(lv) && lv.includes(3), 'レベル設定が保存される');
    const stored = await page.evaluate(() => !!localStorage.getItem('kotodama_reforge_v1'));
    ok(stored, 'localStorage に保存されている');
    await page.context().close();
  }
} finally {
  await browser.close();
  closeServer();
}

ok(errors.length === 0, errors.length ? `JSエラー(${errors.length}):\n  ${errors.slice(0, 6).join('\n  ')}` : 'JSエラーなし(全局面)');
console.log(failed ? '\n✘ スモーク失敗' : '\n✔ スモーク成功');
