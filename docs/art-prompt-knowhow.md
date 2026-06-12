# 画像プロンプト ノウハウ集(Anima 2B / ComfyUI)

2026-06-13 のアセットセッション(約365枚生成・96フォルダ検品)で得た知見。
モデル: Anima base v1.0(832x1216 / 1216x832 / 1024x1024、er_sde/simple、cfg 4、shift 3.0、30step)。
プロンプトの正本は `image_gen/scripts/prompts/spellight3/_FIXED_TEXTS.md`(gitignore対象につき消さない)。

## 運用ルール(2026-06-13 ユーザー指示で変更)
- **AIによるビジョン選定は廃止。可否判断は人間の目で行う。**
  生成後は `review_spellight3/index.html` 形式のレビューHTML(またはコンタクトシート)を作って渡すところまで。
- 整合性は「固定文の一字一句再利用」で担保する(下記)。

---

## ✅ うまく行ったパターン

### 1. 固定文方式(整合性の要)
キャラ・街並みの記述を**全プロンプトに一字一句同じまま**貼る。シードが変わっても同一人物・同一の街に見える。
- ノノ確定文(60枚以上で安定):
  `1girl, solo, petite, large breasts, 15 years old, honey blonde hair in two long twin braids draped forward over shoulders, blunt bangs, big round green eyes, soft round face, small nose, small hand-carved pale wooden flower hair ornament above her left ear, rust-red long-sleeved village dress with high collar, cream pinafore apron dress`
- 王都下町(複数シードで同じ街に見えた):
  `half-timbered two-story houses with dark wooden beams and white plaster walls, steep clay-tiled roofs, cobblestone street, wooden shop signs hanging from wrought-iron brackets, laundry lines strung between upper windows, flower boxes on windowsills`
- シーン内で人物が小さいときは要約形を使う(braids/bangs/apron/花飾りは必ず残す):
  `blonde girl with twin braids, cream apron over a rust-red dress, small pale wooden flower in her hair`

### 2. 消したい特徴は「書かない」ではなく negative に入れる
- そばかす廃止 → negative に `freckles`(positiveから消すだけでは再発する)
- 前髪ぱっつん固定 → positive `blunt bangs` + negative `exposed forehead, center-parted hair`
- 髪飾りのリボン化防止 → negative `hair ribbon`

### 3. 一人称POV(レンを描かないルール)
`first-person POV, protagonist not visible, protagonist's hand(s) <持ち物/動作> at the bottom edge of the frame`
- 6/6イベント絵でレンの写り込みゼロ。画面下端の「手+光る写本」「手+木箱」が没入感を作る
- 持ち物を具体的に書くと手の破綻が減る(grimoire/wooden crate/leather-bound book)

### 4. 引き構図(ユーザー最重要要望)
- 横: `extreme wide establishing shot` + 被写体を `small in the midground` / `tiny in the frame`
- 縦: `vertical composition dominated by a vast starry sky` 型(=夜空への誓い構図)。
  **引き=被写体を小さく・世界を大きく**であり、縦横どちらでも成立する
- `no people`(無人)か `small distant background figures only, no close people`(群衆を米粒に)を明記

### 5. 白い火(静寂の火)
`unnatural cold white flames, silent smokeless white fire` + negative `orange fire, red flames, smoke`
→ 全シードで白〜青白の火を維持。negativeの3語が効く

### 6. ドット絵(前夜からの知見+今回確認)
- quality から `@john` を外し、character 先頭に `pixel art, retro JRPG sprite, 16-bit style, crisp pixel edges, limited color palette`
- negative に `blurry, anti-aliasing, smooth shading, gradient`
- スプライトシート: `4 frames of idle animation, same character, arranged in a horizontal row` +
  `identical character repeated in every frame` → **ただし1行でなくグリッド(4x2/4x3/2x8)になりがち**。
  グリッドでも行が等間隔なら1行クロップで帯化できるので実用上OK
