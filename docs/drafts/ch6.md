# 第6章「帰れない村」素案 ―『ともしび』(新canon)

作成: 2026-06-22 / 正典: `docs/drafts/arc-plot.md`(§4.2 ch6). 自走ループ STORY。**配線稿(§1)** — 直接 `js/scenario.js`/`data/events.js` へ実装(本文の正は配線コード)。§2多ペルソナレビュー(high0)反映済。

- **舞台/型**: ナギ村跡(故郷帰還・**全ルート完全共通章=差分ゼロの休憩区間**・中盤の感情の底). **位階 L3**, 推奨系統 **nature/food**.
- **ボス**: 翳竜(えいりゅう)の幼体(村を灰にした災いの仔・ナラティブ/敗北なし・「壊さず追い返す」勝ち方). c06_120。
- **ゲート(章クリア)**: 定着語数 settled≥290 (arc-plot §4・c06_150)。
- **新キャラ**: なし(ユイ14・カガリ27・ガク15。カガリ/ガクは ch5 で別行動→**c06_120 で再合流**・四人共闘=gaku加点機会).
- **シーン**: 16(c06_002〜c06_150)。STATUS目標16に対し100%。
- **挿絵**: 後回し(0)。次イテレーションで scenes.json に c06_010/040/120/130/150 等の brief 整備予定。

## 供給語(80語=10イベント×8・`data/words.js`実在・既出304語と衝突ゼロ・全clozeable=機械検証済)
- **arc-plot §4.2 既定の nature/food L3 に準拠**(feelings はch1-5で枯渇したため、本章の感情=ユイ忘却/弱音は**供給語でなく地の文**が担う方針)。難度は nature/food L2-3 中心、災害系の一部 L4(volcanic/tsunami)を翳竜戦に充当。
- ev_c06_gate(灰になった村・荒れ地の到着読み): `desert drought erosion climate atmosphere absorb evaporate habitat`
- ev_c06_field(枯れた畑・ひもじさと糧): `harvest hunger appetite preserve nutrition ingredient meal recipe`
- ev_c06_ecos(灰の中の生き物・断たれた命のめぐり): `ecosystem organism species predator reproduce solar organic fossil`
- ev_c06_memory(村の記憶・**ユイ忘却①**): `flower insect leaf seed soil wild wet branch`
- ev_c06_sick(病む者を診る・手当て): `fever medicine symptom stomach thirsty boil healthy fresh`
- ev_c06_storm(灰嵐・嵐をしのぐ): `mineral oxygen frozen melt wave thunder volcano pollute`
- ev_c06_nourish(養う・身体の土台): `calorie protein diet vitamin delicious fry serve allergy`
- ev_c06_forage(灰の糧・森の恵み・**ユイ忘却②**): `beverage digest flavor grilled moderate muscle physician portion`
- ev_c06_body(生き残りの身体・回復): `body health doctor hospital sick exercise water recommend`
- ev_c06_dragon(翳竜の幼体・四人共闘): `volcanic tsunami chemical gravity observe recycle migrate extinct`

> **§2レビュー対応(high0)**: ①近代科学語の没入破り(両ペルソナ HIGH)→ 最も字義が前近代と衝突する `molecule`(分子/水素原子)・`photosynthesis`(光合成)を **`organic`(有機の)・`fossil`(化石)** に差し替え(ecos beat=「死の地層に根を張る生きた緑」へ再演出)。残る atmosphere/climate/erosion/solar/oxygen/gravity/chemical/volcano/tsunami 等は「前近代人にも知覚できる現象」かつ cast 詠唱で詩的に再文脈化(ch5 の政治L4語と同じ既定変換規約)として許容。②再合流のご都合感(MED)→ c06_110 に「カガリ/ガクが谷のすぐそこまで」の予告線を追加し約束の回収を“予告された合流”化。③弱音の唐突さ(MED)→ c06_130 の勝利→決壊の間に「四人が散り、二人きりの長い静けさ」の緩衝を挿入。誤答無罰・フラグ加算のみ・忘却非機械・英語非混入は監査で全PASS。

