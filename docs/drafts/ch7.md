# 第7章「都の取引」素案 ―『ともしび』(新canon)

作成: 2026-06-22 / 正典: `docs/drafts/arc-plot.md`(§4.2 ch7・§5.3 分岐・§6 ED). 自走ループ STORY。**配線稿(§1)** — 直接 `js/scenario.js`/`data/events.js` へ実装。§2多ペルソナレビュー(high0)反映済。

- **舞台/型**: 王都(分岐前夜・王家が翳りを兵器転用・政治取引/捜査劇). **位階 L3-4**, 推奨系統 **society/business**.
- **ボス**: 灯札長(とうさつちょう)=言葉を紙で支配する男・ナラティブ/敗北なし・「握る vs 巡らせる」の思想戦. c07_130。
- **ゲート(章クリア)**: 定着語数 settled≥360 (arc-plot §4・c07_180)。
- **新キャラ**: なし(ユイ14・カガリ27・ガク15。四人継続).
- **シーン**: 20(c07_002〜c07_180)。STATUS目標24に対し83%(≥80%で配線判定OK)。
- **挿絵**: 後回し(0)。

## 供給語(88語=11イベント×8・`data/words.js`実在・既出384語と衝突ゼロ・全clozeable=機械検証済)
- **arc-plot §4.2 既定 society/business L3-4 に準拠。society はch3/ch5でほぼ枯渇**のため、**business L2-4(取引/役所/金=本章の中核)** を主軸に、society残(election/vote/media/international/demographic)+ **school L4(王都の知略・密約・記録)** + **travel(壮麗な王都への到着)** で88語を構成。中世王都の政治劇という主題に、business/政治/学究語を cast 詠唱で再文脈化(既定変換規約)。
- ev_c07_gate(王都へ・到着読み/travel): `destination terminal scenery passenger currency landmark transit boarding`
- ev_c07_bureau(灯札庁・お役所/business L3): `department headquarters agenda annual launch performance productive strategy`
- ev_c07_deal(取引の卓・交渉/business L2): `negotiate proposal client colleague approve available deadline schedule`
- ev_c07_coin(灯札と金・金の流れ/business): `revenue expense invoice salary invest promote merger supply`
- ev_c07_crown(王家の思惑・兵器化と世論操作/society+business): `election vote media international demographic significant stakeholder shareholder`
- ev_c07_scheme(密約の書・言葉の罠/school L4): `rhetoric articulate elaborate critique inference deduce manuscript chronicle`
- ev_c07_audit(灯札の監査・帳簿の綻び/business L4): `audit liability fiscal comply evaluate benchmark overhead transparent`
- ev_c07_restruct(都の再編・逃げる王家/business L4): `acquisition restructure procurement portfolio recession surplus turnover leverage`
- ev_c07_records(王都の記録・声の出自探し/school L4): `heritage scholarly paradigm empirical literacy annotate obsolete symposium`
- ev_c07_favor(声のお願い・本音と委ねる/school+business): `delegate implement incentive outsource dissertation synthesis pedagogy aesthetic`
- ev_c07_boss(灯札長・握る vs 巡らせる/business+travel): `manager career open resign successful navigate itinerary route`

> **char_arc / 物語の核**: ①**route確定(§5.3)** — c07_170 で player が「何のために灯をともすか」を選ぶ=route(hero=都に残り灯を巡らせる/yui=ユイと流れていく/quiet=静かに退く)。**yui ルートは yui≥6 で解錠**(未満でも選択肢は見えるがグレー無効+一言「まだ、その手を取る資格がない気がした」=arc-plot §5.3)。**per-option `req` 機構を新規実装**(`js/ui.js` choice描画 + 選択肢 `req:{yui:6}`/`lockNote`)。route は非分岐(全選択肢→c07_180・ch8幕間差分にのみ作用)。②**カンテラのお願い初出** — 声が初めて皮肉を捨て、{name}に頼みごとをする(c07_070=唯一の「お願い」)。以降は反復でなく前進=c07_100/ev_records(出自=トワの最初の一語の発見)、c07_110/ev_favor(「期待してまた置いていかれるのが怖かった」の弱さの告白)。③**カガリの翳り予兆**(c07_150)=学び舎c03_140で覗いた利き腕の影が濃くなる=ch8「カガリ灯詞半失」の布石(袖で隠す・一度だけ・抑制的)。

> **感動設計**: 捜査劇の高揚(取引→金の流れ→王家の企て暴き→密約→監査→再編)を背骨に、その只中に**カンテラのお願い**(声の人間化・本作の感情の転換点)を据え、章末で**route選択**(プレイヤー自身の価値の表明)へ。山=灯札長戦(言葉を握る男 vs 巡らせる{name}=本作テーマの人物対決・斬らず思想で勝つ)。締め=分岐前夜の静けさ(カガリ翳り・ユイの覚悟)→灰都への出立。裏テーマ「交わさない言葉は失われる」は灯札長の握り拳から灯詞がこぼれる**描写**で示し、地の文の講釈は避ける(§2レビューで地の文の説明線を1本削除)。

> **謎**: カンテラ=トワが灰都に集めた「いちばん最初に呼ばれなくなった一語」=声の出自が c07_100/ev_records で(断片的に)開示。隠しED鍵 lonely との直結は名指さず温存。トワ/灰都への接続は c07_180 で「すべての終わりと始まりの場所」として次章(ch8)へ。

---

## シーン→イベント対応(配線=`js/scenario.js`/`data/events.js`が正)
| scene | event(gate.read) | フラグ | 役割 |
|---|---|---|---|
| c07_002 王都へ | ― (action) | ― | 導入・四人で王都へ |
| c07_010 王都の門 | ev_c07_gate | 3択 | 壮麗な都・お願いの予兆 |
| c07_020 灯札庁 | ev_c07_bureau | ― | お役所の壁 |
| c07_030 取引の卓 | ev_c07_deal | ― | 王家の依頼・即答回避 |
| c07_040 灯札と金 | ev_c07_coin | ― | 金の流れ=トワの符合 |
| c07_050 王家の思惑 | ev_c07_crown | ― | 翳り兵器化・世論操作 |
| c07_060 密約の書 | ev_c07_scheme | ― | 手稿入手 |
| c07_070 **カンテラのお願い** | ― | ― | **声の唯一の「お願い」** |
| c07_080 灯札の監査 | ev_c07_audit | ― | 数字の証拠 |
| c07_090 都の再編 | ev_c07_restruct | ― | 逃げる王家を押さえる |
| c07_100 王都の記録 | ev_c07_records | ― | 声の出自=最初の一語 |
| c07_110 声のお願い | ev_c07_favor | ― | 声の弱さの告白 |
| c07_120 最上階へ | ― | ― | ボス前 |
| c07_130 灯札長 | ev_c07_boss | ― | **思想戦ボス** |
| c07_140 こぼれる灯 | ― | ― | 勝利=握る理の崩壊 |
| c07_145 取引のあと | ― | ― | 企て白紙・次は灰都 |
| c07_150 分岐前夜 | ― | ― | **カガリ翳り予兆(ch8布石)** |
| c07_160 ユイと、決める前に | ― | yui+1 | route前の助走 |
| c07_170 分かれ道 | ― | **route=hero/yui/quiet** | **route確定(yui≥6解錠)** |
| c07_180 灰都へ | ― (action) | gate settled≥360 | 締め・出立 |

> 凡例・規約は ch4-6.md に同じ。誤答固定文言「灯らなかった。言葉は胸に戻った。――もう一度。」(無罰)。本文に英単語を直挿ししない。
