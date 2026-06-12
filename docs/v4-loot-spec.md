# スペルライト v4 確定仕様 — 武器ハクスラ × ジョブ × パーティ 統合版

対象: `/mnt/c/Users/tamus/git/english_game`(根拠コード: `js/battle.js` / `js/pool.js` / `js/storage.js` / `js/economy.js` / `js/ui.js`、`data/words.js` の f属性8分野)
3設計(loot / job / party)を統合し、衝突箇所を裁定済み。本書が実装の単一ソース。

---

## 0. 統合原則と裁定(衝突解消)

既存不変条件 B2/B3/B5/B6/B7/B8 はすべて継承。3設計の J1〜J6・P1〜P4 を統合した上で、重なり合う箇所を以下のとおり裁定する。

| # | 裁定 | 内容 |
|---|---|---|
| R1 | 火力レイヤの3層分離 | **恒久部**(2^職位×語マイルストーン×コレクション×K_weapon)= vref追跡・放置従属/**腕前部**(コンボ・鮮度・ラッシュ・会心)= ジョブ補正が乗る/**有界後置部**(manaGain・分野ブースト・ヴェル×1.10)= gainの最終乗算、**vref非追跡** |
| R2 | 同一軸は常に加算合成 | ジョブ×武器特性×サブステ×仲間が同じパラメータに触れるときは加算のみ。乗算スタック禁止(J6) |
| R3 | 加算合成の総量キャップ | 会心: 総上限20%不変(既存critTotalCap)/会心ダメ: ×2基礎、上限×3/被ダメ軽減合計: 上限50%/ラッシュ上限延長合計: +8秒(18→最大26秒)/討伐ゴールド加算ボーナス合計: 上限+100% |
| R4 | 強化費割引 | 盗賊−10%とセシリア口利き−10%(絆Lv5で−15%)は加算、合成下限×0.75 |
| R5 | コンボ保護の優先順位 | ①CDガード(特性comboGuard+サブステでCD短縮、下限30秒)→ ②バルド筆談ガード(1回/戦)→ ③剣士の半減。上位が使えるとき下位は消費しない |
| R6 | 賢者=副え銘 | 「特性スロット+1」はハクスラ語彙で再定義: インベントリから副え銘1本を指定し、**その特性のみ**有効。倍率(atkBase×G×Lv×lb)とサブステは副え銘からは乗らない |
| R7 | 武器購入制の廃止 | ドロップ制へ全面移行。`weaponPrice(kills)`(直近中ボスHP)は**強化コストのアンカーP**として存続。ゴールドシンクは購入→強化に置換 |
| R8 | パーティ加入は実装章に追従 | 実装済みは第1章のみ → MVPの加入はノノ【文通】だけ。以降はシナリオフラグ優先+killsフォールバックで段階解禁(§4.1) |
| R9 | SRS不干渉 | armory / jobs / party は srs.js・schedule.js・quiz.js を読み書きしない(絆は定着語数S≥3の読み取りのみ、保存はラチェット最高値1整数) |
| R10 | 無罰 | ドロップ未開封は消失しない(回収箱)。撤退・誤答・放置で絆もジョブも下がらない。開封は必ず手動タップ(B6) |

---

## 1. 武器ハクスラ 確定仕様

### 1.1 ドロップ率・レアリティ・天井(確定値)

| 敵種 | ドロップ率 | N | R | SR | SSR | 演出 |
|---|---|---|---|---|---|---|
| 雑魚 | 30% | 62% | 30% | 7% | 1% | 小閃光 |
| 中ボス(5体ごと) | 100% | 25% | 45% | 25% | 5% | 青柱 |
| 章ボス1個目 | 100% | — | — | 80% | 20% | 紫柱+粒子 |
| 章ボス2個目 | 100% | — | 50% | 40% | 10% | 金柱+虹明滅+全画面グロー |

- ドロップ数 ≈ **4.4個/10討伐**(雑魚8×0.3+中ボス2)
- **pity=25**: SSRなしでドロップ25回→次は確定SSR。カウンタ永続、SSR排出でリセット。実効SSRペース ≈ 25ドロップ ≈ 57討伐 ≈ **10〜12日に1本**(5討伐/日)

### 1.2 グレード(アイテムレベル)と総倍率(確定数式)

```
g           = floor(討伐数/10)をドロップ時に焼き付け(以後不変)
G(g)        = 2^min(g,5) × 1.5^max(0, g−5)        … 旧K_weapon曲線と同一
atkBase     = N:0.85 / R:1.00 / SR:1.15 / SSR:1.30
mult(w)     = atkBase(rar) × G(w.grade) × (1 + 0.02×w.lv) × (1 + 0.03×w.lb)
K_codex     = 1 + 0.01 × min(30, 図鑑登録数)       … 銘×レア1エントリ、分解後も永続
K_weapon    = mult(装備中の1本) × K_codex           … pool.js globalMult() に乗る恒久部
```

陳腐化ペーシング(トレッドミル): 序盤は新地帯N(素)が2グレード前のSSR Lv20を超える(0.85×4=3.40 > 1.30×1.40×1.12=2.04)。後半(g>5)は約2.5グレード=25討伐で逆転 → **SSR寿命 ≈ 20〜30討伐 ≈ 4〜6日**。

### 1.3 強化(原神式 Lv0→20)

```
c(L) = max(10, round(0.02 × P × 1.2^L × cr))   L=0..19
P    = weaponPrice(kills) = 直近中ボスHP(既存関数を流用)
cr   = N:0.5 / R:0.75 / SR:1.0 / SSR:1.25
```

ペーシング検算(原設計の「2日でLv20」を修正): 収入 ≈ 1.5P/10討伐(成長期、ゴールド=HP×0.5の10体和)。SR Lv0→12 総額 ≈ 0.79P ≈ **1日で到達**(日々の進捗実感)、Lv12→20 が残り≈2.9P ≈ **追加4〜5日**(主力1本への投資判断)。Pは討伐数スケールなので収入/コスト比は永続的に一定。ノブ: costBase 0.02(0.016〜0.025)。

### 1.4 サブステ(Lv4/8/12/16/20 の5イベント)

- 空き枠あり→新規サブステ追加、満杯→既存ランダム1枠に追加ロール
- 初期数 N:0 / R:1 / SR:2 / SSR:3、上限枠 N:2 / R:3 / SR:4 / SSR:4
- ロール値 = max × {0.7, 0.8, 0.9, 1.0} 等確率。同種は同一武器内1枠
- プール(weight計92): critRate(max2.4%, w10)/critDmg(max16%, w10)/rushExt(max1.0s, w8)/freshExt(max0.4s, w8)/goldGain(max10%, w10)/manaGain(max6%, w6)/comboGuard(CD max−16s, w8, 基準CD90s・下限30s)/bossGuard(max−8%, w8)/field_×8分野(max12%, 各w3)— 分野はwords.jsのf属性 `daily/school/business/travel/nature/feelings/food/society` と1:1
- 上界: manaGain 6ロール=+36%、goldGain 6ロール=+60%(R3の+100%キャップ内)、field 6ロール=+72%(対象は語彙の1/8、実効≈+9%)

### 1.5 厳選ループ

- **限界突破**: 同銘・同レアを素材に lb+1(max4)。特性値5段階+基礎×(1+0.03×lb)。素材の投資ゴールド50%返却+砥石満額
- **分解**: 砥石 N:1/R:3/SR:10/SSR:30+投資ゴールド30%返却。図鑑エントリ永続(初回に明示トースト)
- **再錬**: 砥石SR:15個/SSR:25個で選択サブステ1枠を消去→新規1ロール(積みロール喪失=リスクある厳選)
- **インベントリ**: 30枠(装備中含む)+ロック+回収箱10。砥石50個で+5枠(最大50)。溢れは未ロック低レアから自動分解(砥石満額=無罰)

### 1.6 開封演出(ワクワクの開示順序)

討伐後300ms光柱 → R以上は1段下の色から400msごと「キン↑」昇格(SR2段/SSR3段+虹+vibrate([30,40,80]))→ **手動タップで開封**(カードフリップ350ms: シルエット→銘+特性→サブステを180ms間隔)→「装備する/しまう」→ NEW銘なら「図鑑+1%」トースト。戦闘中は画面下キューに積み、終了時未開封は回収箱へ(消失なし)。

### 1.7 JSONスキーマ(確定)

マスタ `data/weapons.js`(words.jsと同形式のJSモジュール):

```js
export const ARMORY = {
  schema: 1,
  types: ['staff','sword','dagger','bow','axe','tome','charm','kit'],
  rarities: {
    N:   { color:'#9aa0a6', atkBase:0.85, subInit:0, subMax:2, costMul:0.5,  whet:1,  pillar:null },
    R:   { color:'#4f8ef7', atkBase:1.00, subInit:1, subMax:3, costMul:0.75, whet:3,  pillar:'blue' },
    SR:  { color:'#b06ef7', atkBase:1.15, subInit:2, subMax:4, costMul:1.0,  whet:10, pillar:'purple' },
    SSR: { color:'#f7c84f', atkBase:1.30, subInit:3, subMax:4, costMul:1.25, whet:30, pillar:'gold' },
  },
  dropTable: {
    mob: { rate:0.30, rar:{ N:0.62, R:0.30, SR:0.07, SSR:0.01 } },
    mid: { rate:1.0,  rar:{ N:0.25, R:0.45, SR:0.25, SSR:0.05 } },
    chapter: { rate:1.0, count:2, rar:[{ SR:0.8, SSR:0.2 }, { R:0.5, SR:0.4, SSR:0.1 }] },
    pity: 25,
  },
  enhance: { maxLv:20, subLvs:[4,8,12,16,20], costBase:0.02, costGrowth:1.2,
             atkPerLv:0.02, rollTiers:[0.7,0.8,0.9,1.0] },
  codex: { perEntry:0.01, cap:0.30 },
  limitBreak: { max:4, atkPerLb:0.03, goldRefund:0.5 },
  salvage: { goldRefund:0.3 },
  reroll: { SR:15, SSR:25 },
  inventory: { cap:30, overflow:10, capExtend:{ whet:50, slots:5, max:50 } },
  caps: { dmgReduce:0.50, goldBonus:1.00, rushExtMs:8000, critDmgMult:3.0 }, // R3
  substats: [
    { id:'critRate',  name:'会心率',       max:0.024, fmt:'%',  w:10 },
    { id:'critDmg',   name:'会心ダメージ', max:0.16,  fmt:'%',  w:10 },
    { id:'rushExt',   name:'ラッシュ延長', max:1.0,   fmt:'s',  w:8 },
    { id:'freshExt',  name:'鮮度の窓',     max:0.4,   fmt:'s',  w:8 },
    { id:'goldGain',  name:'ゴールド獲得', max:0.10,  fmt:'%',  w:10 },
    { id:'manaGain',  name:'魔素獲得',     max:0.06,  fmt:'%',  w:6 },
    { id:'comboGuard',name:'コンボ保護',   max:16,    fmt:'-s', w:8, grantCd:90, floorCd:30 },
    { id:'bossGuard', name:'ボス被ダメ',   max:0.08,  fmt:'-%', w:8 },
    { id:'field_daily',name:'分野: 暮らし', max:0.12, fmt:'%', w:3 },
    // …school/business/travel/nature/feelings/food/society 同形(各w3)
  ],
  weapons: [ // 第1章プール。traitValはlb0..4の5段階
    { id:'w_oak',       name:'樫の杖',     icon:'🪄', type:'staff',  chapter:1, trait:null },
    { id:'w_dagger',    name:'旅装の短剣', icon:'🗡️', type:'dagger', chapter:1,
      trait:'comboGuard', traitVal:[60,50,40,30,20], traitDesc:'誤タップ保護(CD{v}秒)' },
    { id:'w_bluefire',  name:'蒼火の魔杖', icon:'🔱', type:'staff',  chapter:1,
      trait:'crit', traitVal:[0.04,0.05,0.06,0.07,0.08], traitDesc:'会心+{v}' },
    { id:'w_windbow',   name:'風詠みの弓', icon:'🏹', type:'bow',    chapter:1,
      trait:'rushExt', traitVal:[3,3.5,4,4.5,5], traitDesc:'ラッシュ上限+{v}秒' },
    { id:'w_moonsteel', name:'月鋼の剣',   icon:'⚔️', type:'sword',  chapter:1,
      trait:'freshExt', traitVal:[1,1.2,1.4,1.7,2], traitDesc:'速窓+{v}秒' },
    { id:'w_dragonbone',name:'竜骨の大杖', icon:'🦴', type:'staff',  chapter:1, rarMin:'SR',
      trait:'guard', traitVal:[0.25,0.30,0.35,0.40,0.45], traitDesc:'ボス被ダメ−{v}' },
    { id:'w_gai_axe',   name:'豪鉄の大斧', icon:'🪓', type:'axe',    chapter:1, rarMin:'SR',
      trait:'goldGain', traitVal:[0.10,0.13,0.16,0.20,0.25], traitDesc:'ゴールド+{v}' },
    { id:'w_verdiete',  name:'竜王杖ヴェルディート', icon:'🐲', type:'staff', chapter:1, rarMin:'SSR',
      trait:'rushMana', traitVal:[0.20,0.25,0.30,0.35,0.40], traitDesc:'ラッシュ中の魔素+{v}' },
  ],
};
```

プロファイル(`storage.js` defaultProfile に追加、**v:2→v:3**):

```js
p.armory = {
  inv: [{ uid:'a1b2c3', wid:'w_bluefire', rar:'SR', grade:4, lv:8, lb:1,
          spent:1240, subs:[{ id:'critRate', rolls:[0.9,0.8] }], lock:true,
          owner:null, droppedAt:43 }],
  equip: { len:'a1b2c3', sub:null },  // sub=賢者の副え銘uid(R6)
  box: [], whet: 0, codex: [], pity: 0, capExt: 0,
};
p.job = 'swordsman';
p.jobsUnlocked = ['swordsman'];
p.party = { active: [], unlocked: {}, bondPeak: {}, letterDay: '' };
```

関数シグネチャ(`js/armory.js` 新規):

```js
dropRoll(kills, kind, rng)  // → {wid, rar, grade}|null。pity処理込み
armoryMult(p)               // → K_weapon = mult(装備) × K_codex
equippedEffects(p)          // → {critRate, critDmg, rushExtMs, freshExtMs, goldGain, manaGain,
                            //    comboGuardCd, dmgReduce, fieldBoost:{daily:…}, rushMana}
                            //   = 装備特性 + サブステ + 副え銘特性(賢者) の加算合算、R3キャップ適用
enhanceCost(p, uid)         // weaponPrice(kills)流用、R4割引適用
enhance(p, uid) / limitBreak(p, uid, matUid) / salvage(p, uid)
reroll(p, uid, subIndex) / openDrop(p, boxIndex)
```

### 1.8 マイグレーション(戦力無損失)

旧所持本数 n = `p.weapons.length − 1`(初期装備0番除く)→ R武器 `{wid: 旧equip銘対応, rar:'R', grade:n, lv:0}` を1本付与し装備。**G(n) = 2^min(n,5)×1.5^max(0,n−5) = 旧weaponMultTotalと厳密一致**(旧×2×5本→×1.5の積そのもの)。旧所持銘は図鑑登録(+n%はおまけの上振れ)。equippedTraitは新武器traitに継承。`p.weapons`/`p.equip` は削除。

---

## 2. 総火力の健全性検算(統合版)

**成長勾配は G(g) のみが担う。** 10討伐あたり: ×2(g≤5)→ ln2/ln3.39=**0.567<1**、×1.5(g>5)→ ln1.5/ln3.39=**0.332<1**。旧「累積×2が5本→×1.5」と完全同一指数 = 検証済みペーシングを差分ゼロ継承。

**それ以外は全部「生涯有界の定数」**(全ゲーム期間に分散、漸近成長率に不寄与):

| レイヤ | 上界 | 備考 |
|---|---|---|
| 武器・非グレード部 | ×3.12 | (1.30/0.85)×1.40(Lv20)×1.12(lb4)×1.30(図鑑) |
| サブステ後置部 | ×1.48 | manaGain+36% × field実効+9% |
| パーティ | ×1.15 | ヴェル(闇)のみ。他の仲間は火力非接続 |
| ジョブ(腕前層) | ×1.12 | DPS差±12%以内(J5)、恒久部に不乗算 |
| **合成定数上界** | **×5.9** | 数年分のコンテンツに分散。勾配0.567/0.332は不変 |

**語彙経済が主役である証明**: 語彙側の可動域 = 職位2^5(×32)× 語マイルストーン2^5(×32)× コレクション2^7(×128)で、装備側定数×5.9の桁違い上。さらにグレードクロック(討伐数)自体がダメージ=タップ=語彙運用でしか進まない(B6)ため、武器成長は学習の従属変数。

**放置経済(I2)**: `p.vref` は base(=wordValue=恒久部、armoryMult内包)のみ追跡(pool.js:239 は変更不要)。ジョブ・パーティ・manaGain・fieldBoost・ヴェルは後置乗算で vref に入らない → CpM = V_ref×0.21×log2(1+P) は無検算で維持。

**ゴールド**: 収入(HP×0.5×ボーナス≤2.0)もコスト(P=中ボスHP建て)も同率成長 → 比率一定、インフレなし。盗賊+25%・セシリア+10%・goldGain+60%・豪鉄+25%が全部乗っても上限+100%(R3)。

---

## 3. ジョブ確定仕様(6種)

| ジョブ | 解禁 | 確定補正 | DPS |
|---|---|---|---|
| 🤺剣士 | 初期 | comboCap 50→**70**(上限×2.0→×2.4)+誤タップでコンボ**半減**(切捨て、0にしない) | +10% |
| 🧙魔導士 | 章ボス1(20体)撃破 | gaugeMax 25→**20**+chainWindowMs 45→**60秒** | +9% |
| 🏹狩人 | 定着語90(S≥3) | freshFast.mult 1.5→**1.7**/freshOk.mult 1.2→**1.3**(窓長不変) | +11% |
| 🥷盗賊 | 累計討伐40体 | 討伐ゴールド**+25%**+強化費**−10%**(R4) | ±0% |
| 📿僧侶 | 章ボス2(50体)撃破 | 討伐チャンス中、正解詠唱5回ごとに**HP+3%**(hpMax比)→ ボス生存65→85〜105秒 | ±0% |
| 🦉賢者 | 定着語250(S≥3) | **副え銘**(2本目の特性のみ有効、R6)+会心+2%(総上限20%内) | +7% |

