// 共有: マシン非依存の Chromium 起動(QAハーネス/スクショ系で共用)。
// playwright-core はブラウザ本体を同梱しないので、playwright の自動解決を試し、
// だめなら ms-playwright キャッシュを走査。最後まで失敗したらセットアップ手順を表示して exit 1。
import { chromium } from 'playwright-core';
import { homedir, platform } from 'node:os';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

async function findChromiumBinaries() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(homedir(), '.cache', 'ms-playwright'),
    path.join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
  ].filter(Boolean);
  const wantExe = platform() === 'win32';
  const names = new Set(wantExe
    ? ['chrome.exe', 'chrome-headless-shell.exe']
    : ['chrome', 'chrome-headless-shell', 'Chromium', 'Google Chrome for Testing']);
  const found = [];
  async function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) await walk(fp, depth + 1);
      else if (names.has(e.name)) found.push(fp);
    }
  }
  for (const r of roots) await walk(r, 0);
  return found.sort((a, b) => (b.includes('headless') - a.includes('headless')) || b.localeCompare(a));
}

// 起動できなければ手順を表示して exit 1(onFail で server.close() 等の後始末を渡せる)。
export async function launchBrowser({ onFail } = {}) {
  try { return await chromium.launch(); } catch (e0) {
    for (const exe of await findChromiumBinaries()) {
      try { return await chromium.launch({ executablePath: exe }); } catch { /* 次の候補へ */ }
    }
    console.error('\n✘ Chromium を起動できませんでした。セットアップ:');
    console.error('    npm run qa:setup                           # = npx playwright install chromium');
    console.error('    sudo npx playwright install-deps chromium   # Linuxの共有ライブラリ(要sudo)');
    console.error('    # Debian/Ubuntu 手動: sudo apt-get install -y libnspr4 libnss3 libasound2t64 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1');
    console.error('\n原因:', e0.message.split('\n')[0]);
    try { onFail?.(); } catch { /* ignore */ }
    process.exit(1);
  }
}
