# 改善 backlog ―『ともしび』(プレイテスト feedback 由来) ※アーカイブ

> ⚠️ **2026-06-21: 2ループ分離に伴い再編**。現役キューは → **`loops.md`**(憲章) / **`system-backlog.md`**(機構=D2/D3) / **`story-backlog.md`**(物語=章/ED/挿絵)。本ファイルは**原票(プレイテストfeedback)とdone履歴のアーカイブ**として保持(C1=story / D系=systemへ移管)。
>
> 出典: ユーザ実機プレイテスト export (2026-06-17・sw v23・ch1)。loop がこれを**上から順に**処理する。
> 各項目の `status:` を todo→doing→done で更新。Tier3(システム再設計)は**設計doc→実装→gate→QA**の順。
> 安全網: 実装ごとに `npm run gate`(npm test 91+ / smoke 18) 緑、UI/物語変更は vision QA。
> ⚠️ 経済/進行/武器の**機構を変える項目は `tests/invariants.test.js` の凍結値を意図的に更新**する(設計docに明記)。

---

## Tier 1 ― 即修正(バグ/UI・低リスク)

### B1. costW「つづける」ボタン: 残高不足でも押せる見た目＋無反応 — status: done (2026-06-18・暫定)
> 実装済: js/ui.js renderStory で `need = cost>0 && gold<cost` のとき確定ボタン/選択肢を `disabled`(opacity.45)化し「あと 💰X。魔物を倒すと 💰 が手に入る。」を明示。c01_110(💰109)で不足=無効+notice、充足=通常ボタンを vision QA で確認、gate(91+smoke)緑。※D2でcostW解禁を廃止する際に本UIごと置換予定。
- where: 物語 c01_110「老灯守の告白」(つづける $25)
- 症状: 魔素(💰)が足りないのに有効ボタン表示で、押しても無反応。
- 直し: 不足時はボタンを無効スタイル＋「魔素が足りない(あと N)」を明示。`js/ui.js` renderStory の cost 表示分岐。
- ⚠️ 依存: **D2(進行モデル変更)で costW 解禁を廃止予定**。D2 を先にやるなら本項は不要。順番上は暫定UX修正として先行可。

### B2. 複数語ビートを全廃→新語は1語ずつ英文clozeで教える — status: done (2026-06-19)
> **実装(表示変更で達成・データ全書き換え不要)**: ①`data/words.js` の非clozeable例文10語を原形へ修正→全96イベント語が英文cloze可。②`js/ui.js` useCloze から `entries.length===1` ガード撤去→複数語castも“いま埋める語の英文cloze＋複数語進捗”で表示=**1語ずつ英文cloze学習**。③`tests/invariants.test.js` に「全イベント語clozeable」を追加(切替バグ恒久封じ)。runtime QAで複数語ビートが「Stars ___ in the night sky.」＋選択肢[shine/moon/distractors]表示を確認、gate(92+smoke)緑。
> 反芻(review)ビートは累積復習のまま(覚える≠反芻のため据え置き)。**※data形式は複数語のまま=33ビート書き直し回避**。要望なら review も1語ずつ化可。
> **ユーザ確定**: 「複数単語で覚えるところを全部なくす」。複数語castを廃止し、**全イベントの新語を1語ずつ英文cloze**で教える(単語ビートのみ→ui.js:1503 の useCloze が常に成立)。
> 規模: **複数語teachビート33個・全12イベント**(ch1: lights3/codex3/flee2/table2/fence2/oath3、ch2: 各3×6)。各複数語castを単語castに分割し cast.jp を書き直す(8語/本は維持・ビート数は増える→テンポは director QA で確認)。非clozeable語(例文に語が無い)は要対応(例文側を直すか語を差し替え)。`data/events.js`＋`docs/v6-multiword-spec.md`更新、invariants(供給8語)据え置き、gate＋vision QA。D1のローテ(1語ずつ)と整合。
> (旧B2=clozeバグ調査の結論: 回帰でなく仕様だった。新方針で複数語ビート自体を無くす。)
- where: イベント ev_c01_lights cast
- 調査結果: **回帰ではなく仕様**。イベントの英文cloze(ev-cloze)は「単語cast かつ clozeable」のときだけ表示(ui.js:1503)。**複数語castは和文の穴埋め行(ev-blank)に統一**してある。これは意図的で、コメント(ui.js:1502)に理由が明記: 例えば `shine` は例文が "shines" で `\bshine\b` 不一致→単独だと素表示に落ち、`moon` で英文化して「治る」ように見えるバグを避けるため。
- 実機相当の機械確認: ev_c01_lights のビート判定 → shine+moon/star+sky/wind+snow=複数語→和文(設計通り)、cloud/rain=単語→英文cloze正常("There is a big ____ in the sky." 等)。ユーザが step1/5 で見たのは複数語ビート(=和文)。**スマホで見た英文clozeは単語ビート(cloud/rain 等)**で、いまも出る。
- ✅ 解決方針: 上記のとおり**複数語ビート全廃→1語ずつ英文cloze**に統一(ユーザ確定)。