ルール(確定): チェンジは**0G・即時・無制限**、`boss.engaged` 中のみ不可。ジョブ×武器の相性テーブルは**なし**(自然シナジーのみ: 剣士×短剣、狩人×月鋼、僧侶×竜骨、魔導士×風詠み)。同一軸は加算合成(R2)、既存キャップ不変。UI: ⚔武器屋シートにタブ **[武器|ジョブ]**(メニュースロット不増)。見た目: ヘッダLv横に職絵文字、光弾色=ジョブカラー(CSS変数1個)、audio.js音色差し替え(剣士square/魔導士sine/狩人triangle/僧侶sine+5度/盗賊square短/賢者sine+oct)。

`js/jobs.js`(新規 ~60行):

```js
export const JOBS = [
  { id:'swordsman', icon:'🤺', color:'#bfe3ff', unlock:{type:'init'},
    mods:{ comboCap:70, missHalvesCombo:true } },
  { id:'mage',   icon:'🧙', color:'#c9a0ff', unlock:{type:'kills', n:20},
    mods:{ gaugeMax:20, chainWindowMs:60000 } },
  { id:'hunter', icon:'🏹', color:'#a9e8b0', unlock:{type:'words', n:90},
    mods:{ freshFastMult:1.7, freshOkMult:1.3 } },
  { id:'thief',  icon:'🥷', color:'#e8c06a', unlock:{type:'kills', n:40},
    mods:{ goldMult:1.25, enhanceCostMult:0.9 } },
  { id:'cleric', icon:'📿', color:'#ffe9b0', unlock:{type:'kills', n:50},
    mods:{ healPer5:0.03 } },
  { id:'sage',   icon:'🦉', color:'#e0d4ff', unlock:{type:'words', n:250},
    mods:{ subBlade:true, critBonus:0.02 } },
];
export function jobMod(p, key, fallback) { /* 現職modsの値 or fallback */ }
```

