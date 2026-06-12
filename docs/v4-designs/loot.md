# 武器ハクスラ化 設計仕様 v1 — ドロップ+原神式ランダム強化

対象: /mnt/c/Users/tamus/git/english_game(js/battle.js の WEAPONS / weaponMultTotal / weaponPrice / buyWeapon を置換、js/pool.js の globalMult / equippedTrait 参照を差し替え)

## 0. 設計原則(既存不変条件の継承)
- 学習が火力の主役。武器は「増幅」のみ。SRS・誤答没収には一切触れない(B3)
- ドロップ開封は必ず手動タップ(B6: プレイヤー起点)。未開封は消失しない(没収なし)
- 健全性条件: 武器由来の倍率成長/10討伐 < コスト成長 1.13^10=3.39
- 購入制(10討伐ごと購入権)は廃止 → ドロップ制へ。ゴールドの行き先は「購入」から「強化」に置換(シンク総量は維持)

## 1. ドロップ
### 1.1 ドロップ率
| 敵種 | ドロップ率 | 備考 |
|---|---|---|
| 雑魚 | 30% | |
| 中ボス(5体ごと) | 100% | |
| 章ボス(20/50/90/140) | 100%×2個 | 1個目はSR以上確定 |

→ 約4.4個/10討伐(雑魚8×0.3 + 中ボス2)。

### 1.2 レアリティ排出率と色
| | N | R | SR | SSR | 色 | 光柱 |
|---|---|---|---|---|---|---|
| 雑魚 | 62% | 30% | 7% | 1% | #9aa0a6 灰 | なし(小閃光) |
| 中ボス | 25% | 45% | 25% | 5% | #4f8ef7 青 | 青柱 |
| 章ボス1個目 | — | — | 80% | 20% | #b06ef7 紫 | 紫柱+粒子 |
| 章ボス2個目 | — | 50% | 40% | 10% | #f7c84f 金 | 金柱+虹明滅+全画面グロー |

### 1.3 天井(pity)
SSRが出ないままドロップ25回 → 次のドロップはSSR確定。カウンタは永続保存、SSR排出でリセット。自然期待値は1/36ドロップなので実効はほぼ天井駆動: SSR≈25ドロップ≈57討伐≈10〜12日に1本(ゴールドペース「10討伐≈2日」基準)。

### 1.4 グレード(ハクスラのアイテムレベル)
ドロップ時に g = floor(討伐数/10) を武器に焼き付け(以後不変)。新ゾーンの武器は古い武器を陳腐化させる=トレッドミル。目安: 新地帯のN(素)は2グレード前のSSR(Lv20)を上回る。SSRの寿命≈20〜30討伐≈4〜6日(短ければ atkBase の幅を 0.80〜1.40 に広げて調整)。

## 2. 基礎値と総倍率(累積×2システムの置換)
### 2.1 攻撃倍率は「装備中1本+図鑑」構造
```
G(g)        = 2^min(g,5) × 1.5^max(0, g−5)          … グレード曲線(旧K_weapon曲線と同一)
mult(w)     = atkBase(rar) × G(w.grade) × (1 + 0.02×w.lv) × (1 + 0.03×w.lb)
K_weapon    = mult(装備中の1本) × K_codex
K_codex     = 1 + 0.01 × min(30, 図鑑登録数)         … 銘×レアごと1エントリ、分解しても永続
```
atkBase: N=0.85 / R=1.00 / SR=1.15 / SSR=1.30。強化はLv20で×1.40、限界突破lb4で×1.12、図鑑は上限×1.30。

### 2.2 健全性の証明
- 時間とともに伸びるのは G(g) のみ: ×2/10討伐(g≤5)→ ln2/ln3.39=0.567<1、×1.5/10討伐(g>5)→ 0.33<1。**旧「累積×2が5本→×1.5」と完全に同じ指数**(検証済みペーシングを差分ゼロ継承)
- その他の係数は生涯有界: (1.30/0.85)×1.40×1.12×1.30 ≈ ×3.12 を全ゲーム期間に分散 → 漸近成長率を変えない
- 放置従属: p.vref が K_weapon を自動内包+log2圧縮(既存機構のまま、I2不変)

