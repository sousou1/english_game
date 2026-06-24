# 隠しED「friend」設計稿 ― カンテラの声の真名

> 状態: **draft / 配線ブロック中**。STORY 範囲のフラグ(加算+truth/route)では解錠条件を表現できないため、
> SYSTEM が解錠 API(end到達記録 + S≥90語カウント)を着地させるまで配線しない(bridge.md →System 2026-06-24 起票)。
> 本稿は「API が来たら STORY は branch 1本 + cE_friend_* 3シーン + ev_cE_friend 1イベントを足すだけ」にするための完成設計。
> 正典: arc-plot.md §6(ED表)・§7(F1/F5 伏線)・キャスト表 No.5(カンテラの声=`lonely`)。

## 0. 解錠条件(SYSTEM 依存・STORY は読むだけ)
arc-plot §6:「全ルートクリア後 ＋ 語り部級(S≥90)50語」。
- (a) hero / yui / quiet の3ED **すべて到達済み**(周回フラグ集合)。
- (b) Stability ≥ 90 の語が **50語以上**。
SYSTEM 提案 API(bridge):`profile.scenario.endsCleared`(end到達時に route 記録)+ `mastery` の S≥90 ゲッタ。
**STORY が触れるのは解錠判定の真偽値だけ**(加算・負効果なし=凍結インバリアント維持)。

## 1. 配線の差分(API 着地後にやること)
1. **解錠分岐の置き場所**: `c09_120`(branchOn:route)の **手前** に解錠ゲートを置く。
   - 案: `c09_117`/`c09_115`(カガリ生死差分の合流点)→ `c09_120` の経路はそのまま。
   - 新たに `resolveNext` を拡張せず、**route 分岐の直前シーン**で解錠真偽を見て `cE_friend_010` か `c09_120` へ。
   - 具体: `c09_118`(新規・共通ライン1〜2行)に `branchOn:'_friendUnlocked'`(SYSTEM が flags に bool で投影)+ `branch:{ 'true':'cE_friend_010' }`・`next:'c09_120'`。
     ※ `_friendUnlocked` は **SYSTEM が解錠判定を flags に読み取り専用で投影**する想定(STORY は加算しない)。これが API 契約の肝。
   - これで route 3EDの分岐構造・truth差分は一切変えない(既存テスト不変)。
2. **invariants.test.js `sceneNexts`**: `c09_118` の branch辺(true→cE_friend_010 / 既定→c09_120)と cE_friend_010→020→030→end を追加(凍結数値・gate段は不変)。
3. **endings.friend.inCode:true** 化 + `npm run status` 再生成。

## 2. 供給語(ev_cE_friend ― 8語ちょうど・全 feelings L1・既出衝突ゼロ)
L1帯は全190語がイベント未供給(=コンプ余白)。隠しEDは **L1 feelings の回収**にあてる(対句反転の主題と一致)。
| # | 語 | f/l | ex(原形 cloze 可) | 役割 |
|---|---|---|---|---|
| 1 | **lonely** | feelings/1 | I feel lonely today. | 真名(声の正体) |
| 2 | **friend** | feelings/1 | He is my best friend. | アキの返答=対句反転 |
| 3 | hope | feelings/1 | (要確認: ex に hope 原形) | 締めの灯 |
| 4 | trust | feelings/1 | (要確認) | 絆 |
| 5 | smile | feelings/1 | (要確認) | 別れの表情 |
| 6 | happy | feelings/1 | (要確認) | コンプ余白の回収 |
| 7 | sad | feelings/1 | (要確認) | 別れの陰 |
| 8 | love | feelings/1 | (要確認) | 締め |
- 配線時に 3〜8番の ex が原形を含むか(`\bword\b`)を確認し、欠ければ words.js の当該語 ex/jx を原形入りに修正(STORY 範囲)。
- **teach == cast.answers**。2語ビート×3 + review 2本 の標準構成。intro/outro に英語直挿し禁止(英語は cast.answers のみ)。
- ev_cE_friend は **cE_friend_010 と 020 の間**(真名が割れる瞬間)に挿む。`lonely`/`friend` は最後のビートに置く。

## 3. シーン構造(cE_friend_010〜030・各2〜8行・本文に英語なし)
- **cE_friend_010「呼ばれなかった一語」**: 全ED後の周回でのみ開く扉。カンテラの声が初めて姿の輪郭を持つ。「……気づいたんだ、坊や。あたしの、ほんとうの名前に」。声=翳りに最初に呑まれ、誰にも呼ばれなかった孤独な一語(F1/トワが救えなかった人の最後の言葉=§7)。
- **(ここで ev_cE_friend)** ― 真名 `lonely` を灯す灯詠みの所作として学習が入る。最後のビートで `lonely`→`friend`。
- **cE_friend_020「孤独は、友達の最初の名前だった」**: アキが声の真名に **「friend」と返す**(英語の真名提示は cast を通った直後の余韻として日本語地の文で「友、と返した」と描く=本文英語直挿し回避)。孤独が、初めて誰かに呼ばれる。解放。
- **cE_friend_030「扉のこちら側」**: 一瞬開いた扉の向こうに、画面のこちら側(プレイヤー)が映る(arc-plot §6・メタの一刺し・説明しない)。`next:'end'`。
  - 締めの一行は **L1語2つ(lonely/friend)の対句**を日本語で回収:「さみしい、は。ともだち、の、最初の名前だった。」

## 4. char_arc / 感動設計
- **声(lonely)**: 数百年、誰にも名を呼ばれなかった孤独 → アキに「友」と呼ばれて初めて解ける。トワ(溜め込む者)が救えなかった最後の言葉=声、の伏線が最終回収(§7 F1)。
- **アキ**: 全ルートを巡り(=プレイヤーが全EDを見る=周回)、最強の灯詠みになった末に、最入門のL1語2つで最後の灯を灯す=「言葉は誰のものでもない」の最終証明。
- **感動の核**: 最も難しい旅の果てに、最もやさしい2語に還る。対句反転(lonely↔friend)で別れを締める。

## 5. インバリアント順守チェック(配線時に再確認)
- 誤答無罰(固定文言)・フラグ加算のみ(解錠は SYSTEM 投影の読み取り専用 bool)・truth/route 列挙のみ不変。
- 経済/戦闘/昇華の凍結数値・settled ゲート段(…450)不変(隠しEDは終章 gate 通過後の周回演出=新ゲートを足さない)。
- 新語供給=イベント限定・8語/本・衝突ゼロ(L1 feelings 8語)。
- 本文英語直挿しゼロ(英語は ev_cE_friend.cast.answers のみ)・説教/裏テーマ言語化なし(描写で示す)。
