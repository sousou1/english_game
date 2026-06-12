# アンロック設計理論(横断) 分析メモ

以下が分析メモです。

---

# 分析メモ:アンロック設計理論(横断)— unlock cadence・チェックバック伸長・オフライン心理・prestige動機

前提: 既存分析(`/mnt/c/Users/tamus/git/game-design-vault/knowledge/games/genres/idle-incremental.md`)のドーパミンループ分解・セッション構造論・資源設計指針は既知として、本メモは**アンロックの「間隔」と「通貨単位」の定量設計**に踏み込む。

---

## 1. テキストだけで面白さが成立する仕組みの分解

Universal Paperclips(Frank Lantz)と (the) Gnorp Apologue の開発者発言から逆算すると、グラフィック不要で面白さが立つ条件は4つ。

1. **「数字」ではなく「数字の変化率の変化」が主役**。線形成長は読み飛ばされる。面白いのは「桁が変わる瞬間」「乗数が発火して予測を超える瞬間」。テキストゲーは描画コストゼロなので、この瞬間の頻度を純粋にチューニングできる。Lantzは現実の市場メカニクス(価格スライダー、在庫)を入れることで「数字を読む」行為自体に意思決定を埋め込んだ。
2. **UIの出現そのものが報酬**。Paperclipsは新しいボタン・新しい行が画面に「生える」ことを最大の報酬にしている。グレーアウトや「???」表示は予告編として機能する(目標勾配)。テキストゲーにおけるアンロック=**画面の語彙が増えること**。
3. **物語はメカニクスの順序で語る**。Paperclipsの「AIが人類の信頼を得て、やがて不要にする」という物語は、テキストでの説明ではなく**アンロック順序そのもの**で語られる(信頼→マーケティング→自律→宇宙)。アンロック列=プロット。Naomi Clarkはこの加速の連なりを「ビンジ視聴可能なTV番組のプロット構造」と評した。
4. **フェーズ転換 = ルールの書き換え**。数値インフレだけでは順応される。Paperclipsは3幕構造で操作対象自体を変える(地球の市場→自律工場→宇宙探査)。「同じ画面で数字が大きくなる」ではなく「画面の意味が変わる」が長時間維持の鍵。

---

## 2. アンロックと数字成長のリズム(分・時間・日)

### 最初の10分:アンロックは「時間」ではなく「行動回数」建てで置く
代表作の実測値(Cookie Clicker / AdCap / Paperclips):

- **0〜30秒**: 最初の購入(Cookie ClickerならCursor=15クッキー)。クリック15回で到達。**初回意思決定は起動後30秒以内**が業界の暗黙標準。
- **1〜2分**: 2つ目の生産者(Grandma=100クッキー、AdCapならNewspaper)。Paperclipsは1〜2分でAutoClipper。
- **10分時点**: 新生産者3〜4種+小アップグレード+実績で、**合計8〜15個のアンロックイベント**。体感では「30〜90秒に1回、画面に何か新しいものが現れる」密度。
- 重要なのは閾値が**時間でなく累積生産量(=プレイヤー行動量)建て**であること。速い人にも遅い人にも同じ体験密度が保証される。
- ただしGDC系の議論で繰り返される警告: auto収集・prestige・時間ブーストなど**システム系の複雑さを最初の10分に全部出すと新規が離脱する**。最初の10分に置くのは「同型の生産者の追加」だけにし、異質なメカニクス(新画面・新ルール)はグレーアウト表示で予告しつつ後送りする。

### 成長カーブの定数(Pecorella框組)
- コスト: `next_cost = base × growth^owned`、growthは**1.07〜1.15**(AdCap=1.07、Cookie Clicker=1.15)。
- 生産アップグレードの成長(例: ×1.1/レベル)より**コスト成長(×1.15/レベル)を必ず速くする**。この差分が「買える→買えない→もうすぐ買える」の自動リズム生成器。
- **マイルストーン乗数**: 25/50/100個所持で×2(AdCap)、Realm Grinderは300/400/500個で大型乗数(500個で×16)。等比コストで鈍化した進行に周期的なスパイクを打ち直す装置。「線形な積み上げを句読点付きの報酬に変換する」のがこの仕組みの本質。

