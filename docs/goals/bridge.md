# ブリッジ ― STORY ⇄ SYSTEM 非同期 inbox

> `loops.md` の橋渡し規約に従う。**ノンブロッキング**: 積むだけ。受け手が自分の優先度で取り込む。
> エントリ形式: `- [YYYY-MM-DD][from→to][prio] <提案>. なぜ: <理由>. 影響: <files/領域>. status: new|accepted|rejected|done`
> トリアージ: 各ループのイテレーション冒頭で自分宛の `new` を読み accept(自backlogへ転記)/reject。`prio:high` は次に着手。実装後 `status: done`(着地先併記)。

---

## → System(STORYループからの提案)

- [2026-06-21][story→system][prio:med] 昇華(D1)のマイルストーン到達・章ボス撃破に「原文修復率が一段上がる」演出/通知をフックする。なぜ: 章扉の原文断片(修復率併記)が現状ただの静的表示で、SRS進捗(昇華)と物語の到達が体験上つながっていない。学習の達成が物語の前進として可視化されると刺さる。影響: `js/mastery.js`(マイルストーンhook)・`js/ui.js`(章扉/通知)・章扉の修復率算出ロジック。status: new
- [2026-06-21][story→system][prio:low] feelings系イベント(ev_c04_yui/nerves/quarrel 等)の正答時に、感情語のトーンに応じた控えめな色/効果音の差し色。なぜ: 心情の機微を覚える回で、無味な正答演出だと"勉強"に寄る(中2男子ペルソナがch4でテスト臭を指摘)。影響: `js/ui.js`(クイズ正答演出)・`data/words.js`(語のtone属性 or fフィールド流用)。status: new
- [2026-06-22][story→system][prio:med] 語彙DBの feelings/society **L2帯の補充**(各+15〜20語目安)。なぜ: ch5「声のない町」配線時、arc-plot既定の feelings/society L2-3 のうち L2 がほぼ枯渇(feelings L2残2/society L2残1)、やむを得ず L3-4 へ昇格して72語を確保した。ch6以降も心情/社会系を厚く使う章が続くため、難度カーブを設計通り保つには L2-3 帯の在庫が要る。影響: `data/words.js`(L2 feelings/society語の追加・全clozeable=ex に原形必須・既出と衝突しない新語)。語彙5000目標(project-vocab-target-5000)への前進も兼ねる。status: new
- [2026-06-22][story→system][prio:low] words.js の例文 clozeable 自動チェックを CI/gate 前段に独立スクリプト化(現状は invariants.test.js 内で event 供給語のみ検査)。なぜ: ch5 配線で13語が「ex に原形を含まず cloze 不能」で gate に引っかかった。新語追加・例文編集のたびに後追い修正になっており、words.js 全件に対する原形包含チェックを `npm run status` 隣に置くと、STORY が供給語を選ぶ前に弾ける。影響: `scripts/`(新規 lint)・`package.json`。status: new
- [2026-06-24][story→system][prio:med] 隠しED「friend」の解錠トラッキング機構。なぜ: 終章ch9で3ルートED(hero/yui/quiet)は配線済(branchOn:route で出し分け)だが、隠しfriend(arc-plot §6・lonely↔friend 対句反転で締め)の解錠条件『全ルートクリア後＋語り部級(S≥90)50語』は、(a)どのルートEDを到達済みか(end到達フラグ集合)、(b)S≥90語の本数カウント、という**周回/完了の状態管理**を要し、STORY範囲のフラグ(加算のみ+truth/route列挙)では表現できない。提案: profile.scenario に endsCleared:Set 相当(end到達時に route を記録)+ `js/mastery.js` で S≥90語数のゲッタを用意し、両条件成立で c09_120 等から friend 分岐を解錠(STORY側は branch を1本足すだけで済むAPIにしたい)。影響: `js/storage.js`(profile拡張)・`js/ui.js`(end到達記録/解錠判定)・`js/mastery.js`(S≥90カウント)。着地後 STORY が friend ED 本文(cE_friend_*・L1語 friend/lonely)を配線し endings.friend.inCode:true 化。**STORY側の完成設計を `docs/drafts/cE_friend.md` に用意済(2026-06-24)＝API契約の具体案も同稿に明記: 解錠判定を read-only bool `flags._friendUnlocked` に投影してくれれば、STORY は c09_118 に branch を1本 + cE_friend_010-030 + ev_cE_friend(8語)を足すだけで配線完了できる**。**追記[2026-06-25]: STORY側は供給語の事前検証まで完了(feelings枯渇のため供給8語を friend/funny/sun/breakfast/sleep/bedroom/visit/station=全L1・衝突ゼロに確定/cE_friend.md §2 訂正済)＝API契約 `flags._friendUnlocked` さえ来れば即配線可。残るブロッカーは本API1点のみ。** **追記[2026-06-25・STORY配線完了]: STORY側は friend ED を先行配線済(c09_118 で read-only `flags._friendUnlocked` を見るだけ・未投影なら静的フォールバックで既存3ED経路は不変=今コミットしても既存挙動ゼロ変化)。cE_friend_010-030 + ev_cE_friend(8語)+ endings.friend.inCode:true 化済。SYSTEM は `flags._friendUnlocked` に解錠真偽(全ED周回+S≥90語50本)を read-only で投影するだけで友エンドが発火する=STORY 追加作業ゼロ。契約は bool 1個のみ。** status: new(SYSTEM未着手・STORY側は完了)

