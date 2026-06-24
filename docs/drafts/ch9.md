# 第9章（終章）「きみの名前で」設計稿

arc-plot §4.2終章 / §5（分岐）/ §6（ED）準拠。配線=js/scenario.js + data/events.js（ev_c09_*）。
ボス=トワ（多段階・削り保存=ナラティブ）。章末ゲート settled≥450（CANON最終段）。供給40語=全系統 L5（arc-plot「終章=全系統L5」）。

## 1. 供給語割当（5イベント×8語=40・全て data/words.js 実在・clozeable・既出衝突ゼロ）
- **ev_c09_descent**（灰都の底へ降る／地質的異界）= nature L5: magma, tectonic, aquifer, permafrost, tundra, metamorphosis, proliferate, stratosphere
- **ev_c09_core**（集積核＝朽ちゆく言葉の山）= daily L5: dilapidated, deteriorate, cumbersome, discern, expenditure, mundane, mitigate, imperative
- **ev_c09_towa**（トワの理＝呼ばれなかった者の政治）= society L5: disenfranchise, demagoguery, oligarchy, partisan, amnesty, pluralism, adjudicate, ratify
- **ev_c09_relay**（途切れた灯を継ぐ＝思考と継承）= school L5 ＋ nature L5残: epistemology, hermeneutics, dialectic, abstraction, iconography, osmosis, catalyze, bioluminescence
- **ev_c09_vigil**（ユイの忘却＝最大の喪失）= feelings L5: trepidation, reticent, grudge, vexation, ambivalent, elation, infatuation, condescending

families/levels: arc-plot「全系統L5」に従い枯渇のない L5 系統から選定。school L5（5語のみ）は nature L5 残3語で補完（draft明記）。

## 2. char_arc / 感動設計
- **最大の喪失**（§7①⑤）= c09_060: ユイがアキの名を忘れる。直後 c09_070 で**アキの地の文から軽口が一度だけ消える**（説明せず文体で：短く・平叙のみ）。
- **奇跡の正当化**（§7④）= とどめ c09_090 = 最高Stability語の自動選択＝積んだ30日そのものが代価（無償の大団円にしない）。
- **モチーフ回収**: 大灯（6章で消えたまま）→終章で再点灯の暗示。さしいれの最後の灯心がアキの最後の灯を支える。
- トワ=lonely の鏡像（8章で開示済）。終章はトワを「祓う」のでなく「呼ぶ」＝名を返す方向。

## 3. フラグ（加算のみ＋truth/route の列挙のみ・負効果ゼロ）
ch9 では新規加算なし（route/truth は既確定）。**ED分岐ロジックのみ**:
- c09_110 = `branchOn:'truth'`（カガリの生死差分・1シーンスワップ）: truth=true→一命をとりとめる／未報告→生死を曖昧に保ったまま見送り。両者 c09_120 へ合流。
- c09_120 = `branchOn:'route'`（3ED出し分け）: hero→cE_hero_*／yui→cE_yui_*／quiet→cE_quiet_*。

## 4. ED（§6）
- **hero「めぐる灯」**（route=hero）: 灯詞が人から人へ再び巡る。声を半分失ったカガリの代わりにアキが祝いの口上を灯す。
- **yui「おかえりの灯」**（route=yui）: 歴史に名は残らず、二人で流れ着いた先に小さな灯。最強の灯詞＝**「おかえり」**で締め（モチーフ意味変容回収）。
- **quiet「灰の底で」**（route=quiet）: 都にも村にも戻らず、翳りの跡を一人ずつ灯し直して旅を続ける。ほろ苦の余韻。
- **friend（隠し）**: 本イテレーションは**未配線**＝条件「全ルートクリア後＋語り部級(S≥90)50語」が周回・完了トラッキング機構を要する（STORY範囲外の状態管理）。→ bridge.md `## → System` に起票し、ED内容＋解錠機構は次イテレーション。endings.friend.inCode は false 据え置き。

## 5. シーン↔イベント対応表
| シーン | 役割 | event(gate.read) |
|---|---|---|
| c09_002 | 灰都の底へ降る（intro/action） | — |
| c09_010 | 集積核を望む | ev_c09_descent |
| c09_020 | 朽ちゆく言葉の山 | ev_c09_core |
| c09_030 | トワと対面 | — |
| c09_040 | トワの理（呼ばれなかった者） | ev_c09_towa |
| c09_050 | さみしさの底 | — |
| c09_060 | ユイが名を忘れる（最大の喪失） | ev_c09_vigil |
| c09_070 | 軽口が一度だけ消える | — |
| c09_080 | 途切れた灯を継ぐ（トワ戦） | ev_c09_relay |
| c09_090 | とどめ＝積んだ30日（gate settled450） | — |
| c09_100 | トワが解ける | — |
| c09_110/115 | カガリの生死（truth分岐） | — |
| c09_120 | ルート分岐（route） | — |
| cE_hero_010/020/030 | 王道ED | — |
| cE_yui_010/020/030 | 幼馴染ED | — |
| cE_quiet_010/020/030 | 静かなED | — |

## 6. 機構（ED分岐＝STORY範囲）
js/ui.js（renderStory/物語ロジック側）に `branchOn`/`branch` 解決を追加（resolveNext）。frozen値は不変。
tests/invariants.test.js の `sceneNexts` ヘルパに branch エッジを追加（到達性/未解決参照の検証を branch にも効かせる＝凍結値は不変）。
