# STORY ループ backlog ―『ともしび』物語の完結＋物語実装

> STORY ループ(`loops.md`)の queue。**上から処理**。1イテレーション1件 → gate緑 → 台帳/本欄更新。
> 章の進捗そのものは機械台帳 `STATUS.md`(`npm run status`)が正。本欄は **章以外の物語実装タスク**＋章の補足を持つ。
> 安全網: `npm run gate`。物語/UI変更は任意で `/qa-playtest`(vision)。画像生成は後回し(brief止まり)。

---

## A. 章の配線(主軸・STATUS が台帳)
- 進捗: **配線 9/9・完了 9/9・ED 4/4**(ch1-9 済=全章配線完了・隠しED friend も STORY側配線完了=B-1)。STORY 完結タスクは残りゼロ(発火は SYSTEM の `flags._friendUnlocked` 投影待ち=bridge起票継続)。語彙DB 782→5000 は別トラック。
- ✅ ch9「きみの名前で」(終章)完了: 22シーン(共通c09_002〜120 + ED群cE_hero|yui|quiet_010-030)/5イベント(ev_c09_descent|core|towa|relay|vigil)/40語=全系統L5(school L5の5語はnature L5残3で補完)/gate450(CANON最終段)/ボス=トワ(集積核・呼ばれなかった孤独=lonelyの源・剣でなく『名を返す』方向で解放)/最大の喪失=c09_060(ユイがアキの名を忘れる)→c09_070(地の文から軽口が一度だけ消える)/とどめ=c09_090(積んだ30日=最高Stability語)。**ED分岐ロジック実装**=js/ui.js resolveNext(branchOn/branch・フラグ読むだけ・負効果ゼロ)+invariants.test.js sceneNexts に branch辺追加。truth差分=c09_110(true→c09_115一命/未報告→c09_117曖昧)。route分岐=c09_120(hero/yui/quiet)。yui ED=最強灯詞『おかえり』で締め。§2自己レビューhigh0。98テスト+smoke green。draft=ch9.md。
- ✅ ch8「灰都へ」完了: 18シーン(c08_002〜170)/11イベント(ev_c08_depart〜gate)/88語/gate420/進軍(同一ダンジョン)/全系統L4主軸(枯渇系統business・society・school・feelingsはL5/L3で代替・draft明記)/ボス灰の門番(ナラティブ思想戦c08_120)/**トワの正体・祖父因縁・lonelyの手触り開示(c08_070遺文/080隠された因縁/090さみしさの名/100溜め込みの理=トワ=アキの鏡像示唆)**/**カガリ自己犠牲=灯詞半失(c08_140崩落→150庇う・生死は曖昧に保持=truth差分は終章/EDで解決=engineにflag条件テキスト機構が無く新設はSYSTEM領域)**/gaku+1(c08_050)・yui+2(c08_090)。§2レビュー2軸(ディレクター物語+学習死守)とも high0。98テスト+smoke green。draft=ch8.md。
- ✅ ch7「都の取引」完了: 20シーン/11イベント/88語/gate360/ボス灯札長(思想戦)/**route確定(c07_170 hero|yui|quiet・yui≥6解錠=per-option req機構を新規実装)**/カンテラのお願い初出(c07_070)/カガリ翳り予兆(c07_150=ch8布石)/yui+1(c07_160)。§2レビュー2軸high0(学習死守全PASS・収束HIGH2=yui≥6ゲート実装/カンテラ反復をc07_070に集約・MED2反映)。98テスト+smoke green。draft=ch7.md。
- ✅ ch6「帰れない村」完了: 16/10/80/gate290/完全共通章/gaku+1(c06_120)/yui+2(c06_130弱音)/ボス翳竜の幼体/F4本格化/大灯消えたまま。§2 high0。draft=ch6.md。
- ✅ ch5「声のない町」完了: 16/9/72/gate220/truthフラグ初出(c05_110)/yui+2(c05_060)/F-mystery=トワ断片(c05_040)/F4=ユイ失語(c05_150)。§2 high0。draft=ch5.md。
- パイプライン: 素案→§2レビューhigh0→配線→gate→台帳(arc-plot §4.2)。
- ⚠ **ch7は route 確定章**(§5.3 分岐: hero/yui(≥6)/quiet)+ truth(ch5既出)。→ **B-1 ED分岐の受け皿(集計/分岐ロジック)を ch7 配線と同時 or 直前に実装**する必要が高まった。yui累計の到達性: ch1(+3)+ch2(+2)+ch3(+2)+ch4(+1)+ch5(+2)+ch6(+2)=最大12 → route=yui(≥6)は余裕で到達可能。

