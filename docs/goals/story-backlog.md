# STORY ループ backlog ―『ともしび』物語の完結＋物語実装

> STORY ループ(`loops.md`)の queue。**上から処理**。1イテレーション1件 → gate緑 → 台帳/本欄更新。
> 章の進捗そのものは機械台帳 `STATUS.md`(`npm run status`)が正。本欄は **章以外の物語実装タスク**＋章の補足を持つ。
> 安全網: `npm run gate`。物語/UI変更は任意で `/qa-playtest`(vision)。画像生成は後回し(brief止まり)。

---

## A. 章の配線(主軸・STATUS が台帳)
- 進捗: **配線 9/9・完了 9/9・ED 3/4**(ch1-9 済=全章配線完了)。残=隠しED friend(B-1)のみ。
- ✅ ch9「きみの名前で」(終章)完了: 22シーン(共通c09_002〜120 + ED群cE_hero|yui|quiet_010-030)/5イベント(ev_c09_descent|core|towa|relay|vigil)/40語=全系統L5(school L5の5語はnature L5残3で補完)/gate450(CANON最終段)/ボス=トワ(集積核・呼ばれなかった孤独=lonelyの源・剣でなく『名を返す』方向で解放)/最大の喪失=c09_060(ユイがアキの名を忘れる)→c09_070(地の文から軽口が一度だけ消える)/とどめ=c09_090(積んだ30日=最高Stability語)。**ED分岐ロジック実装**=js/ui.js resolveNext(branchOn/branch・フラグ読むだけ・負効果ゼロ)+invariants.test.js sceneNexts に branch辺追加。truth差分=c09_110(true→c09_115一命/未報告→c09_117曖昧)。route分岐=c09_120(hero/yui/quiet)。yui ED=最強灯詞『おかえり』で締め。§2自己レビューhigh0。98テスト+smoke green。draft=ch9.md。
- ✅ ch8「灰都へ」完了: 18シーン(c08_002〜170)/11イベント(ev_c08_depart〜gate)/88語/gate420/進軍(同一ダンジョン)/全系統L4主軸(枯渇系統business・society・school・feelingsはL5/L3で代替・draft明記)/ボス灰の門番(ナラティブ思想戦c08_120)/**トワの正体・祖父因縁・lonelyの手触り開示(c08_070遺文/080隠された因縁/090さみしさの名/100溜め込みの理=トワ=アキの鏡像示唆)**/**カガリ自己犠牲=灯詞半失(c08_140崩落→150庇う・生死は曖昧に保持=truth差分は終章/EDで解決=engineにflag条件テキスト機構が無く新設はSYSTEM領域)**/gaku+1(c08_050)・yui+2(c08_090)。§2レビュー2軸(ディレクター物語+学習死守)とも high0。98テスト+smoke green。draft=ch8.md。
- ✅ ch7「都の取引」完了: 20シーン/11イベント/88語/gate360/ボス灯札長(思想戦)/**route確定(c07_170 hero|yui|quiet・yui≥6解錠=per-option req機構を新規実装)**/カンテラのお願い初出(c07_070)/カガリ翳り予兆(c07_150=ch8布石)/yui+1(c07_160)。§2レビュー2軸high0(学習死守全PASS・収束HIGH2=yui≥6ゲート実装/カンテラ反復をc07_070に集約・MED2反映)。98テスト+smoke green。draft=ch7.md。
- ✅ ch6「帰れない村」完了: 16/10/80/gate290/完全共通章/gaku+1(c06_120)/yui+2(c06_130弱音)/ボス翳竜の幼体/F4本格化/大灯消えたまま。§2 high0。draft=ch6.md。
- ✅ ch5「声のない町」完了: 16/9/72/gate220/truthフラグ初出(c05_110)/yui+2(c05_060)/F-mystery=トワ断片(c05_040)/F4=ユイ失語(c05_150)。§2 high0。draft=ch5.md。
- パイプライン: 素案→§2レビューhigh0→配線→gate→台帳(arc-plot §4.2)。
- ⚠ **ch7は route 確定章**(§5.3 分岐: hero/yui(≥6)/quiet)+ truth(ch5既出)。→ **B-1 ED分岐の受け皿(集計/分岐ロジック)を ch7 配線と同時 or 直前に実装**する必要が高まった。yui累計の到達性: ch1(+3)+ch2(+2)+ch3(+2)+ch4(+1)+ch5(+2)+ch6(+2)=最大12 → route=yui(≥6)は余裕で到達可能。

