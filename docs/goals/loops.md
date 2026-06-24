# 実装ループ憲章 ―『ともしび』2ループ分離

> 実装を **STORY** と **SYSTEM** の2ループに完全分離して回す。各ループは独立した queue・独立した「次の1手」決定規則を持ち、安全網(`npm run gate`)だけを共有する。
> 両ループは **非同期ブリッジ**(`bridge.md`)で互いに作業/アイデアを渡せる(ブロッキングしない)。
> 各ループは **1イテレーション=1タスクを gate 緑の区切りまで** 進めて報告(停止点を作りやすく)。

---

## STORY ループ ― 物語の完結 ＋ 物語実装
**使命**: 物語を完結(全9章＋4ED)まで進める。「ストーリー」は本/シナリオの**執筆**だけでなく**物語実装**(物語に属するコード・データ・演出)も含む。

- **担当範囲(書く)**: `docs/drafts/*`(ch*.md, arc-plot) ／ `js/scenario.js` ／ `data/events.js` ／ `data/words.js`(clozeable化の例文修正) ／ `scripts/imggen/scenes.json`・`assets/img/scene_*`(挿絵) ／ `js/ui.js` の **物語側**(renderStory・SCENE_ART・物語シート・章扉) ／ route/truth/ch フラグと **ED分岐ロジック** ／ さしいれ(鐘配信)機能 ／ `STATUS.state.json` の `chapters`/`endings`。
- **queue / 次の1手**: ① `story-backlog.md` の最上位 todo → なければ ② `npm run status` の「次の地点」(未配線の章/ED)。1イテレーション1件。
- **章パイプライン(確立済・ch3/ch4で実証)**: 素案(§1) → §2多ペルソナ独立レビュー **high0** → `scenario.js`/`events.js` 配線 → `npm run gate` → 台帳前進。
- **画像生成は後回し**(brief を `scenes.json` に置くまで。生成はユーザ外部ComfyUI/gpt-image-2 → 私は webp+`SCENE_ART`登録)。

## SYSTEM ループ ― ゲーム機構
**使命**: エンジン・経済・進行・アイテム・UX/UI機構・テストを実装する。

- **担当範囲(書く)**: `js/*` エンジン(srs/economy/battle/armory/pool/mastery/workshop/quiz/storage) ／ `data/weapons.js` ／ `style.css` ／ `js/ui.js` の **機構側**(物語リーダー以外) ／ `tests/*` ／ `docs/*-design.md` ／ 経済/進行/武器の **凍結インバリアント**。
- **queue / 次の1手**: `system-backlog.md` を **Tier順で上から**。1イテレーション1件。**Tier3(機構再設計)= 設計doc → ユーザ確認 → 実装**(凍結値を変えるため)。
- **凍結インバリアント**: 経済/進行/武器の機構を変える時は `tests/invariants.test.js` の凍結値を**意図的に更新**し、設計docに明記。

---

## 共有(両ループ)
- **安全網**: 台帳を前進させる前に必ず `npm run gate`(`npm test` + smoke)緑。UI/フロー変更は任意で vision QA(`/qa-playtest`)。
- **台帳**: `STATUS.md`(`npm run status` で生成)。story=`chapters`/`endings`、system=`system-backlog.md`(必要なら STATUS に system 進捗ノートを追加可)。
- **実行形態**: 各ループは別々の `/loop`(dynamic)で回す。**基本は片方ずつ(逐次/交互)**。真の並行が要るときは各ループを別 git worktree で動かしてマージ(`isolation: worktree`)。

### 境界・衝突回避
- 共有ファイルは実質 `js/ui.js` のみ。**規約**: STORY は `renderStory`/`SCENE_ART`/物語シート/章扉だけ、SYSTEM はそれ以外。横断する変更は**ブリッジ経由**で相手ループに依頼。
- `STATUS.state.json`: STORY は `chapters`/`endings`、SYSTEM は(必要なら)`system` セクション。同時編集を避ける。
- 並行運用時は worktree で物理分離。

---

## 橋渡し(ブリッジ) ― `bridge.md`
**非同期・ノンブロッキングの双方向 inbox**。あるループが相手ループ向けの作業/アイデアを見つけたら `bridge.md` に1行積む。受け手は**自分の優先度で**取り込む(待たせない)。

- **STORY → SYSTEM**(主用途・ユーザ要望): 物語実装中に「面白い機能」を見つけたら `## → System` に提案を積む。例: 章ボス演出を支える昇華バーストVFX、F4(忘却)を支える"言い淀み"UI、ED分岐セレクタ、章扉の原文修復率アニメ。
- **SYSTEM → STORY**: 機構変更が物語機会を開いたら `## → Story` に積む。例: 昇華→新イベント解放が決まれば章供給語数を可変にできる等。
- **エントリ形式**:
  `- [YYYY-MM-DD][from→to][prio:high|med|low] <提案>. なぜ: <理由>. 影響: <files/領域>. status: new`
- **トリアージ規則(各ループのイテレーション冒頭で)**: 自分宛セクションの `new` を読み、**accept**(→自分のbacklogに優先度付きで転記し `status: accepted`)か **reject**(理由つき `status: rejected`)。`prio:high` は次に着手。実装したら `status: done`(着地先=backlog id/コミットを併記)。提案元はそれで着地を確認できる。
- **要点**: 受け手が判断/着手タイミングを握る=どちらのループも相手を待たない。

---

## 起動プロンプト(この2つを使い分ける)
- **STORY**: `/loop ストーリーを完結まで進める。docs/goals/loops.md のSTORYループに従う(冒頭で bridge.md →Story を取込→ story-backlog/STATUS から次を1件→素案→§2レビューhigh0→配線→gate→台帳)。画像生成は後回し。`
- **SYSTEM**: `/loop システム/ゲーム機構を実装。docs/goals/loops.md のSYSTEMループに従う(冒頭で bridge.md →System を取込→ system-backlog をTier順で次を1件→Tier3は設計doc→ユーザ確認→実装→gate→backlog更新)。`
