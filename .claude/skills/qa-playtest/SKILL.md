---
name: qa-playtest
description: 『ともしび』の自己QAループ。自動プレイ&スクショ→ディレクター(So)ペルソナでvision指摘→構造化出力。UI/フロー/手触りの粗を、人間が指摘しなくても自動で洗い出す。「QAプレイテスト」「自己点検」「自動指摘して」「playtestして」で使用。
---

# 自己QAプレイテスト・ループ

UI・フロー・手触りの粗は人間が指摘しなくても拾えるべき、という方針(ユーザー So の指示)に基づく自動QA。
**人間(So)は手触り感・情緒・物語の質に集中**し、機械的な粗はこのループが候補出しする。**採否・最終判断は常に人間**。

作業ディレクトリ: `/home/tamura/llm/english_game`。

## 手順

### 1. 自動プレイ＆撮影
```
node tests/_qa_playtest.mjs
```
- 本番相当を headless で駆動し、要所(導入→命名→ロック物語→初灯チュートリアル→本編→各シート→✎→イベント)を `/tmp/qa_shots/NN_<label>.png` に撮影、`/tmp/qa_shots/manifest.json` を出力。
- JSエラーが出たら、その時点で実装バグ。先に直す。
- 流れ/シーンが変わったら、このharnessの操作シーケンスも追従更新する(壊れたら直す)。

### 2. ペルソナでvisionレビュー(並行サブエージェント)
- 指摘レンズ＝ **`docs/playtest-persona-director.md`**(ディレクター So。軸 A没入/B手触り/CモバイルUX/Dテンポ/E学習設計/F物語)。
- `manifest.json` のショットを **3〜4分割して `general-purpose` サブエージェントを並行起動**(Agent を1メッセージで複数呼ぶ)。各エージェントに:
  - 必読＝`docs/playtest-persona-director.md`。
  - 担当ショットの絶対パスとラベル(manifestから)。
  - 出力＝**厳密なJSON配列のみ**(地の文なし)。各要素 `{shot, axis, severity, symptom, cause, fix, good}`。
  - 「症状名は診断名でない」=因果と直し方まで。静止画で断定できない手触り/情緒は `axis:"F", severity:"low"` で『人間へ要確認』。良い点も少し拾う(過剰差し戻し防止)。

### 3. 集約
- 3〜4体の返却JSONを1つに統合し、`docs/qa/auto-findings-<YYYY-MM-DD>.json` に保存(axisLegend付き)。
- high → medium → low で並べ、読みやすい要約をユーザーに提示。

### 4. 修正と回帰
- **high・low-riskな機械的修正**(誤った素材・明確なレイアウト崩れ・タップ標的の重なり等)は実装する。
- **判断を要するもの**(挿絵の採否・大きなレイアウト方針・情緒)はユーザーに委ね、`status:"human-*"` で残す。
- 修正後は `node tests/_qa_playtest.mjs` を再実行して回帰。`tests/_shot_ch1.mjs`(機能回帰)と `npm test`(ユニット)も通す。

## 注意
- これは**遊び手(中2)ペルソナ**(`docs/playtest-persona-2026-06-13.md`)とは別。こちらは**作り手の手触り基準**。
- game-feel の用語・チェックは `docs/game-feel-jank-catalog.md` / `game-feel-audit.md` に準拠(入力因果/偽タイマー/凍結テンポ税)。
- 死守事項(誤答罰なし・説教禁止・8行上限・経済不変・主人公を極力映さない)を破る指摘が出たら最優先で直す。