解禁ペース: 剣士Day0/魔導士Day4-5/狩人Day7/盗賊Day8-9/僧侶Day10-11/賢者Day16-18 ≈ 2〜4日に1個の新しいおもちゃ。通知はログ1行+武器屋バッジ`!`のみ。

---

## 4. パーティ確定仕様「灯の同行者」

### 4.1 加入スケジュール(実装済み第1章と整合、フラグ優先+killsフォールバック)

| 時期 | 加入 | 形態 | 解禁条件(flag優先 / killsフォールバック) | フェーズ |
|---|---|---|---|---|
| 1章末 | ノノ | **文通同行** | c01_160手紙袋イベント既読 / kills≥20 | **MVP** |
| 3章 | ガイ | 同行 | 旧水路共闘フラグ / kills≥60 | M2 |
| 3章 | バルド | 後見(遠隔) | ギルド口利きフラグ / kills≥65 | M2 |
| 4章末 | セシリア | 後援(遠隔) | 決闘後フラグ / kills≥140 | M3 |
| 4章末 | ヴェル | 契約(編成不可・ログ乱入のみ) | 正式契約フラグ | M3 |
| 5章 | バルド | 同行へ昇格 | 5章実装に追従 | M3 |
| 6章末 | ノノ | 同行へ昇格(文通→リアルタイム回復) | 6章実装に追従 | M3 |
| 7章 | セシリア | 同行へ昇格(ルート不問・編成自由は奪わない) | 7章実装に追従 | M3 |
| 7章末 | ヴェル | 同行可(dark≥4のみ解錠) | 7章実装に追従 | M3 |
| 8章 | バルド | 筆談「笑え」へ変化(離脱なし) | 8章実装に追従 | M3 |