## 3. 原神式ランダム強化(Lv0→20、ゴールド消費)
### 3.1 コスト式
```
c(L) = max(10, round(0.02 × P × 1.2^L × cr))   L=0..19、P=weaponPrice(kills)(既存: 直近中ボスHP)
cr   = N:0.5 / R:0.75 / SR:1.0 / SSR:1.25
```
SR総額 = 0.02×Σ1.2^L ≈ 3.7P ≈ 旧武器1本(3W)= 約2日でSR1本がLv20。Pは討伐数スケールなので収入/コスト比は旧仕様と同じく不変。

### 3.2 サブステイベント(Lv4/8/12/16/20 の5回)
- 空き枠あり → 新規サブステをランダム追加。満杯 → 既存ランダム1枠に追加ロール
- 初期サブステ数: N=0 / R=1 / SR=2 / SSR=3、上限枠: N=2 / R=3 / SR=4 / SSR=4(SSRは初期3+新規1+強化4回=最も伸びる)
- ロール値 = max値 × {0.7, 0.8, 0.9, 1.0}(等確率)。同一武器内で同種サブステは1枠(ロール重複で成長)

### 3.3 サブステプール(weight合計92)
| id | 名称 | 1ロール幅(max×tier) | weight | 備考 |
|---|---|---|---|---|
| critRate | 会心率 | +1.2〜2.4% | 10 | 総上限20%は既存エンジンが担保 |
| critDmg | 会心ダメージ | +8〜16% | 10 | 基礎×2、上限×3 |
| rushExt | ラッシュ上限 | +0.5〜1.0秒 | 8 | capMsに加算 |
| freshExt | 鮮度の速窓 | +0.2〜0.4秒 | 8 | |
| goldGain | 討伐ゴールド | +5〜10% | 10 | |
| manaGain | 魔素獲得 | +3〜6% | 6 | 直接火力なので低weight。最大+36%(6ロール)で有界 |
| comboGuard | コンボ保護 | CD−8〜16秒 | 8 | 付与時に基準CD90秒、下限30秒 |
| bossGuard | ボス被ダメ | −4〜8% | 8 | |
| field_food 等8種 | 分野ブースト | その分野の語+6〜12% | 各3(計24) | words.jsの f: food/daily/society/business/school/feelings/nature/travel |

## 4. 厳選ループ
- **限界突破(重ね)**: 同銘・同レアを素材に lb+1(max4)。特性値が5段階上昇(例: 会心4/5/6/7/8%、被ダメ軽減25/30/35/40/45%)+基礎×(1+0.03×lb)。素材側の投資ゴールド50%返却+砥石満額
- **分解**: 砥石 N=1 / R=3 / SR=10 / SSR=30 + 投資ゴールド30%返却。図鑑エントリは永続(分解の罪悪感を除去、初回に明示トースト)
- **再錬(砥石の使い道)**: SR=15個 / SSR=25個で、選んだサブステ1枠を消去→新規ランダム1ロール(積みロールは失う=リスクある厳選)。砥石50個で在庫+5枠(最大50)
- **インベントリ**: 上限30(装備中含む)+ロック可。満杯時は回収箱(10)へ、溢れは未ロック低レアから自動分解(砥石は満額)

## 5. ワクワク演出(開示順序)
1. 討伐後300ms: **光柱**が立つ。R以上は1段下の色から開始し、400msごとに「キン↑」(音程上昇)で昇格演出 — SRは2段階、SSRは3段階昇格+虹明滅+画面外周グロー+vibrate([30,40,80])
2. **タップで開封**(B6: 手動起点): カード裏→フリップ350ms→①武器種シルエット→②銘+特性→③初期サブステを1枚ずつフリップ(180ms間隔)
3. 「装備する/しまう」2択。装備で攻撃力数字がカウントアップロール
4. NEW銘なら「図鑑+1%(永続)」トースト
5. バトル非妨害: 光柱は画面下のキューに積まれ、戦闘終了時に未開封のまま回収箱へ(消失なし)