### B3. 「アキ……じゃなくて」が意味不明 — status: done (2026-06-18)
> 修正済: ev_c01_lights intro を「{name}! あんたのその灯、まだ生きてる。灯せるんでしょ。だったら、できるでしょ」に書き換え(じゃなくて削除)。ch1イベントのリテラル「アキ」4箇所を全て `{name}` トークン化(改名プレイヤーで破綻しないように)。npm test 91緑。
- where: イベント ev_c01_lights intro 「ユイ『アキ……じゃなくて。あんたのその灯、まだ生きてる…』」
- 症状: 「じゃなくて」の意図が伝わらない。加えて**リテラル「アキ」**で `{name}` トークン未使用(改名プレイヤーで破綻)。
- 直し: `data/events.js` ev_c01_lights intro を書き換え(意図を明確化＋`{name}` トークン化)。他のリテラル「アキ」もch1イベントで掃き出し検査。

### B4. PC表示をスマホ同様の縦長に — status: done (2026-06-18)
> 修正済: style.css に `@media (min-width:600px)` の縦長フレーム(中央寄せ+レターボックス)を追加。#app を 412×phone-aspect の枠に収め、全画面/シート/✎/ティッカーを枠へ追従。モバイル(<600px)は不適用=無回帰。desktop(1280×900) vision QA で main/設定シート/物語リーダーが枠内整列を確認、gate(91+smoke)緑。
- where: 全体(c01_004 等で気付き)
- 症状: PCで遊ぶと横広に伸び、スマホの縦長1画面と体験が違う。
- 直し: `style.css` で本体コンテナを最大幅(≈430px)・縦長(モバイルアスペクト)にセンタリング。デスクトップでも390×844相当の見え方に固定。

### B5. 経験値をUIに明示 — status: done (2026-06-18)
> 実装済: ステータス行の下に EXP 進捗バー(現在レベル内 into/next + 数値)を追加。js/ui.js renderStat で更新、style.css .exp-row。vision QA で「EXP 220/264・83%」表示・gate(91+smoke)緑を確認。
- where: 本編メイン画面
- 症状: EXP/レベルの進捗が分かりにくい。
- 直し: ステータス域に Lv＋EXPバー(現在/次レベルまで)を見やすく表示。`js/ui.js` renderStat。

---

## Tier 2 ― テンポ/整合(中リスク)

### P1. ev_c01_lights が開始直後に解放され唐突 — status: deferred → D2 (2026-06-18)
- where: イベント ev_c01_lights(0/5)
- 症状: 開始後すぐ着手でき、物語の統合性が取れず唐突(gate.read='c01_050' が早い)。
- 判断: **D2(昇華数による解禁)に統合**。今 gate.read を弄ると D2 で作り直す throwaway になり、供給80%ルールにも触れるため、D2 の解禁テーブル設計の中で同時に解消する。単独の暫定修正はしない。

---

## Tier 3 ― システム再設計(要・設計doc → 実装。invariants 凍結値の意図的更新を伴う)