ノノ文通 = 「誰かを連れる」でなく「声を連れて行く」: 鐘(朝昼夜)の手紙既読で**当日最初の討伐チャンスの開始HP+15%**(絆Lv5で+20%)。第1章の既存演出をそのままパッシブ化するため、シナリオ改変ゼロで今日入る。

### 4.2 編成と効果(確定値)

- アクティブ同行**2人**(レン+2)、控えは「ギルドの寮」(効果ゼロ・絆保持・たまにログ一言)。入替は無料・即時・戦闘中以外
- 効果(パッシブ1+介入演出1、火力はヴェルのみ):

| キャラ | 常時 | 介入 | 絆Lv5 |
|---|---|---|---|
| ノノ(同行) | 討伐チャンス中15秒ごとHP回復=bossAtk×1.0(生存13発→約17発) | HP30%以下で1回/戦 即時bossAtk×2 | 間隔12秒 |
| ガイ | 被ダメ−15%(R3: 軽減合計50%でクランプ) | フィーバー突入時に追撃=直近平均タップ価値×5のHP削り、1回/戦。**魔素・灯火を生まない**(B2不汚染) | −20%、追撃×8 |
| セシリア | 討伐ゴールド+10%+店・強化費−10%(R4) | — | +15%/−15% |
| バルド(後見) | EXP+20%(B5安全: HP・会心のみ) | ボス開戦時その戦闘中会心+4% | EXP+30% |
| バルド(8章後) | 筆談コンボガード1回/戦(R5の順位②) | 討伐時筆談ボード(無音演出) | 2回/戦 |
| ヴェル(闇) | タップ価値×1.10(後置部、vref非追跡) | L4/L5語タップで紫エフェクト+皮肉 | ×1.15(上限)。同行中は他の掛け合いが消える=静寂(機構罰ゼロ) |