## 6. JSONデータ構造
### 6.1 マスタ(data/weapons.js、words.jsと同形式のJSモジュール)
```js
export const ARMORY = {
  schema: 1,
  types: ['staff','sword','dagger','bow','axe','tome','charm','kit'], // ジョブ/仲間と対応
  rarities: {
    N:   { color:'#9aa0a6', atkBase:0.85, subInit:0, subMax:2, costMul:0.5,  whet:1,  pillar:null },
    R:   { color:'#4f8ef7', atkBase:1.00, subInit:1, subMax:3, costMul:0.75, whet:3,  pillar:'blue' },
    SR:  { color:'#b06ef7', atkBase:1.15, subInit:2, subMax:4, costMul:1.0,  whet:10, pillar:'purple' },
    SSR: { color:'#f7c84f', atkBase:1.30, subInit:3, subMax:4, costMul:1.25, whet:30, pillar:'gold' },
  },
  dropTable: {
    mob:     { rate:0.30, rar:{ N:0.62, R:0.30, SR:0.07, SSR:0.01 } },
    mid:     { rate:1.0,  rar:{ N:0.25, R:0.45, SR:0.25, SSR:0.05 } },
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
  substats: [
    { id:'critRate',  name:'会心率',        max:0.024, fmt:'%',  w:10 },
    { id:'critDmg',   name:'会心ダメージ',  max:0.16,  fmt:'%',  w:10 },
    { id:'rushExt',   name:'ラッシュ延長',  max:1.0,   fmt:'s',  w:8 },
    { id:'freshExt',  name:'鮮度の窓',      max:0.4,   fmt:'s',  w:8 },
    { id:'goldGain',  name:'ゴールド獲得',  max:0.10,  fmt:'%',  w:10 },
    { id:'manaGain',  name:'魔素獲得',      max:0.06,  fmt:'%',  w:6 },
    { id:'comboGuard',name:'コンボ保護',    max:16,    fmt:'-s', w:8, grantCd:90, floorCd:30 },
    { id:'bossGuard', name:'ボス被ダメ',    max:0.08,  fmt:'-%', w:8 },
    { id:'field_food',     name:'分野: たべもの', max:0.12, fmt:'%', w:3 },
    { id:'field_daily',    name:'分野: せいかつ', max:0.12, fmt:'%', w:3 },
    { id:'field_society',  name:'分野: しゃかい', max:0.12, fmt:'%', w:3 },
    { id:'field_business', name:'分野: しごと',   max:0.12, fmt:'%', w:3 },
    { id:'field_school',   name:'分野: がっこう', max:0.12, fmt:'%', w:3 },
    { id:'field_feelings', name:'分野: きもち',   max:0.12, fmt:'%', w:3 },
    { id:'field_nature',   name:'分野: しぜん',   max:0.12, fmt:'%', w:3 },
    { id:'field_travel',   name:'分野: たび',     max:0.12, fmt:'%', w:3 },
  ],
  // 銘マスタ(第1章プール例。chapterでドロップ章を限定、traitValはlb0..4の5段階)
  weapons: [
    { id:'w_oak',      name:'樫の杖',       icon:'🪄', type:'staff',  chapter:1, rarMin:'N',
      trait:null },
    { id:'w_dagger',   name:'旅装の短剣',   icon:'🗡️', type:'dagger', chapter:1,
      trait:'comboGuard', traitVal:[60,50,40,30,20], traitDesc:'誤タップ保護(CD{v}秒)' },
    { id:'w_bluefire', name:'蒼火の魔杖',   icon:'🔱', type:'staff',  chapter:1,
      trait:'crit',       traitVal:[0.04,0.05,0.06,0.07,0.08], traitDesc:'会心+{v}' },
    { id:'w_windbow',  name:'風詠みの弓',   icon:'🏹', type:'bow',    chapter:1,
      trait:'rushExt',    traitVal:[3,3.5,4,4.5,5],   traitDesc:'ラッシュ上限+{v}秒' },
    { id:'w_moonsteel',name:'月鋼の剣',     icon:'⚔️', type:'sword',  chapter:1,
      trait:'freshExt',   traitVal:[1,1.2,1.4,1.7,2], traitDesc:'速窓+{v}秒' },
    { id:'w_dragonbone',name:'竜骨の大杖',  icon:'🦴', type:'staff',  chapter:1, rarMin:'SR',
      trait:'guard',      traitVal:[0.25,0.30,0.35,0.40,0.45], traitDesc:'ボス被ダメ−{v}' },
    { id:'w_gai_axe',  name:'豪鉄の大斧',   icon:'🪓', type:'axe',    chapter:1, rarMin:'SR',
      trait:'goldGain',   traitVal:[0.10,0.13,0.16,0.20,0.25], traitDesc:'ゴールド+{v}' },
    { id:'w_verdiete', name:'竜王杖ヴェルディート', icon:'🐲', type:'staff', chapter:1, rarMin:'SSR',
      trait:'rushMana',   traitVal:[0.20,0.25,0.30,0.35,0.40], traitDesc:'ラッシュ中の魔素+{v}' },
  ],
};
```

