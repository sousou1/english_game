# GOAL: v16入力モード演出の修正(drift位置 / お使い・移動のダメージ表現)

直前セッションで実装した入力モード拡張(sw v16)の、実機スクショで見つかった2点の演出不具合を直す。
世界観・数式・学習不変条件(B2/B3/B6・E1〜E4)は不変。**演出のみ**の修正。

## 背景(必読)
- `js/ui.js` の `skinOf` / `renderStage`(非ボス遭遇の move/errand 皮)、`poolTap`(正答処理・`dmgPop`・`showDrift`)、
  `#driftLine`(ふわっと文章)。`style.css` の `.drift-line`。
- 実機検証ハーネス: `tests/_shot_v16.mjs`(Node内に静的サーバを建て headless で撮る。
  **サンドボックスがloopbackを403遮断するため `dangerouslyDisableSandbox` で実行**)。出力 `/tmp/v16_*.png`。
- 直近コミット: `b1ae9aa`(機能), `93c3301`(検証ハーネス)。

## 直すこと
1. **driftの位置**: `.drift-line` がステージ下端でイベントバナー(`#eventBanner`)や帯(`#band`)と重なる。
   重ならない位置に調整(例: stage中央〜上寄せ、または表示中はバナーを避ける/暗くする)。
   受入: お使い/移動中に drift がはっきり読め、他UIと重ならない。
2. **お使い・移動時のダメージ表現**: move/errand の皮なのにタップで「-N」のダメージポップ+敵ヒット演出(hitfx)が出て
   不自然(箱を殴る/道を殴る絵になる)。move/errand 時は進捗の手応えに変える:
   - `dmgPop` を「-N」でなく前進表現に(例 move=「+N歩」/ errand=「+N」運んだ手応え、または記号)。
   - 敵ヒットの `hitfx` シェイクは、皮のときは進捗パルス的な穏やかな演出にするか抑制。
   - combat(通常戦闘)の表現は一切変えない。
   受入: move/errand のタップ手応えが「進む/運ぶ」に読め、通常戦闘は従来どおり。

## 検証(必須)
- `npm test` 全グリーン(73)。全JSパース。
- `tests/_shot_v16.mjs` を `dangerouslyDisableSandbox` で実行し、A(cast cloze)/B(お使い+drift)/C(通常戦闘)を撮影。
  Bで drift が他UIと重ならず、ダメージ表現が進捗系になっていることを目視確認(スクショをユーザーに共有)。
- `sw.js` の VERSION を v17 に上げる。

## 仕上げ
- `github-second:sousou1/english_game.git` に commit & push(通常push)。
- 変更点とBefore/Afterスクショを報告して終了。
- セッション名は日本語で「入力モード演出の修正(v16)」に揃える(`/rename`)。