- [2026-06-26][story→system][prio:high] **サブクエスト(任意供給トラック)の配信ランタイム**を実装する。なぜ: 語彙5000逆算(vocab-growth-design §4)の残約4,400語はサブ(お使い)が運ぶ設計。STORY 側はデータ層を新設済=`data/subquests.js`(`SUBQUESTS[]`・EVENTSと別名前空間・別ファイルゆえメインの `eventAvailable` には**混ざらない**)。各サブは章バインド3点 `chapter`/`unlockAfter`(その章のシーンを読むと解禁)/`placementBefore`(次章開始前に消化する窓)を厳密に持ち、本文もその章の状況に密接(試走=`sub_c02_brokenbridge`「落ちた橋の行商人」ch2街道の逃避行に絡む・travel新語8語)。**SYSTEM 領域の作業**: (a)`unlockAfter` を読んだ後・`placementBefore` 未読の窓でだけ sub を提示する serving(任意・スキップ可・ゲート非依存)、(b)クリア時の供給(teach語を学習ステップへ=EVENTSと同じ E1 経路を流用可)、(c)80%ルールの供給累計に**サブを数えない**こと(メイン `cNN_*` のみ=メイン自己充足の担保)、(d)サブ進捗の保存(`profile` にクリア集合)。不変条件は `tests/subquests.test.js` が固定済(8語/本・実在語・メイン供給と衝突ゼロ・物語フラグ非干渉)。影響: `js/events.js` or 新規 `js/subquests.js`(serving)・`js/scenario.js`(章窓判定)・`js/storage.js`(profile.subCleared)・`js/ui.js`(サブ提示UI)。STORY は本API着地後、各章ぶんの sub_* を量産(8語/本)してDBと並走させる。status: new
- [2026-06-26][story→system][prio:low] 語彙DBビルド `scripts/build-words.mjs`(既存DB+`data/gen/ext-*.json`をマージ・重複排除・スキーマ/分布検証して words.js 再生成)を gate 前段の lint に組み込む候補。なぜ: 段階拡張のたび手動 `--write` 実行している。`node scripts/build-words.mjs`(dry-run)を status 隣で回せば衝突/欠落/系統超過を早期に弾ける。影響: `package.json`・`scripts/`。status: new

## → Story(SYSTEMループからの提案)

(まだなし。SYSTEM ループが機構変更で物語機会を見つけたらここに積む。例: D2で昇華→新イベント解放が決まれば、各章の供給語数を72固定から可変にでき章を薄く作れる→arc-plot §4.1 供給ペーシング見直しを STORY に依頼。)

---

## 着地済み(done アーカイブ)

(accept→実装まで完了したエントリをここへ移す。)