## B. 物語実装(章配線に付随する narrative コード)― todo
- ✅ **B-1. ED分岐ロジック(4ED)完了(2026-06-25 STORY側配線完了)**: 3ED(hero/yui/quiet)に加え、**隠しED friend を STORY 側で配線完了=`inCode:true`**。c09_118(`branchOn:'_friendUnlocked'`・read-only bool を見るだけ・加算/負効果なし)を c09_115/117→c09_120 の手前に挿入し、`true` で cE_friend_010 へ分岐(未投影=undefined なら静的フォールバックで c09_120=既存3ED経路は不変)。cE_friend_010-030 + ev_cE_friend(8語=全L1 sun/breakfast/bedroom/sleep/visit/station/funny/friend・衝突ゼロ・全cloze✓)を追加。真名 lonely は recall(既習・ev_c05_streets供給済=event castには出さず衝突回避)、対句反転(さみしい↔ともだち)は cE_friend_020/030 の地の文で回収。本文英語直挿しゼロ・1シーン2〜3行・99テスト+smoke green。**残ブロッカーは SYSTEM のみ**: 解錠の発火は SYSTEM が `flags._friendUnlocked` を投影(全ED周回+S≥90語50本→真偽)した時だけ=bridge →System 起票継続(現状 js/ に投影なし=隠しEDは到達しないが既存EDへの影響ゼロ)。SYSTEM がAPIを着地させれば STORY 追加作業ゼロで友エンドが解錠される。
- (旧記述・隠しED friend の経緯)**残=隠しED friend のみ**: 解錠条件『全ルートクリア後＋語り部級(S≥90)50語』が周回/完了の状態管理を要し STORY フラグでは表現不可 → bridge.md `## → System`(2026-06-24)に機構を起票済。**STORY側の完成設計は `docs/drafts/cE_friend.md` に用意済(2026-06-24)**=供給語(L1 feelings 8語=lonely/friend ほか・既出衝突ゼロ)/シーン cE_friend_010-030/挿入位置 c09_118(route分岐の手前で read-only bool `flags._friendUnlocked` を見るだけ)/感動設計まで確定。SYSTEM が解錠API(end到達記録+S≥90カウント→`flags._friendUnlocked` 投影)を着地させたら、STORY は branch1本+3シーン+ev_cE_friend を足し endings.friend.inCode:true 化するだけで完結。**[2026-06-25 供給語事前検証]** 当初の供給案(L1 feelings 8語 lonely/friend ほか)は無効=feelings系枯渇(既出未供給は friend/funny の2語のみ・lonely/hope/trust/smile/happy/sad/love はすべて既出衝突)を発見し、cE_friend.md §2 を訂正(確定8語=friend/funny/sun/breakfast/sleep/bedroom/visit/station・全L1・衝突ゼロ・cloze✓/lonely は recall既習として cast に出し新規供給に数えない)。**STORY側の事前準備は完了、残ブロッカーは SYSTEM の `flags._friendUnlocked` API 1点のみ。**
- ✅ **B-2. さしいれ(鐘配信)機能(2026-06-25 完了)**: ユイのさしいれを7通→**24通**へ拡充し、旅の30日に沿う**刷り込みの弧**として順次配信化(`js/party.js` letters[24] + `readLetter` の `letterIdx` 順送り・24通読了後は無作為再送で毎日の接触を継続)。弧=前半(世話と軽口+好物bread/hope/灯心)→中盤(『おかえり/ただいま』無害反復+言葉が遠い予兆の初出)→後半(灯心が最後の一個へ/名を呼べない一瞬=**F4忘却の落差の土台**)→締め『おかえり、って言いたいな』。効果はHP+15%の加算・無罰のみ(凍結機構不変)・本文に説教なし。`storage` に `party.letterIdx` 新設(既存セーブは `||0` で後方互換)。日次配信UI(💌ボタン/物語シート)は既存を流用。`tests/armory.test.js` に24通ユニーク順次配信のロック追加。`STATUS.state.json sashiire:24`(100%)・99テスト+smoke green。
- ✅ **B-3. ch4 post-fix 確認レビュー(2026-06-24 完了)**: AI多ペルソナ2軸独立(ディレクター物語A-F軸+学習死守監査)を並列起動し **high0 を再確認**。再発論点(yui三重印字/F4二度置き/ch3逐語使い回し/「下から」連打)すべて非再発、英単語の本文直挿しゼロ、供給72語 cloze可・章跨ぎ衝突ゼロ、フラグ加算のみ。コード変更なし(98テスト+smoke green維持)。残MED=c04_040の制度情報密度(将来の磨き・出荷可)。STATUS ch4 ノートに記録済。
- ✅ **B-4. 章扉の原文断片(修復率)表示の実装(2026-06-26 完了)**: 確認の結果 **未実装**(js/ に修復率/原文の描画ゼロ)だったため STORY 範囲(章扉=js/ui.js)で実装。`CHAPTER_DOORS`(ch1-8 の原文1行ずつ・arc-plot §2.5「章扉8行のみの限定実装」に一致)を ui.js に追加し、各章末シーン(c01_180/c02_130/c03_170/c04_160/c05_150/c06_150/c07_180/c08_170)で全行公開後に原文断片を差し込む。`[[語]]`=契約 headword で**黄金(S≥30)に育てた語だけ英語で灯り**、未到達は◆◆。修復率=契約語数(reps>0)/782 を併記。終章ED締め(cE_*_030)で**全8行を英語で一括開示**(段階開示の回収=学習目標と物語目標の一致)。供給語は既存 DB の実在 headword のみ(walk/road/far/family/friend/open/door/people/sell/buy/rule/read/book/answer/call/help/lost/hope/sleep/money/sign/trust/protect/brave=全26語・衝突や新規供給ではなく**既習語の再活用**ゆえ8語/本制約と無関係)。本文 lines への英語直挿しはゼロ(原文は表示専用ブロック)。tests/invariants.test.js に原文語の DB 実在ロック追加=**100テスト+smoke green**。CSS=.door-block 系を style.css に追加。**残=SYSTEM へ起票済の「昇華/章ボス到達で修復率が一段上がる演出/通知フック」(bridge story→system med・現状は静的表示)** は SYSTEM 領域につき STORY 側作業なし。

