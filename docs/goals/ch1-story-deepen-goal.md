# GOAL: 第1章ストーリーの深化・書き直し（"話が通る"密度へ／3関門合格まで）

第1章「灯が消えた夜」のストーリーを**説明と会話を補って"話が通る"密度へ深化・書き直す**。
成果＝`docs/drafts/ch1.md` 深化＋`docs/drafts/arc-plot.md` 整合修正で、**多ペルソナ独立レビュー3関門
（workflow §2）を high 指摘ゼロで合格**し、push 後の**停止点A**で止まること。作業ディレクトリ
`/home/tamura/llm/english_game`。

## 指示書（着手前に読む）
- `docs/handoff-2026-06-14.md`（2026-06-14 ユーザー指摘5点・本ゴールの出所）
- `docs/story-authoring-workflow.md`（**§1.1 挿絵ルール**＝主人公極力映さない/前近代中世風、**§2 多ペルソナ独立レビュー**＝必須手順、§0 鉄則）
- `docs/nakige-emotional-design.md`（起伏テンプレ）／`docs/drafts/arc-plot.md`（全章プロット・伏線/モチーフ表）
- 現行稿 `docs/drafts/ch1.md`（18シーン）。`~/lbe/entertainment-vault` の earned-catharsis / nakige / lessons。
- システム制約として読む: `docs/v6-multiword-spec.md`・`docs/economy-spec.md`・`docs/scenario-structure.md` §7/§10/§11。

## スコープ
1. **説明と会話を補い"話が通る"密度に**（現状は説明欠落・会話過少）。**1シーン8行上限は厳守**し、不足は
   **シーン数増で稼ぐ**（掛け合い・状況説明のシーンを節目間に追加）。説教禁止・温度3択・誤答は物語を変えない。
2. 【決裁済み】**ch1は幼少期の話** → 挿絵概要は主人公たちを**幼少期の姿（見た目12〜13歳くらい）**で記述。
3. 【決裁済み】**挿絵ルール（workflow §1.1）反映**: 主人公は極力映さない（一人称POV）／整合タグは
   **前近代・中世風**（大塔＝石積み/木組みの素朴な灯台等、近代タワー化しない）。
4. **灯火（ともしび）のこの世界での扱いを深める**（何で・どう使い・なぜ価値があるか／灯詞との関係／生活・経済）。
   `arc-plot.md` §2 にも反映。**説教にせず**住人の生活・台詞・情景で見せる。
5. **ゲームシステム制約は維持**: 全詠唱/供給語は `data/words.js` 実在・章内/既出と重複衝突ゼロを機械検証／
   v6イベント8語/本／settledゲート／次章≤供給語累計の8割／灯火経済・ボス機構の数値不変。

## 前提（検証済み・2026-06-14）
- ブランチ `main`・作業ツリー clean・`origin/main` と up-to-date。リモート `origin = github-second:sousou1/english_game.git`（通常 push 可）。
- 正典/データ/vault すべて存在確認済（handoff・ch1・arc-plot・workflow・nakige・v6・words.js・playtest-persona・entertainment-vault）。
- 現 `ch1.md` = 18シーン・本文95行・供給51語は実在/衝突ゼロ（機械検証グリーン）。
- 実在検証は `node --input-type=module -e 'import {WORDS} from "./data/words.js"; ...'` で可。
- 画像生成・組込みは本ゴール対象外＝localhost プロキシ回避は不要。画風/キャラは確定済（`~/llm/image_gen/scripts/prompts/tomoshibi/_FIXED_TEXTS.md`、Mix D）。

## 進め方
- `main` で作業。**機械検証（実在/重複/8割ルール）はレビュー前に済ませ**、関門には物語の質に集中させる。
- 多ペルソナ独立レビュー: 編集者＋顧客ペルソナ（中2男子＋物語重視層）＋entertainment-vault を**独立サブエージェントで並行起動**
  → high 反映 → **同一レビューアに `SendMessage` で再提出** → 全関門「出せる/合格」かつ **high 指摘ゼロ** まで反復。
- 合格後 commit & `git push origin main`（通常 push）。

## 完了条件（数値ゲート）
- (a) 3関門すべて「出せる/合格」かつ **high 指摘ゼロ**。
- (b) ch1 の全詠唱/供給語が `words.js` 実在・章内/既出と重複衝突ゼロ（機械検証グリーン）。
- (c) 次章ゲート ≤ 供給語累計の8割 を維持（arc-plot §4.1 と整合）。
- (d) 全シーン本文 ≤ 8行。
- (e) `docs/drafts/ch1.md` と `docs/drafts/arc-plot.md` を commit & push し `origin/main` へ反映。

## 停止
- 上記完了で push 後「**停止点A**」を報告（go 後に幼少期＝見た目12〜13歳の姿で挿絵を作り直す別フェーズ）。
  **画像生成・HTML作成・ゲーム組込みはやらない**。
- 幼少期の見た目年齢は **12〜13歳で決裁済み**（挿絵概要にそのまま反映）。仕様判断に迷う点が出たら needs input で停止。

## セッション名
- 作業開始時に日本語へ: **「EG:第1章ストーリー深化（説明・会話・灯火）」**（`/rename`）。