### 時間〜日単位
- **初回prestigeまで**: AdCapは効率プレイで1〜2日(Angel 50〜150)。リセット後の復帰は初回2〜3時間、周回ごとに短縮(後半は2時間未満)。**「前回の壁を高速で抜ける」体感がprestige報酬の本体**。
- **prestige通貨を2倍にするには累計収益3〜4倍が必要**(Cookie Clicker / AdCap / Realm Grinderが揃ってこの帯。Egg Inc.は極端で2^7=128倍)。この平方根〜対数的な逓減が「周回が自然に長くなる」リズムを作る:1周目30分→数時間→1日→数日。
- **チェックバック間隔の伸ばし方**(Eric Guanの段階タイマー設計が最も明快): 生産キャップの異なる装置を並走させる——短周期20分 / 中周期5時間 / 長周期2日。プレイヤーのライフステージ(初週は15〜60分間隔でチェック→数ヶ月後は週1)に合わせ、**どの周期の装置に注目するかをプレイヤー自身が選び直せる**。ゲームがセッション頻度を強制するのではなく、頻度低下を「失敗」と感じさせない緩衝構造。
- 全体ペーシングの参照値: 成熟期の理想チェックイン間隔は**30分〜2時間**(低強度のバックグラウンド娯楽として)。

---

## 3. プレイヤーが戻ってくる理由の構造

既存分析の「再開コスト負化」の先にある、より細かい構造:

1. **To-DoリストではなくRewardリストを開く**。オフライン収益画面("Away Income")は「開いたら課題がある」を「開いたら受け取りがある」に反転させる装置。学習アプリの再訪設計で最重要の借用元。
2. **Zeigarnik効果の物理化**。「基地がいまも生産している」と知っていること自体が、脳内に開きっぱなしのタブを作る。未完了タスクの記憶は完了タスクより鮮明——閉じる瞬間に「あと2個でアンロック」を見せるのはこの増幅。
3. **オフラインキャップは「再訪圧」と「公平性」の二重装置**。Egg Inc.の2時間キャップは、(a)2時間ごとのチェックインを最適行動にする、(b)放置ゲイン依存を抑えてアクティブプレイの価値を守る、の両方を達成。キャップ拡張(サイロ追加)自体をアンロック報酬列にしている点が巧妙——**「より長く離れられる権利」を購入させる**ことで、チェック間隔の伸長をプレイヤーの達成として演出する。
4. **prestige動機の発火シグナルは「バーが動かなくなった」体感**。Egg Inc.分析の指摘: アップグレードが「苦痛なほど遅い」と感じた時がリセット適期、という設計。つまりprestigeは**鈍化への罰を脱出ボタンに変換する**仕組み。鈍化(本来は離脱要因)を「リセットすれば5倍速」という期待形成に転化している。
5. **Fresh Start Effectの非対称性**(行動科学知見、設計に直結): 心理学研究では、リセット(新しい区切り)が動機を高めるのは**停滞している人に対してだけ**で、好調な人にはむしろ逆効果。含意: prestigeを促すUIは「進行が鈍化したプレイヤーにのみ」出すべきで、絶好調の最中にリセットを勧めるのは設計ミス。
6. **戻る理由の多層化**: 短周期(20分タイマー回収)+中周期(5時間装置)+長周期(数日のprestige周回)+超長周期(週次イベント)。どれか1層しか持たないゲームは、その層の周期に飽きた瞬間に全損する。

---

## 4. 「英単語の想起(4択)×忘却曲線」との構造的相性

既存分析の資源設計論(想起=採掘、誤答=出題予約 等)は前提とし、**アンロックcadence視点**で追加する。