> **char_arc**: ユイ(14): 本章の主役。世話係としてフル稼働(病人の手当て c06_060、養い c06_080)しつつ、**忘却が段階的に深まる**(c06_040 菜の花の名→ev_memory {name}を呼んだ名→c06_090 言いかけが消える・本人自覚→c06_130 自覚の告白→c06_150 {name}の名が一瞬迷子)。終盤の決壊「弱音を言わない子」の初の弱音=c06_130(yui+2「ふりなんて、しなくていい」)。{name}=アキ: 灰の故郷を前に、守れなかった悔いを背負い、村の世話役として再建を担う(リーダーシップの成長)。消えた大灯を「いつか灯し直す」と心に刻む(終章の再点灯の伏線)。カガリ/ガク: c06_120 再合流・四人共闘(gaku+1「組もう、ガク」)。翳竜を斬らず追い返す={name}の「壊さない勝ち方」をガクが言語化(F物語)。

> **感動設計**: 中盤の底(振幅の谷)。緩(休憩章)を基調に、不穏(灰嵐c06_070/谷の地鳴りc06_100)→山(翳竜戦c06_120)→決壊(弱音c06_130)→締めの灰色の緩(c06_150)。故郷が灰=喪失の極point を、生活再建(食/手当て/養い)の地味な積みで描き、その合間にユイ忘却を散らす。**モチーフ「大灯」は最後まで消えたまま**(c06_050「種火もない…でも、いつか」/c06_140「まだ消えたまま」/c06_150「消えたままの大灯を灰の谷に残して」)=中盤の“灯が消えかける”底を確定し、終章の再点灯を効かせる。裏テーマ「交わさない言葉は失われる」は**ユイの忘却そのもの**(言葉が抜けていく)で描写のみ・講釈しない。

> **謎(F4本格化)**: ユイの忘却(arc-plot §3・F4)が本章で**はっきり進む**。ch4 c04_120(言いかけて呑む)→ch5 c05_150(村の鐘の呼び名が出ない)を受け、本章で「村の固有名詞→花の名→{name}の名」へと、いちばん馴染んだ名前から段階的に抜けていく(設定どおり)。終章のF4決壊(アキの名を完全に忘れる)への助走。**物語駆動のみ・クイズ成績に一切連動しない**(arc-plot §10)。井戸の底の声=トワ(ch5)との因果は本章では触れず温存。

---

## シーン→イベント対応(配線=`js/scenario.js`/`data/events.js`が正)
| scene | title | event(gate.read) | フラグ | 役割 |
|---|---|---|---|---|
| c06_002 | 帰り道 | ― | action | 導入・故郷へ |
| c06_010 | 灰になった村 | ev_c06_gate | 3択/加算なし | 喪失の極point・大灯消失 |
| c06_020 | 枯れた畑 | ev_c06_field | ― | ひもじさ・生きる土台 |
| c06_030 | 灰の中の生き物 | ev_c06_ecos | ― | 断たれた命/芽吹き |
| c06_040 | 村の記憶 | ev_c06_memory | ― | **ユイ忘却①** |
| c06_050 | 消えた大灯 | ― | ― | モチーフ大灯=底 |
| c06_060 | 生き残った人々 | ev_c06_sick | ― | 手当て |
| c06_070 | 灰嵐の夜 | ev_c06_storm | ― | 不穏・嵐をしのぐ |
| c06_080 | 養う | ev_c06_nourish | ― | 再建の地味な積み |
| c06_090 | 灰の糧 | ev_c06_forage | ― | **ユイ忘却②深化** |
| c06_100 | 谷の底の影 | ― | ― | ボス予兆 |
| c06_110 | 生き残りの身体 | ev_c06_body | ― | 回復・合流予告 |
| c06_120 | 翳竜の幼体 | ev_c06_dragon | 3択a=**gaku+1** | **ボス四人共闘** |
| c06_130 | 弱音 | ― | 3択a=**yui+2** | **弱音初出** |
| c06_140 | まだ消えたまま | ― | ― | 大灯=底の再確認 |
| c06_150 | 灰の村をあとに | ― | 3択/gate settled≥290 | 締め・**忘却③**・次章へ |

> 凡例・規約は ch4.md/ch5.md に同じ。誤答固定文言「灯らなかった。言葉は胸に戻った。――もう一度。」(無罰)。本文に英単語を直挿ししない。