## C. 挿絵(A1 由来・生成はユーザpipeline)― 生成待ち
- brief は ch1-4 全シーン分 `scripts/imggen/scenes.json` に整備済(ch3: c03_010/100/120/130/170、ch4: c04_010/080/100/140/160 ほか)。
- **私の担当**: ユーザが外部ComfyUI/gpt-image-2 で生成 → `out/scenes/*.png` → `scripts/png2webp.py` → `assets/img/scene_*.webp` → `js/ui.js SCENE_ART` 登録。最終差し替えは gpt-image-2 後段。
- 新章(ch5+)は**最初から全シーン brief** を標準にする(配線時に scenes.json へ)。

## E. 語彙拡充＋サブクエスト(任意供給トラック)― 進行中
- 設計正典: `docs/vocab-growth-design.md`(段階1→2,400 / 段階2→5,000・メイン/サブ分離)。ユーザ確定: 5,000語=高校卒業B2。
- **パイプライン(2026-06-26 整備)**: `scripts/build-words.mjs` = 既存DB + `data/gen/ext-*.json`(段階拡張バッチ)をマージ→`w`重複排除(既存優先)→スキーマ(w/p/j/l/f/ex/jx)・系統上限(625)検証→分布レポート→`data/words.js`再生成。`node scripts/build-words.mjs`(dry-run)/`--write`(反映)。
- **サブのデータ層(2026-06-26 新設)**: `data/subquests.js`(`SUBQUESTS[]`)。★EVENTSと別ファイル/別名前空間=メインの `eventAvailable` に混ざらない(ランタイム未実装でも漏れない)。各サブは**章バインド3点**を必須: `chapter`/`unlockAfter`(その章のシーン読了で解禁)/`placementBefore`(次章開始前に消化する窓)。本文もその章に密接。不変条件は `tests/subquests.test.js`(8語/本・実在語・メイン供給と衝突ゼロ・サブ間一意・物語フラグ非干渉)。
- **試走(型決め・完了)**: 段階1バッチ `data/gen/ext-stage1-travel.json`(travel新語24=L1-2・衝突ゼロ)→ DB 782→**806**。サブ1本 `sub_c02_brokenbridge`「落ちた橋の行商人」(ch2街道の逃避行に絡む・travel8語: bridge/tunnel/roadside/detour sign/crossroad/ferry/harbor/compass)。106テスト+smoke green。
- **2026-06-27 第4イテレーション**: 段階1バッチ2本追加 `ext-stage1-society.json`(society新語24=王都/市政/城/身分L1-2)・`ext-stage1-business.json`(business新語24=交易/帳簿/金銭L1-2)→ DB 902→**950**(society125/business125・系統上限625内)。サブ2本: `sub_c07_gatekeeper`「王都の門番」(ch7「王都へ」大門・大路に絡む・society8語: gate/guard/crowd/square/palace/castle/wall/tower)、`sub_c08_ledgerroom`「記録院の帳簿」(ch8「王家の思惑/王都の記録」に絡む・business8語: trade/goods/cargo/merchant/account/ledger/stock/wealth)。各2-2-review-2-2-review構成・物語フラグ非干渉。106テスト+smoke green。
- **2026-06-26 第3イテレーション**: 段階1バッチ2本追加 `ext-stage1-feelings.json`(feelings新語24=感情・表情・態度L1-2)・`ext-stage1-nature.json`(nature新語24=地形・水辺・天候・畑L1-2)→ DB 854→**902**(feelings123/nature117・系統上限625内)。サブ2本: `sub_c05_laughingwell`「井戸端の、笑い方」(ch5「声のない町」喋れない人々に絡む・feelings8語: laugh/joy/grin/cheer/gentle/warmth/glad/calm)、`sub_c06_witheredfield`「枯れた畑の名残り」(ch6「灰になった村」枯れた畑に絡む・nature8語: field/crop/weed/ash/dust/mud/stone/grass)。各2-2-review-2-2-review構成・物語フラグ非干渉。106テスト+smoke green。
- **2026-06-26 第2イテレーション**: 段階1バッチ2本追加 `ext-stage1-food.json`(food新語24=市場/台所L1-2)・`ext-stage1-school.json`(school新語24=学び舎/文房具L1-2)→ DB 806→**854**(food127/school123・系統上限625内)。サブ2本: `sub_c03_marketstall`「門前の市の売り子」(ch3交易街の市に絡む・food8語: market/stall/plate/bowl/soup/salad/cheese/sauce)、`sub_c04_lendinghand`「学び舎の落とし物」(ch4灯詠み学院に絡む・school8語: pen/paper/ruler/eraser/page/sentence/uniform/bell)。各2-2-review-1-1-2-review構成・物語フラグ非干渉。106テスト+smoke green。
- **配信ランタイムは SYSTEM 領域**(ユーザ指示=データだけ作る): bridge → System(2026-06-26 prio:high)に起票。serving/供給/80%除外/保存を SYSTEM が着地後、STORY が各章ぶん sub_* を量産。
- **次の機械作業**: ①段階1の他系統バッチ(daily/food…のL1-2新語を ext-* で追加し →2,400へ前進)、②各章にひもづくサブを量産(章テーマに寄せた供給語で・8語/本)。供給語選定時は build-words の dry-run と subquests.test で衝突を都度確認。

## D. ブリッジ受信
- イテレーション冒頭で `bridge.md` の `## → Story` を読みトリアージ(accept→本欄へ転記/reject)。

---
## 完了履歴(章)
- ch1(出荷確定稿) / ch2(16シーン/6イベ/48語/gate40) / ch3(18/8/64/gate90・high0) / ch4(17/9/72/gate150・8high修正) — 詳細は `STATUS.state.json` 各章ノート。