### D1. 単語マスター(昇華)機能 — status: done(メカニクス) 2026-06-19
> 実装済(gate緑・各段検証): ✅データ層(js/mastery.js: ans=reps+min(taps,cap)導出/canSublimate=ans30&S≥7/sublimate/24hクールダウン取消・p.mastery.sub・backfill) ✅効果A(マイルストーン昇華係数sublMult→globalMult・0で不変invariant・30日シムでc02ゲートday6不変・放置:タップ比は両辺に乗り不変) ✅効果B(出題プールから昇華語除外+10%lapses重み復習・workshop除外・runtime実測10%) ✅呪文書UI(習熟バーans/30・昇華ボタン+確認ダイアログ・S不足は鍵付き非活性・昇華数+次解禁あとN・昇華済✦・取消)。テスト: mastery.test 5件+invariants(sublMult)+clozeable。数値(ansThreshold30/tapCap20/sMin7/SUBL_MILESTONES[5,12,25,50,100])は実プレイ微調整可の暫定既定。
> ⏭ **「昇華数で新イベント解放(ローテ補充)」はD2に統合**(昇華数を解禁通貨にするD2＋解放先の新イベント=C1に依存。二度手間回避)。
> 設計doc: `docs/sublimation-design.md`。**§9の決定をペルソナ4体評価で確定**: #1合算(tap日次キャップ)/#2回数30かつS≥7併用/#3=10%lapses重み再出題(ユーザ確定)/#4マイルストーン式(全員一致)/#5ローテ20語・昇華4個ごと新イベント/#6クールダウン取消+確認。数値(SUBL_K/S閾値/段間隔/解禁ピッチ)は30日シム待ち。IDLE_K表記揺れは誤検知(0.21/分=0.0035/秒)。**実装順=B2→D1**(B2がローテ土台)。
- 仕様(ユーザ): 呪文書で各単語の回答数が**30**で「昇華」ボタン解放→押すとその単語が**出題ローテから除外**＋**基礎能力↑**。昇華した数に応じて**新イベント(新語を覚える)を増やし**、常に一定数の単語でローテできるようにする。
- 影響: `js/quiz.js`(出題プール除外)・`js/storage.js`(昇華フラグ/回数)・`js/ui.js`(呪文書UI/昇華ボタン)・`data/events.js`(昇華数で解放する追加イベント)・経済(基礎能力↑の数値)。
- 設計doc先行: `docs/sublimation-design.md`(回答数カウント源・基礎能力の上げ幅・ローテ語数の維持式・新イベント供給との接続)。

### D2. 進行モデル変更: 昇華数で解禁＋ゴールド解禁(costW)廃止＋昇華数で新イベント解放(ローテ補充) — status: design-done → review待ち (2026-06-19)
> 設計doc: `docs/progression-design.md`。中心論点=**昇華は遅い**ので純昇華ゲートは進行が遅延＋ブートストラップ問題。3案提示(A=二層・最安全/**B=settled+昇華AND・おすすめ**/C=純昇華・最大変更)。costW(ゴールド解禁)は廃止。昇華数で新イベント解放(ローテ補充)はC1(ch3+)に依存。**§9に5決定点**(採用案A/B/C・costW撤去範囲・subl値とシム・UI位置・C1依存)。承認後 §11 で実装。
> ✅ **decided部分=costW廃止を先行実装済(2026-06-19・gate緑)**: 全6シーンの costW 撤去(3案共通)。クエストは読むだけで進む。金は戦闘/装備通貨として存続。残り(昇華ゲートA/B/C・新イベント解放)はreview待ち。
- 仕様(ユーザ): **昇華数でメインストーリーを解禁**。昇華数とメインのバランスを考えた解禁ポイントを設計。**次のイベント/メイン解禁までの昇華数を明示**。現行の**ゴールド(costW)解禁は廃止**。
- 影響: `js/scenario.js`(gate を settled/costW → 昇華数へ)・`js/ui.js`(解禁条件表示・次解禁までの数)・`tests/invariants.test.js`(章ゲートの定義変更＝凍結値の意図的更新)・B1/P1 を吸収。
- 設計doc先行: `docs/progression-design.md`(昇華数↔章/イベント解禁テーブル、30日シムとの整合、既存セーブのmigrate)。D1 と密結合(先に D1)。

### D3. アイテムのランク1〜99(青天井)＋調合ランクアップ — status: todo
- 仕様(ユーザ): 現行の(レアリティ)武器システムを**ランク1〜99の青天井**に。ドロップは基本ランク1、**調合(合成)でまれにランク2〜3へ一気にランクアップ**、その確率は**ストーリー進行で上昇**。これでバランス調整。
- 影響: `js/armory.js`・`data/weapons.js`・`js/ui.js`(武器庫UI)・経済(ランク→能力曲線)。
- 設計doc先行: `docs/item-rank-design.md`(ランク→ステ曲線、調合のランクアップ確率×物語進行、既存武器のmigrate)。