### 相性が良い部分
1. **SRS間隔の指数伸長 ≒ チェックバック間隔の指数伸長(構造同型)**。SM-2系の復習間隔(10分→1日→3日→1週→1ヶ月)は、このジャンルが人工的に設計している「20分→5時間→2日」のタイマー段階構造**そのもの**。普通のゲームは伸びる間隔を捏造するが、語学ではそれが学習科学的必然として無料で手に入る。「次の収穫(復習期日)」のカレンダーがゲームデザインを書かなくても勝手に生成される。これは本企画最大の構造的アドバンテージ。
2. **4択のテンポ=クリッカーの報酬粒度**。1問5〜8秒なら毎分7〜10回の「行動tick」が出る。Cookie Clickerの初期クリック頻度とほぼ同じ。つまり**アンロック閾値を「正解想起回数」建てで置ける**——「最初の購入=正解5回(約30秒)」「2つ目の生産者=累計正解20回(約2分)」のように、ジャンルの実測cadence(最初の10分に8〜15イベント)をそのまま正解数に換算して移植できる。
3. **「習得語数のマイルストーン乗数」が自然に成立**。AdCapの25/50/100個×2倍は、「このカテゴリの単語を25語マスターで生産×2」にそのまま写像できる。語彙数は有限だが乗数は無限なので、既存分析が指摘したインフレ問題(語彙の有限性)をマイルストーン側で吸収できる。
4. **prestige=同語彙帯の再周回が「128倍ルール」と噛み合う**。prestige通貨の逓減設計(2倍にするには3〜4倍の累計)は、「2周目以降の既習語は高速で抜ける(が報酬は逓減)」というSRSの復習構造と動機的に一致。復習の「簡単すぎてつまらない」問題を「周回の高速消化の快感」に変換できる。

### 相性が悪い部分
1. **4択は偶然正解率25%の床がある**。アンロック閾値を正解数建てにすると、**スパム連打でも期待値25%で進む**。クリッカーの「行動=必ず前進」の文法をそのまま使うと、当てずっぽうが最適戦略化して学習が空洞化する。→ 閾値は「正解数」でなく「連続正解(streak)」または「想起判定済み(SRS的に間隔を空けて正解した)語数」建てにする必要がある。ジャンル標準からの意図的逸脱が必須の箇所。
2. **「期日なし」の死時間問題**。SRSは「今日やるべき復習が0件」の時間帯を必然的に生む。これはジャンルの絶対律「開けば常に何かできる」と正面衝突する。新規語の先行学習・低レート復習・経営フェーズ(資源配分)などの**充填コンテンツが構造的に必要**で、これはSRSアプリが普通持たない開発コスト。
3. **忘却曲線を「減衰」として実装するとジャンル契約違反**。このジャンルは「離れていても損しない」が再訪の前提(Rewardリスト構造)。忘却を資産の減少として見せると、オフライン心理の利点を自ら破壊する。→ 減衰は「資産の喪失」でなく「期限付きボーナスの失効」(収穫適期を逃すと倍率が落ちる、元本は減らない)として表現する。
4. **オフライン進行の約束と認知的不在の矛盾**(既存分析の指摘の精緻化): オフライン収益画面は「君がいない間も働いていた」と言う装置だが、語彙は不在中に増えない。Away Income画面で「学習が進んだ」と読める表現を1ピクセルでも出したら教育的詐欺になる。「工場が動いていた」と「君の語彙が増えた」の表示は厳密に分離。

---

## 5. 盗むべき設計1つ/やってはいけない失敗1つ

**盗むべき設計(1つ): 「最初の10分=30〜90秒に1イベント、ただし閾値はすべてプレイヤー行動量建て」のcadence表**。Cookie Clicker/AdCap/Paperclipsが共有する開幕設計——起動30秒で初購入、2分で2つ目の生産者、10分で8〜15アンロック、閾値は時間でなく累積行動量——を「正解想起回数」に換算して移植する(初購入=正解5回、以後グレーアウトで次の閾値を常時2〜3個見せる)。これは初日のD1リテンションを決める区間であり、ジャンルが10年かけて収束させた実測値なので発明し直さないこと。あわせてシステム系の複雑さ(prestige等)はこの10分から排除し、予告表示に留める。