### 6.2 プロファイル(storage.js: p.weapons/p.equip を p.armory に置換、schema v3→v4)
```js
p.armory = {
  inv: [{
    uid:'a1b2c3',          // crypto.randomUUID()短縮
    wid:'w_bluefire',      // 銘マスタID
    rar:'SR',
    grade:4,               // floor(討伐数/10) ドロップ時固定
    lv:8, lb:1,            // 強化Lv、限界突破
    spent:1240,            // 投資ゴールド累計(返却計算用)
    subs:[ { id:'critRate', rolls:[0.9,0.8] }, { id:'goldGain', rolls:[1.0] } ],
    lock:true, owner:null, droppedAt:43,
  }],
  equip: { len:'a1b2c3' },          // キャラ別装備(将来: nono/cecilia/gai…、仲間はサブステ効果50%・倍率非加算)
  box: [],                          // 回収箱(未開封ドロップ、上限10)
  whet: 12,                         // 砥石
  codex: ['w_bluefire:SR'],         // 図鑑(永続)
  pity: 17, capExt: 0,
};
```

### 6.3 関数シグネチャ(js/armory.js 新規)
```js
dropRoll(kills, kind, rng)   // → { wid, rar, grade } | null。pity処理込み
armoryMult(p)                // → K_weapon。pool.js globalMult() の weaponMultTotal を置換
equippedEffects(p, owner)    // → { critRate, critDmg, rushExt, freshExt, goldGain, manaGain,
                             //     comboGuardCd, bossGuard, fieldBoost:{food:…} } 特性+サブステ合算
enhanceCost(p, uid)          // → c(L)。weaponPrice(kills) を内部利用
enhance(p, uid)              // ゴールド消費→lv+1、subLvsならサブステイベント、結果を返す
limitBreak(p, uid, matUid) / salvage(p, uid) / reroll(p, uid, subIndex) / openDrop(p, boxIndex)
```

## 7. マイグレーション(戦力無損失)
旧所持本数 n = p.weapons.length − 1(初期装備0番を除く)として、R武器1本 { wid: 旧equipの銘対応, rar:'R', grade:n, lv:0 } を付与し装備。G(n) = 2^min(n,5)×1.5^max(0,n−5) は旧 weaponMultTotal と厳密一致(旧仕様の×2×5本→×1.5の積そのもの)。旧所持銘は図鑑に登録(+n%)。equippedTrait は新武器のtraitとして継承。

## 8. チューニングノブ(Day7シムで監視)
- SSR寿命が短い → atkBase幅を0.80〜1.40へ / 長い → 1.5側へ縮める
- 強化ペース → costBase 0.02(総額3.7P)を0.016〜0.025で調整
- ドロップ圧 → 雑魚30%とインベントリ30枠の比(分解1回/セッションが理想)
- pity 25は実効SSRペースの支配項。子どもの体感は「2週間に1回の金柱」が初期値