## B. 物語実装(章配線に付随する narrative コード)― todo
- **B-1. ED分岐ロジック(4ED)**: 3ED(hero/yui/quiet)は ch9 終章で実装完了=`inCode:true`(js/ui.js resolveNext で branchOn:route 出し分け+branchOn:truth でカガリ生死差分)。**残=隠しED friend のみ**: 解錠条件『全ルートクリア後＋語り部級(S≥90)50語』が周回/完了の状態管理を要し STORY フラグでは表現不可 → bridge.md `## → System`(2026-06-24)に機構を起票済。**STORY側の完成設計は `docs/drafts/cE_friend.md` に用意済(2026-06-24)**=供給語(L1 feelings 8語=lonely/friend ほか・既出衝突ゼロ)/シーン cE_friend_010-030/挿入位置 c09_118(route分岐の手前で read-only bool `flags._friendUnlocked` を見るだけ)/感動設計まで確定。SYSTEM が解錠API(end到達記録+S≥90カウント→`flags._friendUnlocked` 投影)を着地させたら、STORY は branch1本+3シーン+ev_cE_friend を足し endings.friend.inCode:true 化するだけで完結。**[2026-06-25 供給語事前検証]** 当初の供給案(L1 feelings 8語 lonely/friend ほか)は無効=feelings系枯渇(既出未供給は friend/funny の2語のみ・lonely/hope/trust/smile/happy/sad/love はすべて既出衝突)を発見し、cE_friend.md §2 を訂正(確定8語=friend/funny/sun/breakfast/sleep/bedroom/visit/station・全L1・衝突ゼロ・cloze✓/lonely は recall既習として cast に出し新規供給に数えない)。**STORY側の事前準備は完了、残ブロッカーは SYSTEM の `flags._friendUnlocked` API 1点のみ。**
- ✅ **B-2. さしいれ(鐘配信)機能(2026-06-25 完了)**: ユイのさしいれを7通→**24通**へ拡充し、旅の30日に沿う**刷り込みの弧**として順次配信化(`js/party.js` letters[24] + `readLetter` の `letterIdx` 順送り・24通読了後は無作為再送で毎日の接触を継続)。弧=前半(世話と軽口+好物bread/hope/灯心)→中盤(『おかえり/ただいま』無害反復+言葉が遠い予兆の初出)→後半(灯心が最後の一個へ/名を呼べない一瞬=**F4忘却の落差の土台**)→締め『おかえり、って言いたいな』。効果はHP+15%の加算・無罰のみ(凍結機構不変)・本文に説教なし。`storage` に `party.letterIdx` 新設(既存セーブは `||0` で後方互換)。日次配信UI(💌ボタン/物語シート)は既存を流用。`tests/armory.test.js` に24通ユニーク順次配信のロック追加。`STATUS.state.json sashiire:24`(100%)・99テスト+smoke green。
- ✅ **B-3. ch4 post-fix 確認レビュー(2026-06-24 完了)**: AI多ペルソナ2軸独立(ディレクター物語A-F軸+学習死守監査)を並列起動し **high0 を再確認**。再発論点(yui三重印字/F4二度置き/ch3逐語使い回し/「下から」連打)すべて非再発、英単語の本文直挿しゼロ、供給72語 cloze可・章跨ぎ衝突ゼロ、フラグ加算のみ。コード変更なし(98テスト+smoke green維持)。残MED=c04_040の制度情報密度(将来の磨き・出荷可)。STATUS ch4 ノートに記録済。
- **B-4. 章扉の原文断片(修復率)表示の実装確認**: 各章末で「黄金到達語のみ英語・他は◆◆＋修復率」を段階開示する演出。現状 brief/設計のみで実装状況の確認が要る。

## C. 挿絵(A1 由来・生成はユーザpipeline)― 生成待ち
- brief は ch1-4 全シーン分 `scripts/imggen/scenes.json` に整備済(ch3: c03_010/100/120/130/170、ch4: c04_010/080/100/140/160 ほか)。
- **私の担当**: ユーザが外部ComfyUI/gpt-image-2 で生成 → `out/scenes/*.png` → `scripts/png2webp.py` → `assets/img/scene_*.webp` → `js/ui.js SCENE_ART` 登録。最終差し替えは gpt-image-2 後段。
- 新章(ch5+)は**最初から全シーン brief** を標準にする(配線時に scenes.json へ)。

## D. ブリッジ受信
- イテレーション冒頭で `bridge.md` の `## → Story` を読みトリアージ(accept→本欄へ転記/reject)。

---
## 完了履歴(章)
- ch1(出荷確定稿) / ch2(16シーン/6イベ/48語/gate40) / ch3(18/8/64/gate90・high0) / ch4(17/9/72/gate150・8high修正) — 詳細は `STATUS.state.json` 各章ノート。