**やってはいけない失敗(1つ): アンロック閾値とコスト曲線を手作業で1点ずつ調整すること(シミュレーションなしのハンドバランス)**。Pedro Furtadoのポストモーテムが明確に証言: インクリメンタルの面白さは「発見」に依存するため、**開発者自身のプレイテストでは面白さを検知できない**(全部知っているから)。バランス調整を自動化(スプレッドシート/想定プレイヤーモデルでの数値シミュレーション)しなかった結果、コンテンツ追加が苦行化し、「長いプレイ時間・十分なコンテンツ・面白さ」の3つのうち2つしか保てなくなった。ミッドゲームのコンテンツ砂漠はこの失敗の症状として現れる。Pecorellaが公開しているモデルシート(Internet Archive)型の「正解レート×成長定数→各アンロック到達時刻」を吐く計算機を、実装より先に作ること。

---

Sources:
- [GDC Vault: Quest for Progress — The Math and Design of Idle Games (Pecorella)](https://www.gdcvault.com/play/1023876/Quest-for-Progress-The-Math) / [スライドPDF](https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf) / [モデルシート](https://archive.org/details/idlegameworksheets)
- [The Math of Idle Games Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i) / [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)(コスト曲線1.07-1.15、マイルストーン乗数、prestige 3-4倍則、Egg Inc 128倍)
- [GDC Vault: Idle Games — Mechanics and Monetization](https://www.gdcvault.com/play/1022065/Idle-Games-The-Mechanics-and)
- [Eric Guan: Idle Game Design Principles](https://ericguan.substack.com/p/idle-game-design-principles)(20分/5時間/2日の段階タイマー、×1.1生産 vs ×1.15コスト)
- [Lessons of my first incremental game (Furtado postmortem)](https://www.gamedeveloper.com/design/lessons-of-my-first-incremental-game)
- [Game Developer: (the) Gnorp Apologue interview](https://www.gamedeveloper.com/design/interview-the-gnorp-apologue)
- [MMORPG.com: Melvor Idle creator interview](https://www.mmorpg.com/interviews/interview-digging-deep-into-melvor-idle-with-its-creator-brendan-malcolm-2000123838)
- [Frank Lantz: Universal Paperclips](http://www.franklantz.net/universal-paperclips/) / [Wikipedia](https://en.wikipedia.org/wiki/Universal_Paperclips)
- [Draco Arts: Why Idle Mechanics Work Even When You're Offline](https://dracoarts.com/blogs/why-idle-mechanics-work-even-when-you-re-offline-the-science-of-passive-progress)(Rewardリスト構造)
- [FictionTalk: Psychology of Idle Games](https://fictiontalk.com/2021/08/25/the-psychology-of-idle-games-why-humans-like-big-numbers/)
- [Psychology Today: Harnessing the Fresh Start Effect](https://www.psychologytoday.com/us/blog/leading-for-success/202509/harnessing-the-fresh-start-effect)(リセット効果の非対称性)
- [Egg Inc Wiki: Prestige](https://egg-inc.fandom.com/wiki/Prestige) / [AdVenture Capitalist Wiki: Angel Investors](https://adventure-capitalist.fandom.com/wiki/Angel_Investors)(初回prestige 50-150 Angel・1-2日、復帰2-3時間)
- [MAF: Mobile Game Retention Benchmarks](https://maf.ad/en/blog/mobile-game-retention-benchmarks/)(D1 45-50% / D7 20-25% / D30 10%)
- [PlayBrain: Cookie Clicker Strategy Guide](https://playbrain.games/blog/cookie-clicker-strategy-guide-2026) / [Cookie Clicker Wiki: Building](https://cookieclicker.fandom.com/wiki/Building)(序盤閾値の実測)
