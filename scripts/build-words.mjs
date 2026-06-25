#!/usr/bin/env node
// 語彙DB拡張パイプライン(段階1〜2)。
//   入力: 現 data/words.js(既存DB・source of truth) + data/gen/ext-*.json(段階拡張バッチ)
//   処理: マージ → w で重複排除(既存優先・衝突は報告して捨てる) → スキーマ検証 → 分布レポート
//   出力: data/words.js を再生成(append-only。既存語の順序・内容は不変、末尾に新語を追記)
// 規約(vocab-growth-design.md §3.1): 実在語・w一意・8系統/L1-5・ex/jx全充足。FSRSは語固有paramを持たないので語追加だけで整合。
// 使い方: node scripts/build-words.mjs [--write]   (--write 無しは検証のみ=dry-run)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORDS } from '../data/words.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIELDS = ['travel', 'daily', 'feelings', 'nature', 'school', 'food', 'business', 'society'];
const SCHEMA = ['w', 'p', 'j', 'l', 'f', 'ex', 'jx'];
const CAP_PER_FIELD = 625; // 5000/8。系統偏り上限の目安(§3.1)
const write = process.argv.includes('--write');

const fail = (m) => { console.error('NG: ' + m); process.exitCode = 1; };

// 1. 拡張バッチ読み込み(data/gen/ext-*.json)
const genDir = path.join(ROOT, 'data/gen');
const extFiles = fs.readdirSync(genDir).filter((f) => f.startsWith('ext-') && f.endsWith('.json'));
const incoming = [];
for (const f of extFiles) {
  const j = JSON.parse(fs.readFileSync(path.join(genDir, f), 'utf8'));
  for (const w of j.words) {
    // バッチ既定の level/field を継承(語側に l/f があればそれを優先)
    incoming.push({ ...w, l: w.l ?? j.level, f: w.f ?? j.field, _src: f });
  }
}

// 2. マージ + 重複排除(既存DB優先)
const byW = new Map(WORDS.map((w) => [w.w, w]));
const added = [];
const dropped = [];
for (const w of incoming) {
  if (byW.has(w.w)) { dropped.push(w); continue; }
  byW.set(w.w, w);
  added.push(w);
}

// 3. スキーマ検証(新語のみ厳格チェック)
for (const w of added) {
  const miss = SCHEMA.filter((k) => w[k] === undefined || w[k] === '');
  if (miss.length) fail(`${w._src}: "${w.w}" 欠落キー ${miss.join(',')}`);
  if (![1, 2, 3, 4, 5].includes(w.l)) fail(`${w._src}: "${w.w}" 位階 l=${w.l} が範囲外`);
  if (!FIELDS.includes(w.f)) fail(`${w._src}: "${w.w}" 系統 f=${w.f} が未定義`);
}

// 4. 全体分布レポート
const all = WORDS.concat(added.map(({ _src, ...rest }) => rest));
const fCount = {}, lCount = {};
for (const w of all) { fCount[w.f] = (fCount[w.f] || 0) + 1; lCount[w.l] = (lCount[w.l] || 0) + 1; }
for (const f of FIELDS) if ((fCount[f] || 0) > CAP_PER_FIELD) fail(`系統 ${f} が上限 ${CAP_PER_FIELD} を超過 (${fCount[f]})`);

console.log(`既存 ${WORDS.length} + 新規 ${added.length} = ${all.length} 語  (衝突で除外 ${dropped.length})`);
if (dropped.length) console.log('  除外:', dropped.map((w) => `${w.w}(${w._src})`).join(', '));
console.log('系統:', FIELDS.map((f) => `${f}=${fCount[f] || 0}`).join(' / '));
console.log('位階:', [1, 2, 3, 4, 5].map((l) => `L${l}=${lCount[l] || 0}`).join(' / '));

if (process.exitCode === 1) { console.error('検証 NG → 書き出しを中止'); process.exit(1); }

// 5. 書き出し(--write 時のみ)。既存行は1行=1語の現フォーマットを踏襲し、新語を末尾に追記。
if (write && added.length) {
  const line = (w) => '  ' + JSON.stringify({ w: w.w, p: w.p, j: w.j, l: w.l, f: w.f, ex: w.ex, jx: w.jx });
  const body = all.map(line).join(',\n');
  const out = `// 語彙DB。スキーマ {w,p,j,l,f,ex,jx}=語/品詞/和訳/位階(L1-5)/系統(8)/英例文/和例文。\n`
    + `// 生成: scripts/build-words.mjs(既存DB + data/gen/ext-*.json をマージ・重複排除・検証)。手編集より追記バッチ推奨。\n`
    + `export const WORDS = [\n${body}\n];\n`;
  fs.writeFileSync(path.join(ROOT, 'data/words.js'), out);
  console.log(`✓ data/words.js を書き出し(${all.length}語)`);
} else if (added.length) {
  console.log('（dry-run。反映するには --write）');
} else {
  console.log('新規語なし。');
}
