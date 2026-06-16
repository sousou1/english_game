---
name: qa-playtest
description: 『ともしび』の自己QAループ。自動プレイ&スクショ→ディレクター(So)ペルソナでvision指摘→構造化出力。UI/フロー/手触りの粗を、人間が指摘しなくても自動で洗い出す。「QAプレイテスト」「自己点検」「自動指摘して」「playtestして」で使用。
---

# 自己QAプレイテスト・ループ

UI・フロー・手触りの粗は人間が指摘しなくても拾えるべき、という方針(ユーザー So の指示)に基づく自動QA。
**人間(So)は手触り感・情緒・物語の質に集中**し、機械的な粗はこのループが候補出しする。**採否・最終判断は常に人間**。

このskillは `english_game` リポジトリに同梱され、**マシン非依存**で動く。全コマンドは**リポジトリのルート**(この `package.json` のある場所)で実行する。絶対パスは前提にしない。

## 前提・セットアップ(初回のみ・どのPCでも)

撮影には Chromium が要る(`playwright-core` はブラウザ本体を同梱しない)。
```
npm ci                                   # 依存(playwright-core 等)
npm run qa:setup                         # = npx playwright install chromium(ブラウザ本体)
# Linuxで共有ライブラリ不足(libnspr4/libnss3 等)が出たら:
sudo npx playwright install-deps chromium    # 要 sudo
# Debian/Ubuntu 手動: sudo apt-get install -y libnspr4 libnss3 libasound2t64 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1
```
ブラウザが起動できない場合、harness は**この手順を表示して exit 1** する(原因を黙って握りつぶさない)。その時は上記を実行してから再試行。

## 手順

### 1. 自動プレイ＆撮影
```
npm run qa:shots                         # = node tests/_qa_playtest.mjs
```
- 本番相当を headless で駆動し、要所を撮影＋ `manifest.json` を出力。
- 出力先は `$QA_OUT`(未指定なら **OSの一時ディレクトリ/`qa_shots/`**。Linuxなら `/tmp/qa_shots/`)。ポートは `$QA_PORT`(既定8355)。
- カバー範囲(2シーケンス): ①完全新規=導入→命名→ロック物語→**c01_004(ユイ井戸端)**→c01_010(温度3択・挿絵)→初灯チュートリアル→**c01_055(戦闘チュートリアル)→本編へ落下(お題spot＋ティッカー)**。 ②中盤=本編メイン→設定/呪文書/物語シート→✎→**イベントcast(穴埋め表示)**。
- **JSエラーが出たら、その時点で実装バグ。先に直す**(harness末尾に件数と内容を表示)。
- 流れ/シーン/セレクタが変わったら、harness(`tests/_qa_playtest.mjs`)の操作シーケンスも追従更新する。タイトル一致で進む `advanceUntil()` を使うとシーン追加に強い。要素IDは `index.html`/`js/ui.js` が正(例: イベントは `#eventBadge`)。

### 2. ペルソナでvisionレビュー(並行サブエージェント)
- 指摘レンズ＝ **`docs/playtest-persona-director.md`**(ディレクター So。軸 A没入/B手触り/CモバイルUX/Dテンポ/E学習設計/F物語)。
- `manifest.json` のショットを **3〜4分割して `general-purpose`(または `Explore`)サブエージェントを並行起動**(Agent を1メッセージで複数呼ぶ)。各エージェントに:
  - 必読＝`docs/playtest-persona-director.md`。
  - 担当ショットの**絶対パス**とラベル(manifestの `out` + `file`)。
  - 出力＝**厳密なJSON配列のみ**(地の文なし)。各要素 `{shot, axis, severity, symptom, cause, fix, good}`。
  - 「症状名は診断名でない」=因果と直し方まで。静止画で断定できない手触り/情緒は `axis:"F", severity:"low"` で『人間へ要確認』。良い点も少し拾う(過剰差し戻し防止)。
- **スクショが撮れない環境**(CI/ブラウザ不可)では、変更箇所のコード/テキストを同じ軸A〜Fで分析レビューし、視覚案件は `status:"human-visual"` で残す(完全な代替ではない旨を明記)。

### 3. 集約
- 返却JSONを1つに統合し、`docs/qa/auto-findings-<YYYY-MM-DD>.json` に保存(`axisLegend`・`swVersion`・`scope` 付き)。
- high → medium → low で並べ、読みやすい要約をユーザーに提示。

### 4. 修正と回帰
- **high・low-riskな機械的修正**(誤った素材・明確なレイアウト崩れ・タップ標的の重なり・表示の不整合等)は実装する。
- **判断を要するもの**(挿絵の採否・大きなレイアウト方針・情緒)はユーザーに委ね、`status:"human-*"` で残す。
- 修正後は `npm run qa:shots` を再実行して回帰。`node tests/_shot_ch1.mjs`(機能回帰・ブラウザ要)と `npm test`(ユニット82件・ブラウザ不要)も通す。

## 注意
- これは**遊び手(中2)ペルソナ**(`docs/playtest-persona-2026-06-13.md`)とは別。こちらは**作り手の手触り基準**。
- game-feel の用語・チェックは `docs/game-feel-jank-catalog.md` / `docs/game-feel-audit.md` に準拠(入力因果/偽タイマー/凍結テンポ税)。
- 死守事項(誤答罰なし・説教禁止・8行上限・経済不変・主人公を極力映さない・操作説明はUI層/声は世界観のまま)を破る指摘が出たら最優先で直す。
