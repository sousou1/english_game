# v6 — 複数語ビート+新語供給のイベント限定化

v5-event-design.md の差分仕様。2026-06-13実装・検証済み。

> **2026-06-19 B2 更新(表示のみ・データ形式は不変)**: ユーザ方針「複数単語で一度に覚えるのをやめる」。
> 複数語castも**1語ずつ英文cloze**で表示するようにした(ui.js: useCloze から `entries.length===1` ガードを撤去)。
> いま埋める対象語 `cur` の英文clozeを出し、複数語は下に進捗(`.ev-blank`)を添える。前提として**全イベント語を
> clozeable 化**(例文に語の原形を含む・`data/words.js` の10語の例文を原形へ修正)し、`tests/invariants.test.js`
> の「イベントの新語はすべて clozeable」で担保(=旧 shine="shines" 不一致の和文フォールバック切替バグを恒久封じ)。
> teach/cast の**データ形式(複数語ビート)は不変**。反芻(review)ビートは従来どおり累積復習のまま。

## 変更点
1. **複数語ビート**: teach:['open','door'] + cast:{jp, answers:['open','door']}。
   - 左の空欄から順に埋める(js/events.js answer() の ptr)。部分正解で空欄が埋まり、
     使用済み選択肢はグレーアウト(ui.js renderEventStep の cast 分岐、.ev-choice.used)。
   - jp の日本語文は answers の順に語の意味が左→右で現れるように書く(データ規約)。
   - 選択肢総数は tier 基準(4/6)を維持: ディストラクタ数 = max(2, n - answers数)。
2. **新語供給はイベント限定**: 呪文書シートの「新しい呪文を編む」(招く)UIを撤去。
   workshop.invite 関数・テスト・チュートリアル3語(water/apple/sun)は維持。
3. **第1章6イベントを8語/本に増量**(計48語、全語 data/words.js に実在・重複なし・チュートリアル語除外):
   - fire: open door wind window river moon help scared
   - road: hungry bread eat fruit tree drink walk tired
   - gate: arrive city rule people money lost ask map
   - work: grocery kitchen sweep wash boil serve busy salary
   - codex: ancient book read write study knowledge emotion miss (tier2)
   - oath: honest star sky wave friendship courage confidence pride (tier2)
   - 各イベント: 2語ビート×3 + 1語ビート×2 + 反芻×2。
4. **クリアボーナス追加**: 初回クリアで詠唱ラッシュゲージ即満タン(pool.fillGauge()。
   ラッシュ中は何もしない)。既存の gold(敵HP×1.5)+確定ドロップは不変。

## 難易度再シミュレーション(tests/_sim_v6.mjs)
1日30分(1260タップ)+焚き火全消化(正答85%)、武器・ラッシュ・タップマイルストーン抜きの保守的モデル:

| day | 語彙 | settled(S≥3) | 討伐累計 | 判定 |
|---|---|---|---|---|
| 3 | 51 | 0 | 19 | 全イベント消化 |
| 4 | 51 | 19 | 21 | 章ボス(20体)通過 |
| 6 | 51 | 40+ | 24 | **c02ゲート到達** |

- c02ゲート settled:40 ≦ 供給51(チュートリアル3+イベント48)。78%の定着が必要だが、
  焚き火を回していれば day6 で自然到達。詰みなし。
- 収集マイルストーン50語は全6イベント消化でぴったり到達(51≥50)→「全イベントを遊ぶ」動機になる。
- 注意: 第2章でも供給はイベント限定のままなので、c02のイベント執筆時も8語/本を目安に
  次章ゲートを供給語数の8割以下に置くこと。
