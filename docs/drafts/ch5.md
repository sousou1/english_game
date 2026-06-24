# 第5章「声のない町」素案 ―『ともしび』(新canon)

作成: 2026-06-22 / 正典: `docs/drafts/arc-plot.md`(§4.2 ch5). 自走ループ STORY。**配線稿(§1)** — 直接 `js/scenario.js`/`data/events.js` へ実装(本章は draft.md を設計記録とし、本文の正は配線コード)。次=§2多ペルソナレビュー(high0)。

- **舞台/型**: 声を奪われた町(ホラー回・灯詠み昇格試験の最終関門). **位階 L3-4**, 推奨系統 **society(+feelings)**.
- **ボス**: 灰の司祭(声を奪う「巨大な静寂」・ナラティブ/敗北なし). c05_130。
- **ゲート(章クリア)**: 定着語数 settled≥220 (arc-plot §4・c05_150)。
- **新キャラ**: なし(ユイ14・カガリ27・ガク15継続。カガリは c05_002 で送り出し別行動=本章は{name}とユイの二人旅に絞る。声=カンテラ=Fミステリー継続).
- **シーン**: 16(c05_002〜c05_150)。STATUS目標18に対し≥80%で配線判定OK(ch4=17/20・ch3=18/20と同列)。
- **挿絵**: 後回し(brief未整備=0)。次イテレーションで scenes.json に c05_010/040/060/090/130/150 の brief を標準整備予定。

## 供給語(72語=9イベント×8・`data/words.js`実在・既出232語と衝突ゼロ・全clozeable=機械検証済)
- **L2-3 feelings/society が arc-plot 既定だが、feelings L2-3 はch1-4でほぼ枯渇**(残り5語)。声を奪われた町=検閲/権威/抑圧(society)＋声を交わせぬ心の荒廃(feelings)というホラー回の主題に、**society L3(20)＋society L4(authority系)＋feelings L4(感情の闇)** を充てるのが最も主題整合的と判断。中盤(Day15-16)のL4昇格はSRS進行的にも妥当。**→ SYSTEMへブリッジ:** feelings/society L2帯の補充が将来必要(bridge参照)。
- ev_c05_gate(声を奪われた町・検閲と権威の到着読み): `censorship authority criminal accuse legal justice evidence broadcast`
- ev_c05_streets(喋れない人々・心の荒廃): `lonely mood shy cheerful emotion care admire longing`
- ev_c05_priest(灰の司祭の理・きれいごとの底): `corrupt conflict campaign democracy diplomat senate treaty inequality`
- ev_c05_whisper(翳りの囁き・F-mystery=トワの断片): `anguish melancholy estranged hostility contempt resentment vulnerable yearning`
- ev_c05_yui(夜の会話・絆/yui+2): `bond cherish compassion empathy console intimate mutual rapport`
- ev_c05_refugees(声なき者たち・抑圧された弱者): `refugee poverty minority journalist suppress bias advocate credibility`
- ev_c05_resist(抗う声・告発の連帯): `abolish accountability allegation coalition controversy corruption impeach prosecute`
- ev_c05_truth(真実の重さ・truth選択前の葛藤): `grievance reconcile remorse apprehensive attachment adore exasperate sanction`
- ev_c05_boss(灰の司祭・思想戦): `ideology sovereignty legislation referendum mediator integration constitute diplomatic`

> **char_arc**: 二人旅へ回帰(カガリ/ガクをc05_002で一旦離し、{name}とユイの関係を本章の感情の核に据える=ch6のユイ忘却本格化への助走)。ユイ(14): 声を失った人々に最初に手を伸ばす"心の触覚"役(c05_020/c05_060)。c05_060「夜の会話」でyui+2(§5.2 ch5=夜の会話+2に字面一致・本章唯一の加点機会)。c05_150 章末で**村の朝の鐘の呼び名を言いかけて出てこない一行**(ch4 c04_120の違和感を一段進めたF4進行=喪失の核)。{name}=アキ: F-mystery(井戸の声=トワの断片)に初めて"出自/孤独"を見る(c05_040)。truth選択(c05_110)で初めて"どちらも正しいが両立しない"重さを引き受ける=道徳的成長。灰の司祭={name}の鏡像(かつて声を奪われた被害者→奪う側へ転落=トワと同根)を c05_090 で開示し、ボスを単なる悪役にしない。

