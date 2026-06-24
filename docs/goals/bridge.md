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
- [2026-06-24][story→system][prio:med] 隠しED「friend」の解錠トラッキング機構。なぜ: 終章ch9で3ルートED(hero/yui/quiet)は配線済(branchOn:route で出し分け)だが、隠しfriend(arc-plot §6・lonely↔friend 対句反転で締め)の解錠条件『全ルートクリア後＋語り部級(S≥90)50語』は、(a)どのルートEDを到達済みか(end到達フラグ集合)、(b)S≥90語の本数カウント、という**周回/完了の状態管理**を要し、STORY範囲のフラグ(加算のみ+truth/route列挙)では表現できない。提案: profile.scenario に endsCleared:Set 相当(end到達時に route を記録)+ `js/mastery.js` で S≥90語数のゲッタを用意し、両条件成立で c09_120 等から friend 分岐を解錠(STORY側は branch を1本足すだけで済むAPIにしたい)。影響: `js/storage.js`(profile拡張)・`js/ui.js`(end到達記録/解錠判定)・`js/mastery.js`(S≥90カウント)。着地後 STORY が friend ED 本文(cE_friend_*・L1語 friend/lonely)を配線し endings.friend.inCode:true 化。**STORY側の完成設計を `docs/drafts/cE_friend.md` に用意済(2026-06-24)＝API契約の具体案も同稿に明記: 解錠判定を read-only bool `flags._friendUnlocked` に投影してくれれば、STORY は c09_118 に branch を1本 + cE_friend_010-030 + ev_cE_friend(L1 feelings 8語)を足すだけで配線完了できる**。status: new

## → Story(SYSTEMループからの提案)

(まだなし。SYSTEM ループが機構変更で物語機会を見つけたらここに積む。例: D2で昇華→新イベント解放が決まれば、各章の供給語数を72固定から可変にでき章を薄く作れる→arc-plot §4.1 供給ペーシング見直しを STORY に依頼。)

---

## 着地済み(done アーカイブ)

(accept→実装まで完了したエントリをここへ移す。)
