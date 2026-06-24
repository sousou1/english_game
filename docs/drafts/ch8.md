# 第8章「灰都へ」素案 ―『ともしび』(新canon)

作成: 2026-06-24 / 正典: `docs/drafts/arc-plot.md`(§4.2 ch8・§5.3 分岐・§6 ED). 自走ループ STORY。**配線稿(§1)** — 直接 `js/scenario.js`/`data/events.js` へ実装。

- **舞台/型**: 灰都への進軍(同一ダンジョン・ルート幕間差分のみ). **位階 L4(全系統)**. 灰の荒野→外郭の廃墟→門前→灰の門番戦.
- **ボス**: 灰の門番(はいのもんばん)=灰都の入口を守る、トワが言葉で組み上げた門の番人. ナラティブ(敗北なし). c08_120/ev_c08_gate。
- **ゲート(章クリア)**: 定着語数 settled≥420 (arc-plot §4・c08_170)。
- **新キャラ**: なし(ユイ/カガリ/ガク+カンテラの声 継続).
- **シーン**: 18(c08_002〜c08_170)。STATUS目標22に対し82%(≥80%で配線判定OK)。
- **挿絵**: 後回し(0)。

## 供給語(88語=11イベント×8・`data/words.js`実在・既出472語と衝突ゼロ・全clozeable=機械検証済)
- **arc-plot §4.2 既定「全系統 L4」に準拠**。L4を主軸に、枯渇系統(business/society/school/feelings はL4が僅少)は近縁の L5/L3 で代替し以下に明記。全系統を横断する“総ざらい”章として設計。
- ev_c08_depart(灰へ続く道/travel L4): `desolate detour embark disembark excursion expedition layover orientation`
- ev_c08_wilds(枯れた大地/nature L4): `deforestation dormant biodiversity atmospheric catalyst hibernate sediment turbulence`
- ev_c08_omen(異変の徴/nature L4): `gravitational hypothesis indigenous magnitude pollinate soluble specimen trajectory`
- ev_c08_ruins(外郭の廃墟/daily L4): `clutter declutter dispose durable makeshift perishable upkeep ventilate`
- ev_c08_scarce(欠乏の備え/daily L4): `accumulate allocate inventory maintenance prioritize sustainable tenant utilities`
- ev_c08_hunger(飢えの夜/food L4): `contaminate deficiency ferment nourish nutritious saturated simmer dietary`
- ev_c08_lore(トワの遺文/school L4代替=L5主体): `account for look up infer elucidate conjecture erudite scholastic acumen`
- ev_c08_concealed(隠された因縁/society L4代替=L5主体): `clandestine cover up disinformation dissent jurisdiction propaganda whistleblower redress`
- ev_c08_lonely(さみしさの名/feelings L5代替): `forlorn estrangement solace consolation wistful gratitude empathize venerate`
- ev_c08_hoard(溜め込みの理/business L5代替): `hedge incumbent accrual liquidate solvent insolvency attrition collateral`
- ev_c08_gate(灰の門番/travel L4+nature L5): `adjacent scenic set off spontaneous voucher itinerant entropy nocturnal`

> **char_arc / 物語の核**: ①**トワの正体・祖父との因縁・`lonely`の手触りの開示**(c08_070 ev_lore=トワの遺した記録から「集める翁」の動機/c08_080 ev_concealed=翳りを隠してきた者たちと祖父の因縁/c08_090 ev_lonely=カンテラの声＝`lonely`の手触りが最も濃く出る章/c08_100 ev_hoard=「二度と失わないため」全てを溜め込むトワの理屈)。②**カガリが一行を庇い、灯詞の半分を失う**(c08_140崩落→c08_150 sacrifice)。**カガリの生死は ch8 では確定させず曖昧に保つ**(=engineにflag条件分岐のテキスト機構が無い・新設はSYSTEM領域)。arc-plot の「truth報告済=一命確定/隠蔽=生死不明」差分は **ch9/ED(B-1)で truth フラグにより解決**=ここでは仲間も判じきれない曖昧描写で両状態を受ける(終章へ繋ぐ)。③ルート差分は門前夜(c08_110)の幕間1〜3行スワップに留める想定(差分予算25%以下)=今回は共通текстで配線し、route幕間は後日の薄い差し替え余地として残す。

> **感動設計**: 進軍の高揚(荒野→廃墟→飢え→門)を背骨に、その道中で**トワの正体と`lonely`の開示**を段階的に重ね、門の手前で**カガリの自己犠牲**を置く(本章最大の喪失=終章直前の底をさらに深める)。山=灰の門番戦(トワが言葉で組んだ門=「集めて閉ざす」理の具現を、{name}が「めぐらせる」灯で通す)。締め=半分の言葉を失ったカガリを抱え、灰都の底へ降りる(=終章へ)。裏テーマ「交わさない言葉は失われる」はカガリの欠けた言葉の**描写**で示し講釈しない。

> **謎**: カンテラ=`lonely`の手触りはc08_090で最濃度。隠しED鍵 lonely の真名直結は名指さず温存(終章/隠しEDで回収)。トワ=アキの鏡像(灯す者/溜め込む者)はc08_100で示唆。

---

## シーン→イベント対応(配線=`js/scenario.js`/`data/events.js`が正)
| scene | event(gate.read) | フラグ | 役割 |
|---|---|---|---|
| c08_002 灰の荒野へ | ―(action) | ― | 導入・北の地の果てへ進軍 |
| c08_010 灰へ続く道 | ev_c08_depart | ― | 出立・荒れ道 |
| c08_020 枯れた大地 | ev_c08_wilds | ― | 灰に枯れた自然 |
| c08_030 異変の徴 | ev_c08_omen | ― | 灰都が近い徴候 |
| c08_040 外郭の廃墟 | ev_c08_ruins | ― | 打ち捨てられた暮らしの跡 |
| c08_050 欠乏の備え | ev_c08_scarce | gaku+1 | 残りの糧を分け合う(共闘) |
| c08_060 飢えの夜 | ev_c08_hunger | ― | 灰の中の食 |
| c08_070 トワの遺文 | ev_c08_lore | ― | **トワの正体=動機の開示** |
| c08_080 隠された因縁 | ev_c08_concealed | ― | **祖父との因縁・隠蔽の連鎖** |
| c08_090 さみしさの名 | ev_c08_lonely | yui+2 | **`lonely`の手触り(ユイの弱音を受ける)** |
| c08_100 溜め込みの理 | ev_c08_hoard | ― | **トワ=アキの鏡像の示唆** |
| c08_110 門前夜 | ―(interlude) | ― | 門前の静けさ(route幕間の余地) |
| c08_120 灰の門番 | ev_c08_gate | ― | **ボス=門の番人(思想戦)** |
| c08_130 門、ひらく | ― | ― | 勝利=門が通る |
| c08_140 崩落 | ― | ― | 門の崩れ・危機 |
| c08_150 カガリ、庇う | ― | ― | **カガリ自己犠牲=灯詞半失** |
| c08_160 半分の言葉 | ― | ― | 余韻(生死は曖昧=終章へ) |
| c08_170 灰都の底へ | ―(action) | gate settled≥420 | 締め・降下 |

> 凡例・規約は ch4-7.md に同じ。誤答固定文言「灯らなかった。言葉は胸に戻った。――もう一度。」(無罰)。本文に英単語を直挿ししない(英語は cast.answers のみ)。フラグは加算のみ(gaku c08_050 / yui c08_090)。route は ch7 で確定済=ch8 では非加算。
</content>
</invoke>