> **感動設計**: 振幅(不穏を基調に→緩(夜)→葛藤→ほろ苦)をホラー回の角度で。導入の不穏(c05_010〜c05_040): 声のない町の異様→喋れない人々の荒廃→灰の司祭の"慈悲の顔をした抑圧"→井戸の底の翳りの囁き(本章のF-mystery山=トワの孤独の手触り)。緩(c05_050〜c05_060): 声を失った町を見たあとだからこそ沁みる、屋根の上の夜の会話(言葉を交わせることの宝/yui+2)。葛藤(c05_070〜c05_110): 声なき者の帳面→抗いの連帯→真実の重さ→truth選択(都に報告か握り潰すか=本章の分岐の核)。山(c05_120〜c05_140): 灰の司祭との思想戦(斬って終わりでなく"声のある町に作り直す"=言葉で勝つ)。ほろ苦+締めの緩(c05_150): 声の戻る朝の安堵に、ユイの忘却の影を一行重ねて次章へ。裏テーマ「交わさない言葉は失われる」を町の設定そのもの(検閲=言葉の独占の器)で**描写でのみ**示し講釈しない(法則4非言語化を死守)。

> **フラグ**: 加算のみ・誤答/放置で下がらない(arc-plot §5.2 ch5)。**yui+2**: c05_060「夜の会話」温度3択a「お前と喋れる夜が、おれの灯だ。……ずっと、こうしてたい」(§5.2 ch5=夜の会話+2に字面一致・本章唯一の加点)。**truth(初出)**: c05_110「届けるか、伏せるか」温度3択a「都に、真実を届ける」で `truth` を bool で立てる(8章カガリ結末に連動・arc-plot §5.1)。**重要**: truth は加算でなく真偽だが「負効果ゼロ(一度trueにするのみ・何も減じない)」を満たすため、`tests/invariants.test.js` の選択肢フラグ不変条件を **意図的に更新**(yui/gaku加算 + truth bool を許可・route も終章で同様に許可予定)。gaku/route は本章で操作しない。

> **謎(F-mystery/F4)**: F-mystery(翳り=トワの断片): c05_040「翳りの囁き」=聖堂地下の封じられた井戸で、{name}が**翳りの正体の断片**(=最初に呼ばれなくなった一語・loneliness/lonely の化身トワ)に初めて触れる。憎しみでなく"呼ばれなくなった孤独が固まったもの"として描き(ev_c05_whisperで anguish/estranged/resentment/vulnerable/yearning を主題語に通す)、井戸の声が「トワ」と名乗る。**隠しED鍵の真名 lonely は本章でも温存**(供給語に lonely(L1 feelings)は streets で出すが、トワ=lonelyの直結は名指さず匂わせのみ)。灰の司祭=トワと同根(c05_090)で"孤独の連鎖"を主題化。F4進行(ユイ忘却): c05_150でユイが**村の朝の鐘の呼び名を言いかけて出てこない**一行(ch4 c04_120「言いかけて呑んだ一行」を一段進める)。{name}の胸に名指せない影が残る一行を添え、終章のF4決壊(アキの名を忘れる)へ向け確実に布石を一段進める。いずれも物語駆動のみ・クイズ成績に一切連動しない(arc-plot §10)。

---

## シーン→イベント対応(配線=`js/scenario.js`/`data/events.js`が正)
| scene | title | event(gate.read) | 温度3択/フラグ | 役割 |
|---|---|---|---|---|
| c05_002 | 灰いろの街道 | ― | action | 導入・カガリ離脱・二人旅へ |
| c05_010 | 声のない町の門 | ev_c05_gate | 3択/加算なし | 不穏導入・検閲の町 |
| c05_020 | 喋れない人々 | ev_c05_streets | ― | 心の荒廃・ユイの触覚 |
| c05_030 | 灰の司祭 | ev_c05_priest | ― | 慈悲の顔の抑圧 |
| c05_040 | 翳りの囁き | ev_c05_whisper | ― | **F-mystery山**(トワ断片) |
| c05_050 | 声のない夜 | ― | ― | 緩への橋渡し |
| c05_060 | 夜の会話 | ev_c05_yui | 3択a=**yui+2** | 緩・言葉の宝 |
| c05_070 | 声なき者たち | ev_c05_refugees | ― | 帳面入手・葛藤の起点 |
| c05_080 | 抗う声 | ev_c05_resist | ― | 連帯 |
| c05_090 | 帳面の底 | ― | ― | 司祭=被害者開示(鏡像) |
| c05_100 | 真実の重さ | ev_c05_truth | ― | 二つの正しさ |
| c05_110 | 届けるか、伏せるか | ― | 3択a=**truth** | **分岐の核** |
| c05_120 | 聖堂へ | ― | ― | 山への助走 |
| c05_130 | 灰の司祭、立つ | ev_c05_boss | ― | **ボス思想戦** |
| c05_140 | 声のある町へ | ― | ― | 勝利=作り直す |
| c05_150 | 声の戻る朝 | ― | 3択/gate settled≥220 | ほろ苦+**F4進行**・次章へ |

> 凡例・規約は ch4.md に同じ。誤答固定文言「灯らなかった。言葉は胸に戻った。――もう一度。」(無罰)。本文に英単語を直挿ししない(供給は events 側の cast 詠唱で行う)。