### 4.3 絆(学習接続・ラチェット式)

- 好物分野(words.js f属性1:1): ノノ=food・feelings/ガイ=nature・daily/バルド=travel・school/セシリア=business・society/ヴェル=分野不問L4-L5語
- 絆Lv閾値 = 好物2分野の定着語数(S≥3): **10/25/45/70/100語**。報酬=回想シーン+パッシブ微強化+Lv3でアイコン生成イラスト化。**火力報酬なし**。lapseで定着数が減っても表示Lvは到達最高値を保持(保存は `bondPeak` 整数のみ)
- 掛け合い: トリガー5種(開戦/結界破壊/HP50%/討伐/撤退)×各キャラ3行+ペア10行 ≈ 85行(上限120)。1.5秒トースト+ログ残留。撤退時は必ず無罰の声掛け

---

## 5. 既存コードへの差分(ファイル別)

### 5.1 `js/battle.js`

- **削除**: `WEAPONS` / `weaponAt()` / `weaponMultTotal()` / `equippedTrait()` / `weaponsAvailable()` / `Battle.buyWeapon()`
- **存続**: `weaponPrice(kills)`(強化コストアンカーPとして。L100-104そのまま)
- `critChance(level, weaponBonus)`: 呼び出し側が `equippedEffects(p).critRate + jobMod('critBonus',0) + バルド開戦バフ` を渡す(総上限20%は既存のまま)
- `applyDamage(dmg)`(L150): boss.engaged分岐に僧侶カウンタ追加 — 正解タップごとに `p.boss.castCount++`、5の倍数で `p.boss.hp = min(hpMax, hp + hpMax×jobMod('healPer5',0))`
- `finishKill()`(L177-188): `gold = round(hp × goldRate × (1 + min(1.0, goldBonus)))`、goldBonus = サブステgoldGain+盗賊0.25+セシリア0.10+豪鉄trait。ドロップ判定 `dropRoll()` を呼び、結果をUIキューへ
- `addExp(kind)`(L136): `p.exp += round(BATTLE.exp[kind] × (1 + バルドEXP補正))`
- `tick()`(L210-223): `if (equippedTrait(p)==='guard25') dmg×=0.75` → `dmg = round(dmg × (1 − min(0.50, equippedEffects(p).dmgReduce + ガイ軽減)))`。同所にノノ同行の15秒回復タイマー(M3)