- 白背景の透過は colorkey でなく **floodfill(外周連結のみ)**。白い毛のキャラでも安全
  (ffmpeg: `format=rgba,floodfill=x=1:y=1:s0=255:...:d3=0` を四隅から)

### 7. 三面図(キャラシート)
`character reference sheet of the same girl shown three times, front view and side view and back view, identical character: <固定文>` + `consistent proportions and palette across views`
→ 4シード中1枚は背面の三つ編みまで一貫した完璧な三面図が出る。数を引いて選ぶ前提なら実用的

### 8. 無人の象徴絵・エンブレム
- amb系: `symbolic emotional illustration` + `no people` + negative `people, characters` で安定
- ロゴ: `wordless emblem, no writing` + negative `text, letters, readable words, typography, lettering`
  → 文字化けゼロ。**文字を描かせない最強の保険は「文字を入れない」デザインにすること**

---

## ❌ 失敗パターンと対策

### 1. 「石畳の大通り」が現代道路になる(最重要の罠)
`wide stone-paved boulevard` → アスファルト+白い車線標示が出る(ts_gate, wide_road_silentnight で発生)。
- 対策: 門外の道は `dusty dirt highway with wagon ruts`、negative に `asphalt, modern road, road markings`
- 夜道は暗さでごまかされやすいが車線は縮小しても見えるので必ずチェック

### 2. 「白い灰の廃墟」が雪村になる
`pale white ash` → モデルの事前分布で雪に解釈され、廃墟でなく冬の村が出る(wide_village_ashes)。
- 対策(次回検証): 色でなく破壊を主語に。`charred skeletal beams, collapsed half-burned cottages, grey ash drifts` 等

### 3. 髪飾りの揺れ(許容運用で対応)
- **左右が鏡像反転しがち**(「above her LEFT ear」指定でも約半数が右)→ 「付いていること」優先、左右は許容
- 色が `pale wooden` 指定でも茶〜タンに寄る/形がクッキー状円盤になるシードあり → 選定で弾く前提
- 完全固定したい場合は img2img や参照系(IPAdapter)が必要(Animaではプロンプトのみだと限界)

### 4. 文字・文字もどき
negative `text, letters` を入れても、**看板・本のページ・標識など「文字があるはずの物」には文字もどきが浮く**。
- 完全には消えない。720px縮小で気にならないか、で判断
- 逆に「異界の文字」演出(ev_codex の光る文字)としては味方になる

### 5. 表情と整合チェックの両立
`eyes squeezed shut`(満面の笑み)系は目の色が確認できなくなる → キャラシート照合は開眼カットで行う。
遠景・夜景では緑目が青っぽく転ぶ(ev_fire)— 小さければ実用上問題なし

### 6. サポートキャラの属性ドリフト
固定文が短いキャラ(マーサの藍頭巾→白/紫に化ける等)は主役より揺れる。
- 対策: 脇役も髪型・前髪・小物まで固定文をフル指定する(セシリアの前髪が毎回違う問題も同根)

### 7. パイプラインの教訓(プロンプト外)
- 生成画像の回収は**スナップショット差分でなく `--prefix` 一意化**(spellight2では並行生成が混入し
  px_goblinフォルダが蜘蛛になる事故。spellight3_batch.sh で解決済み)
- ComfyUI は同一(プロンプト+シード+prefix)をキャッシュ応答する → prefix にアイテム名を含める
- 移動先に同名ファイルがあると shutil.move が例外で**バッチ全体が死ぬ** → 連番リネームで回避(同上)

---

## 推奨ワークフロー(次回以降)
1. `_FIXED_TEXTS.md` の固定文を貼ってマニフェスト(JSON)を書く
2. `./scripts/spellight3_batch.sh scripts/prompts/spellight3/<manifest>.json` (並行起動OK、~50秒/枚)
3. 生成後、`sl3_finalize.py` 形式でレビューHTMLを作り**人間がレビュー**(AI選定はしない)
4. 採用分だけ webp 変換(シーン720幅/立ち絵高さ720/敵360/帯512x144 lossless+透過)して組込み