---

## Tier 4 ― コンテンツ継続

### C1. 第3章以降＋イベントを順次制作 — status: todo
- 仕様(ユーザ): 第3章以降とそのイベントもどんどん作る。
- 進め方: 確立済みの章配線パイプライン(AI多ペルソナ review high0 → scenario/events 配線 → gate → vision QA → 台帳前進)。arc-plot §4 の ch3「灯札の街」(20シーン/8イベント/64語/ゲート90)から。
- ⚠️ D2 が入ると章ゲートの建て方(settled→昇華数)が変わるため、**D2 後に着手**すると手戻りが少ない。

---

## アート ― 挿絵密度

### A1. メインストーリーは“常に挿絵”(挿絵頻度↑) — status: briefs done → 生成待ち (2026-06-19)
> ✅ brief完了: 未挿絵29シーンの illust brief を `scripts/imggen/scenes.json` に統合(新stages7件)。**全42メインシーンに挿絵brief**(未briefゼロ・JSON検証OK・POV/中世/negative準拠)。
> ⏭ 生成はユーザpipeline: `gen_scenes.py`(ComfyUI/gpt-image-2)で生成→`out/scenes/*.png`→`png2webp.py`でwebp→`SCENE_ART`登録(私が対応)。最終差し替えはgpt-image-2後段。
> (軽微cleanup: 似たstage key `village_palisade`/`nagi_village_palisade` が併存=どちらも有効。後で統合可)
- 要望(ユーザ): 挿絵の頻度をもっと高く。**メインストーリー中は常に挿絵があっていい**(=ほぼ全シーンに1枚)。
- 現状: 42シーン中**11枚**(ch1: c01_004/010/040/060/140/180=6、ch2: c02_010/040/090/100/130=5)。残り~31シーンが挿絵なし(SCENE_ART未登録→onerrorで素テキスト)。
- 作業: ①未挿絵メインシーンに**挿絵概要(brief/構図/POV/中世タグ)を author**(workflow §1.1の死守: 主人公映さない・前近代統一)→ `scripts/imggen/scenes.json` のプロンプト化。②生成は**外部ComfyUIパイプライン**(ユーザ環境)→PNG→`scripts/png2webp.py`でwebp→`SCENE_ART`登録。③C1以降の新章は**最初から全シーンbrief+生成**を標準に(workflow/arc-plot §12 の挿絵予算を更新)。
- ✅ ユーザ確定(2026-06-18): **今すぐlocal生成も行う**。私の担当=未挿絵メインシーンの **illust brief/プロンプトを author**(`scripts/imggen` 形式)。生成は外部ComfyUI(ユーザ環境)→PNG→`scripts/png2webp.py`→`SCENE_ART`登録。最終差し替えは後段gpt-image-2。コード側(SCENE_ART/onerrorフォールバック)は対応済=絵を入れれば出る。

---

## 順番(loop の処理順)と依存
1. **B3 → B1 → B4 → B5 → B2**(Tier1: 低リスク・即効。B2は再現調査込み)
2. **D1 →(D1完了後)D2**(進行モデルの土台。D2 が B1/P1 を吸収)
3. **P1**(D2 に統合 or D2 後に解消)
4. **D3**(武器系・他と独立だが経済に触る)
5. **C1**(D2 確定後に章配線を再開すると手戻り最小)

## 申し送り(ユーザ確認したい点)
- ⚠️ **入力欠損**: export の1件が途中で切れ、「英文clozeが出ない(B2)」と「ランク1〜99システム(D3)」が混在していた。D3 の現行システム名(置換対象)が読めなかったので**推定で復元**。意図と違えば指摘を。
- ⚠️ **経済不変インバリアントとの衝突**: D1/D2/D3 は前ターンで凍結した経済/進行/武器の数値・gate を**意図的に変更**する。各設計docで凍結値の更新を明示し、gate で回帰を守る。大きな方向転換なので、各設計doc完成時に一度目を通してもらえると安全(loopは設計docを出した時点で一旦報告する)。