### 5.2 `js/pool.js`

- import差し替え: `weaponMultTotal, equippedTrait` → `armoryMult, equippedEffects`(armory.js)+ `jobMod`(jobs.js)
- `globalMult()`(L85): `weaponMultTotal(p)` → `armoryMult(p)` の1語置換
- `comboMult()`(L98): `CURVE.comboCap` → `jobMod(p,'comboCap',50)`
- `ignite()`(L151): `cap = CURVE.fever.capMs + min(8000, trait_rushExt×1000 + サブステrushExt×1000)`(R3)。gaugeMax/chainWindowMs参照(L173, L165, L229)→ `jobMod()` 経由
- `tap()` 誤答分岐(L190-202): comboGuard判定を `equippedEffects().comboGuardCd`(特性CD or 基準90s−サブステ、下限30s)に置換 → ガード不可なら `missHalvesCombo ? combo=floor(combo/2) : combo=0`(R5)
- `tap()` 正解分岐(L216-222): `fastMs = freshFast.ms + effects.freshExtMs`、fresh倍率 = `jobMod('freshFastMult',1.5)` / `jobMod('freshOkMult',1.2)`。gain最終式に後置部を追加: `gain = max(1, round(base × comboMult × fresh × rush × critM × (1 + manaGain + fieldBoost[entry.f] + rushMana中) × velMult))`、critM = `crit ? min(3.0, 2 + critDmg) : 1`
- **L239 `p.vref` の行は変更しない**(baseのみ追跡=恒久部のみ。armoryMultはglobalMult経由で自動内包)

### 5.3 その他

- `js/storage.js`: defaultProfileに `armory/job/jobsUnlocked/party` 追加、`v:3`。loadProfileのv2分岐に§1.8マイグレーション
- `js/ui.js`: L331(guard表示)・L380/L589-612(武器屋購入UI)→ armoryインベントリ/強化/分解UIに置換。L418 `applyDamage` 呼び出しは不変。武器屋に[武器|ジョブ]タブ、ドロップキュー描画、開封フリップ
- 新規: `js/armory.js`(~250行)、`js/jobs.js`(~60行)、`js/party.js`(~120行)、`data/weapons.js`、`data/companions.js`
- **変更ゼロ**: `economy.js` / `srs.js` / `schedule.js` / `quiz.js`(R9の機械的保証)
- 回帰テスト追加(tests/): ①G(n)=旧weaponMultTotal一致(マイグレーション) ②全部盛り定数≤×5.9・パーティ≤×1.15 ③軽減合計≤50%・会心≤20%・gold≤+100% ④pity25でSSR確定 ⑤vrefにジョブ/後置部が混入しない

---

## 6. 実装フェーズ分割

### M1 — 今回MVP(これだけでPO要件の核「ハクスラ+ジョブ+仲間の芽」が立つ)

1. `data/weapons.js` + `js/armory.js`: ドロップ(率・レア・pity・グレード焼き付け)/装備/強化Lv20+サブステ/分解+砥石/図鑑/インベントリ30+回収箱(単純FIFO)
2. battle.js/pool.js差分(§5.1-5.2)と購入制撤去、マイグレーション(v:3)
3. 開封演出・簡易版: 光柱(色のみ)+カードフリップ+装備2択。バトル中キュー
4. ジョブ3種: 剣士(初期)/魔導士(20体)/狩人(定着90)+ jobs.js + 武器屋[ジョブ]タブ。MVP期間の解禁クロックに合う3種だけ入れる
5. パーティ: ノノ【文通】のみ(手紙既読→当日初回討伐チャンスHP+15%)。`party.js` は効果1個でも器を作る
6. 回帰テスト①〜⑤

### M2 — 厳選と中盤ジョブ(MVP安定後、2週目)

限界突破(重ね)/再錬/砥石枠拡張/盗賊(40体)・僧侶(50体)/開封演出フル(段階昇格音・vibrate・全画面グロー)/ガイ同行+バルド後見(killsフォールバック60/65)/掛け合い基盤(開戦・討伐・撤退の3トリガー)/絆ラチェット+回想Lv1-3/Day7シムで強化ペース・ドロップ圧・SSR寿命を検証(ノブ: costBase 0.016-0.025、atkBase幅0.80-1.40、pity 25)

### M3 — 章実装追従(シナリオ3章以降と同時進行)

賢者・副え銘(定着250)/セシリア後援→同行・ヴェル契約→闇同行・バルド昇格→筆談変化/ノノ同行(リアルタイム回復)/ペア掛け合い・絆Lv4-5回想/ジョブ別音色・光弾色・立ち絵差分/加入一枚絵(装備画面と画調共用)/仲間装備スロット(types: axe/kit等を消化、サブステ効果50%・倍率非加算)

**MVPから落とした理由**: 限界突破・再錬は被りが貯まるまで(≈2週)出番がない。盗賊・僧侶は解禁がDay8以降。パーティ同行は第1章に物理同行者がいない(文通が物語整合の唯一解)。賢者の副え銘はインベントリUIの成熟が前提。