# ジャンル投票待機画面・UIプロトタイプ

- Status: Verified
- Last updated: 2026-10-30
- Related issue: None
- Related specifications: genre-vote.md, genre-result.md, ../components/common-ui.md, ../themes/design-system.md
- Implementation files: frontend/src/app/genre-vote-waiting/, frontend/src/app/ui-preview/genre-vote-waiting/, frontend/src/features/genre-vote-waiting/, frontend/src/features/genre-vote/genre-vote-screen.tsx, frontend/src/features/genre-vote/genre-vote.module.css, frontend/src/features/genre-vote/genre-vote-prototype.tsx, frontend/src/app/genre-vote/page.tsx, frontend/package.json

## 目的・対象範囲・承認

### 店舗待機からの再利用（2026-10-30）

今回の店舗画面実装依頼に基づき、表示部品に任意の`currentStep?: MealStep`（既定genre）と`voteSubject?: "ジャンル" | "店舗"`（既定ジャンル）を追加する。店舗はshop/店舗を渡すだけで、既存呼び出しの見た目・状態・演出は維持する。CSS/紙吹雪設定/完了マーク/summary/アバターは変更しない。関連仕様は[restaurant-vote-waiting.md](restaurant-vote-waiting.md)。進捗：既定ジャンル表示と投票16件からの遷移、店舗表示・1/3〜3/3人・多数・空・演出終了/再描画時の非再生・reduced-motionをブラウザーで確認。Docker lint/型検査/24テスト/build成功。既存のVerified記録は前回検証も含む。

### 結果画面への開発用接続（2026-10-30）

今回の結果画面実装依頼により、開発プレビューだけに全員完了→モック結果の導線を追加する。既存の人数切替は維持する。通常待機の人数/演出/表示構成は変更せず、全員完了時の「結果画面は準備中」を「投票結果の受信を待っています」に修正する。後述の結果未実装という記録は過去の状態であり、今回の接続/結果仕様は[genre-result.md](genre-result.md)を正とする。実同期/集計は引き続き未実装。

- Progress：接続のブラウザー確認に成功。既存の3/3表示は画面内に留まり、明示したモック接続操作で結果画面へ到達。既存の待機演出/人数/軽減設定と16ジャンルからの遷移も回帰検証済み。詳細は結果側の検証記録を参照。

2026-10-29のユーザーの実装依頼を承認根拠とする。Figma画像08に近い待機画面、入力された参加者状態に連動する人数・バー・アバター、開発専用の操作プレビュー、16件投票後の接続を実装する。本書の技術的補足は依頼の範囲に限定する。

## 対象外

API・DB・Go・Docker・API仕様、投票の保存・同期・集計、結果画面、結果確定条件、Service Workerとキャッシュ、時間による架空の人数更新、共通UIの公開Props変更。未実装の結果ページへのリンク・自動遷移は作らない。

## 現行の演出修正契約（2026-10-29）

最新のユーザー依頼「ジャンル投票完了画面のアニメーション修正」を承認根拠とし、以下を演出の現行契約とする。下段の14片/2100ms/.97〜1.04/静的装飾維持という記録は前回実装の履歴。本節で置き換える。業務仕様の変更や未決定事項はない。実装前自己レビュー96/100。

### 再現条件・期待する修正

- 現在は紙吹雪終了後も`VoteCompletionMark`内の`goldDecoration`と`redDecoration`が残る。これは紙吹雪ではなく常設装飾。両方のDOM/CSSと以前の紙吹雪軌道・キーフレームを撤去する。
- 赤丸/黄色四角というFigmaの形と色を参考に、赤・黄・水色・ピンク・オレンジの16片を新たに作る。丸/角丸四角が中心で、一部に小さい長方形を混ぜる。サイズ6〜10px程度、図形ごとの形/色/サイズ/移動/回転/揺れ/遅延/時間は型付き定数配列で指定する。
- チェック付近を起点に、左右への展開と上昇→頂点→揺れながら加速する落下→透明化を複数キーフレームで表現する。終端はopacity:0とし、初回表示の1回だけ再生。全体2600ms、粒子ごとの時間・遅延を変え、最長の粒子も全体時間を超えない。新しい乱数/JSの毎フレーム処理/依存追加は行わない。
- 紙吹雪レイヤーは既存円の周辺だけ（上26px/左右34px/下20px）に広げた絶対配置と局所クリップで描画し、レイアウト/文言/カードの位置を変えない。pointer-events:none・aria-hiddenを維持する。
- 2600msの親animationend、または2600+100msのフォールバックで紙吹雪レイヤー全体をDOMから削除。終了後は静的装飾を含め図形DOM0件。スクロール/人数再描画で復活しない。再読込/再訪は従来どおり新しい表示として1度再生する。
- 背景ピンクの疑似要素だけをscale(.80)→scale(1.05)→scale(.80)、2800ms・ease-in-outで呼吸させる。紙吹雪終了後の2700msから開始、fill-mode:bothで開始サイズを維持し、切替時に跳ねない。赤円/チェックの寸法・位置・初回登場演出は維持する。ピンク円の最小サイズは赤円より大きく、チェックの視認性を保つ。
- reduced-motionでは紙吹雪を初期から非表示/0msで撤去、ピンク円/赤チェックの拡縮も停止。途中の設定変更で紙吹雪を除去し、設定解除で再生成しない。タイマー/リスナーをアンマウント時に解除する既存処理を再利用する。
- Figma画像08には赤丸/黄色四角が常設されているが、最新の明示指示に合わせ、今回は形状・色の参考として使い、終了後の常設表示は行わない。この差以外の画面配置は変更しない。

### 変更範囲・検証・承認

変更は`celebration-config.ts`、`vote-completion-mark.tsx`、待機画面専用CSS、本仕様とREADMEの演出説明だけ。前回からの未コミット変更は保護する。共通UI/globals.css/ヘッダー/進捗/画面遷移/人数/アバター/状態/PWA/API/DB/Docker/依存は変えない。保護対象のハッシュを作業前に記録し、終了時に照合する。

指定7幅320/375/390/430/699/700/1024px・横844×390・短い高さ320px・文字200%で演出中/終了後を確認する。390pxの開始/途中/終了画像を保存してFigmaと比較する。5色・丸/四角/長方形、方向/揺れ/落下、自然終了でDOM0、再描画/スクロール後0、ピンクの最小/最大/周期/連続性と赤円/本文/カード位置不変、軽減設定、16件後の直接遷移/紙吹雪を検証する。Docker lint/typecheck/既存11テスト/buildとgit diff --checkを実行する。

### 今回のProgress

- 完了：関連資料/実装/Figma画像の再確認、常設装飾が残る原因の特定、Context7でReactのEffect/cleanupとMDNのキーフレーム別easing/軽減設定を確認、現行契約と自己レビュー。
- 承認：今回の具体的な修正依頼。自己レビュー96/100（実装一意性29/30、状態20/20、型15/15、外観14/15、再利用10/10、検証8/10）。
- 完了：新しい5色16片の紙吹雪・常設装飾撤去・ピンク円の拡縮強調・README更新。下記の検証と画像比較を完了し、Verifiedへ更新。
- 残作業：今回の受け入れ条件の残作業なし。実機での追加確認は未検証事項に記録。
- ブロッカー：なし。実機/支援技術/PWAインストールは引き続き対象外の未検証事項。

### 今回の変更ファイル（5ファイル）

1. `frontend/src/features/genre-vote-waiting/celebration-config.ts`：5色/3形状/16片のデータ、異なる軌道/サイズ/揺れ/回転/遅延/時間、2600ms、呼吸2700ms待機/2800ms周期/.80〜1.05。
2. `frontend/src/features/genre-vote-waiting/vote-completion-mark.tsx`：静的2図形を削除し、図形ごとのCSS変数と形状/色属性を渡す。既存の1回再生/終了時DOM除去/タイマー/軽減設定を利用。
3. `frontend/src/features/genre-vote-waiting/genre-vote-waiting.module.css`：古い紙吹雪/静的装飾CSSを削除。上昇/展開/揺れ/落下/透明化を再設計し、背景円の振幅/周期を調整。
4. `docs/spec/screens/genre-vote-waiting.md`：現行の演出契約と今回の検証記録。
5. `README.md`：新しい演出と終了後の除去について説明を更新。

新規の実装/依存/設定ファイルは追加していない。前回作業の未コミット変更を保持した。

### 今回の検証結果

| 検証 | 結果 |
| --- | --- |
| Docker lint/typecheck/build | すべて成功。最終ソースのNext.js静的生成を確認 |
| Docker投票テスト/人数テスト | 7件+4件=11件成功。既存のmodule形式警告のみ（失敗なし） |
| 図形/色 | 丸・角丸四角中心＋小さい長方形の16片。赤/黄/水色/ピンク/オレンジの5色を実DOMと画像で確認 |
| 移動 | キーフレーム0/.36/.62/.82/.99の実変形を採取。左/右の展開、上昇、落下、回転/揺れ、末尾の透明化を確認 |
| 完全消去 | 自然再生後の実測約2724msでレイヤーを除去。マーク内の全図形i要素0、常設2図形のDOM/CSSなし。スクロール後も0 |
| 再描画 | 開発プレビューで同じマークのインスタンスを保ち1/3→3/3へ更新。紙吹雪0件を維持し、人数/バーは正常更新 |
| ピンク円 | 2800ms周期でscale(.80)/1.05/.80を確認。周期境界の前後も連続。赤円・見出し・カードの座標/寸法は同一 |
| 指定7幅 | 320/375/390/430/699/700/1024pxで演出領域/赤円が幅内、アバターがカード内、文字と紙吹雪の領域は非重複、横スクロールなし |
| 横向き/低い高さ/文字拡大 | 844×390、390×320、320×568で文字200%。横スクロール/内部スクロールなし、通常ページスクロール可能 |
| 軽減設定 | 初期CSSで紙吹雪を非表示、クライアント起動後にDOM除去。ピンク円/赤チェックはanimation:none。途中のreduce変更でも撤去し、解除後の再生成なし |
| 16件後の遷移 | タッチで縦スクロール145→260・誤投票0、右スワイプ/undoを確認。16件目は通常の退場後に待機へ直接進み、新紙吹雪16片を確認。旧集計なし |
| 既存コード保護 | 共通UI、globals、layout、遷移、投票hook/画像、人数/プレビュー/PWA/ページ/packageの16ファイルの作業前後ハッシュが一致 |
| その他 | ブラウザー例外0、git diff --check成功。API/DB/Go/Docker変更なし、Go test/vetは対象外 |

軽減設定の最初の検証はSSRの非表示DOMをクライアント起動前に数えて失敗した。検証を「初期は視覚的に非表示→起動後にDOM除去」の契約に合わせて同期し、再実行で成功した。実装を緩めて検査を通す変更はしていない。

390pxの開始/途中/終了画像とFigma画像08、背景円の最小/最大を目視比較した。終了後の常設装飾撤去は今回の意図した差で、チェック・本文・状況カードの配置は維持している。

検証スクリプト/JSON/画像はCodexのvisualizations領域に保存（Git対象外）。今回の主な記録は`genre-animation-v2-verification.json`、`genre-animation-v2-handoff-touch.json`、`genre-animation-v2-start-390.png`、`genre-animation-v2-middle-390.png`、`genre-animation-v2-end-390.png`、`genre-animation-v2-halo-minimum-390.png`、`genre-animation-v2-halo-maximum-390.png`。

実機iOS/Android・Safari・実際のsafe-area・スクリーンリーダー・実機のFPS測定・PWAインストールは今回未検証。Edgeの画面幅/タッチ/軽減設定による検証と区別する。

## 追加依頼：旧完了表示の整理と演出（2026-10-29）

実装中の追加ユーザー指示を承認根拠とし、本節を以下の古い契約より優先する。自己レビュー96/100。今回もAPI/共通UI/PWA設定は変更しない。

- 削除対象はGenreVoteScreenのcomplete分岐にある疑似集計（件数内訳・投票記録details・再試行・完了後のundo）と専用CSS。`/ui-preview/genre-vote-waiting`は削除しない。
- onCompleteを必須にし、全16件の退場演出が終わると1度通知してrouter.replaceで待機へ直接進む。ルート準備中だけ「みんなの投票状況を開いています…」を表示する。投票中のundo・通常スワイプ・画像・データとhookは維持する。
- 待機のチェック表示は専用Client Componentに分離。最初に赤チェックだけ約300ms軽く拡大表示し、装飾の紙吹雪14片をチェック周辺の限定領域から広げて落下・消失させる。赤/ピンク/オレンジ/黄の画面固有色を使用。全体2100ms、個々の遅延・移動値は定数配列とCSS変数で管理する。
- 紙吹雪は1回の画面マウントにつき1度。人数やroomIdの再描画で再実行しない。再読込・別画面からの再訪は新しい表示として1度再生する。表示状態/人数の変更を発火条件にしない。装飾のためpointer-events:none・aria-hidden。
- 最長animationendで紙吹雪DOMを除去し、2100ms+100msのタイマーでも除去を保証する。アンマウント時にタイマーとmedia listenerを解除する。reduced-motionでは初期からCSSで非表示、0msで除去し、途中で軽減へ変わった場合も除去する。
- ピンク背景は独立した疑似要素とし、紙吹雪の終了に合わせ2200ms後から3600ms周期・ease-in-outでscale(.97)→scale(1.04)→scale(.97)、opacity .88→1を繰り返す。赤チェックやコンテナには呼吸変形を付けない。レイアウト/スクロール位置は変化させない。
- 紙吹雪領域は円の周囲22pxまでの局所的なクリップ領域に収め、テキストやカードにかからない。ページ全体で横はみ出しを隠す対処は行わない。紙吹雪終了後もFigmaの小さな静的装飾2個は維持する。
- reduced-motionでは紙吹雪・初回拡大・呼吸を無効化し、チェックとメッセージは静止表示する。
- 指定7幅/横向き/文字拡大で演出中と終了後を確認。14片→0片、人数更新で0片を維持、赤円の寸法/位置不変、ピンクの変形、本文の位置不変、軽減設定、16件後に旧集計なしで待機へ到達を検証する。

## 前提条件・参照資料

- AGENTS.md、README、画像08、Figma CSS/TSX・監査・実装メモ、テーマ/共通UI/投票仕様と実装を確認。指定資料はすべて存在する。
- 作業ブランチは既存のfeature/genre-vote-waiting。開始時のGit変更なし。共通UI/投票はmainにマージ済み。
- Context7のNext.js App RouterとReactの制御されたProps/派生値を確認済み。既存ButtonとCSS Modulesの記法に従い、新しい依存を追加しない。
- AppHeaderはroomNumber、ParticipantAvatarはcomplete/waiting・lgを既に持つ。共通部品は変更せず、画面固有の配置はCSS Moduleで指定する。

## URL・アクセス・画面構造

- `/genre-vote-waiting`：API未接続の表示プロトタイプ。直アクセス・再読込ともモック2/3人。ルーム参加判定は行わない。
- `/ui-preview/genre-vote-waiting`：開発時のみの操作プレビュー。productionではnotFound。通常画面にデバッグ操作を表示しない。
- 通常画面はPageContainer、AppHeader、StepProgress(currentStep="genre")、完了装飾、メッセージ、投票状況カード、ParticipantAvatarの順。
- ヘッダーに既存PROTOTYPE_ROOM_IDを渡す。表示部品のroomId?:stringは任意の実データに差し替え可能。
- 通常画面は表示専用のServer Componentを基本とし、状態操作と画面遷移だけClient Componentにする。下部操作がないためBottomActionは通常画面に置かず、開発プレビューの操作領域に再利用する。

## レイアウト・外観・アニメーション

- 共通ヘッダー/進捗は投票画面と同じ寸法。mainの余白を画面内で0にし、進捗の下の本文だけ上24px・左右max(22px,safe-area)・下max(32px,safe-area)を確保する。
- 完了領域は本文上34pxを基準、320pxでは24px。淡赤円はclamp(92px,26.25vw,105px)、内赤円は66/105の比率、白チェック、黄色の角丸片と赤い小円をCSS/SVGで表示する。装飾はaria-hidden。
- 円の下22px、キッカー「投票完了！」は12px/800・下12px、h1「みんなの投票を待っています」は26px/1.4（狭幅24px）で意味の切れ目に折返し可能なspanを配置する。本文は14px/1.8、見出しとの間12px。
- 本文は指定の「全員が投票すると、自動で結果が表示されます。」。全員完了時はh1を「みんなの投票が完了しました」、本文を「全員の投票が完了しました。結果画面は準備中です。」へ変更し、自動遷移を装わない。
- 状況カードは上26px、共通meal-cardの白/枠/角丸22px/影/内側20px。人数の主要数34px、補助16px、右に淡赤の残り人数チップ（完了時「全員完了」）。狭幅や文字拡大時は行を折り返す。
- バーは高さ9px、上下14/20px、赤い塗りと境界線色のトラック。width変化300ms ease。初回から現在の比率を表示し、架空の0人から始めない。
- アバターはlg46px、中央寄せgap12px・折返し。共通部品に渡すnickname/stateの文字はこの画面だけ視覚的に隠して読み上げに残し、Figmaのイニシャル＋✓/…を再現する。長い名前もアクセシブル名に残す。
- 初回は赤チェックの300ms程度のフェード/軽い拡大と一度きりの紙吹雪、その後は背景円だけを穏やかに呼吸させる。animation-fill-mode:bothで待ち時間も開始サイズを保ち、呼吸開始時に大きさが飛ばないようにする。prefers-reduced-motionで演出とバーtransitionを無効化する。
- 最大430px、700pxの外枠切替、通常縦スクロールは既存PageContainerを使う。固定高・内部スクロール・負のマージン・横はみ出しの隠蔽で調整しない。

## 入力・出力・状態管理

- `WaitingParticipant`：readonly id:string（表示名から独立・配列内で一意）、nickname:string、avatarText?:string、tone:"peach"|"pink"|"blue"、state:"complete"|"waiting"。API型やDB型ではない表示用データ。
- `GenreVoteWaitingScreenProps`：participants:readonly WaitingParticipant[]、roomId?:string。表示部品自身は通信・タイマー・投票完了判定の生成・遷移を持たない。
- `summarizeParticipants`でtotal、completed、remaining、percentage、allCompleteを配列から毎回導出する。completedはstate===completeの数、remaining=total-completed、percentage=total>0?completed/total*100:0、allComplete=total>0&&remaining===0。
- 0人は「参加者情報がありません」、残数「確認待ち」、0%とし、全員完了にはしない。通信がないためloading/error/retryは発生しない。取得・失敗処理は将来のデータ供給側の責務。
- 初期モックはYU/MI完了、KE待機（2/3）。開発用プレビューに1/3・2/3・3/3プリセット、個別状態切替、多数/長文/0人の確認操作を設ける。操作は明示的に配列を更新し、時間経過では変化しない。
- progressbarにmin=0、max=参加者数（0人のときは1）、now=完了数、valuetext=人数と残数を付ける。role=status・aria-live=polite・atomicで更新内容を通知する。見出しはh1、カードのh2はsr-only。✓/…と名前/状態文字で色以外にも状態を示す。

## 投票画面との接続・再読込

- 既存GenreVoteScreenに必須のonComplete:()=>voidを追加し、16件の退場演出後にcompleteになったとき一度だけ通知する。refで重複通知を防ぎ、0件は通知しない。既存hookの投票・undo・スワイプ処理は変更しない。
- `/genre-vote`のClient用アダプターが通知を受け、Next.js router.replaceで`/genre-vote-waiting`へ移る。投票画面の未完了状態をブラウザー戻るで復元できるとは扱わない。既存の画面内投票はアンマウントで破棄する仕様を維持する。
- 待機画面に必要なのはルーム表示と参加者の完了状態であり、16票の内容は転送・保存しない。今回の接続では同じ仮ルームIDと「自分のYUが完了」のモックをそれぞれのpageから渡す。実データとの同期を意味しない。
- 再読込/直アクセスは常にモック2/3。プレビューの操作結果はメモリだけで、再読込で戻る。投票画面を開き直すと1/16。旧完了/疑似集計表示は撤去し、投票中のundoは維持する。
- 結果画面が実装されていないため全員完了を表示するまで。将来の結果取得/購読/自動遷移はページのデータ供給・ナビゲーション境界に追加する。

## 資料と既存コードの差

- Figma App.tsxのVoteWaitは固定2/3・66%・画面内デモボタンで存在する結果へ切替える。本実装は参加者配列から計算し、デモ操作は開発専用、結果の架空遷移なし。依頼を採用根拠とする。
- Figmaの固定100dvh/内部スクロール・下部絶対配置は、テーマと現在のPageContainerの通常ページスクロールに合わせる。
- 既存投票仕様の「正式な待機遷移は対象外」と完了表示は今回のプロトタイプ接続に限り本書で更新する。本番の同期・集計遷移条件は決めない。
- READMEのmain/feat手順とAGENTSのdev/feature手順に既存の差がある。今回は既存の指定ブランチを維持し、Git運用は変更しない。
- READMEの「投票/PWAは今後実装」の案内は既存の投票UI/manifestと一致していないため、今回の表示プロトタイプ範囲とPWA未対応範囲を追記する。

## 受け入れ条件・検証方法

1. Figma画像08と390pxの完成画像を比較し、ヘッダー/進捗/円/メッセージ/カード/3人の配置・配色が近いことを確認する。
2. 初期2/3・あと1人、1/3・あと2人、3/3・全員完了とバー/アバターが連動する。時間だけでは変わらず、全員完了でも存在しないページへ移動しない。
3. 0人・多数・長文・長いルームで横スクロール/重なり/不正な割合を生じない。
4. 320/375/390/430/699/700/1024px、横844×390、文字200%、軽減設定で表示/通常スクロールを検証する。フォーカス/キーボードでプレビューを操作できる。
5. 既存投票のスワイプ/ボタン/undo/16件後の待機遷移、再読込の初期化、既存/ui-preview・/・healthを回帰確認する。
6. Docker Composeのlint/typecheck/build、既存投票テストと新規人数ロジックテストを実行する。通常画面に開発ボタンなし、productionプレビューが404、API呼出しなしを確認する。
7. PWAは既存viewport/フォント/テーマ/安全領域・manifest/アイコンを利用する。既存manifestのscopeは/genre-voteのまま。scopeはURLの前方一致のため/genre-vote-waitingも一致する（[MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope)）。設定変更はせず、インストール・standalone遷移・SW・実機safe-areaは今回の検証済みと扱わない。

## 未決定事項

今回のプロトタイプの実装に必要な未決定事項なし。本番の参加者取得/同期/本人識別・投票保存・結果画面/自動遷移・PWA全体scopeは対象外として残す。

## 作成・変更ファイル

### 作成（12ファイル）

- `frontend/src/app/genre-vote-waiting/page.tsx`：モックを表示部品へ渡すServerページ、既存PWA素材を参照。
- `frontend/src/app/ui-preview/genre-vote-waiting/page.tsx`：開発限定の操作プレビュー。
- `frontend/src/features/genre-vote-waiting/genre-vote-waiting-screen.tsx`：共通部品による待機表示。
- `frontend/src/features/genre-vote-waiting/genre-vote-waiting.module.css`：レイアウトと画面固有の演出。
- `frontend/src/features/genre-vote-waiting/genre-vote-waiting-preview.tsx`：明示的な人数・参加者状態の操作。
- `frontend/src/features/genre-vote-waiting/waiting-state.ts`：表示用の型と派生人数/割合。
- `frontend/src/features/genre-vote-waiting/waiting-state.test.mjs`：集計の4テスト。
- `frontend/src/features/genre-vote-waiting/prototype-data.ts`：仮参加者と待機URL。
- `frontend/src/features/genre-vote-waiting/vote-completion-mark.tsx`：装飾の一度きりのライフサイクル。
- `frontend/src/features/genre-vote-waiting/celebration-config.ts`：紙吹雪の軌道と演出時間。
- `frontend/src/features/genre-vote/genre-vote-prototype.tsx`：投票完了通知からルーティングする境界。
- `docs/spec/screens/genre-vote-waiting.md`：本仕様と検証結果。

### 変更（6ファイル）

- `frontend/src/features/genre-vote/genre-vote-screen.tsx`：完了通知を追加、旧疑似集計を撤去。
- `frontend/src/features/genre-vote/genre-vote.module.css`：旧完了表示専用のスタイルを撤去。
- `frontend/src/app/genre-vote/page.tsx`：投票用アダプターへ接続。
- `frontend/package.json`：待機ロジックテストの実行scriptだけを追加（依存変更なし）。
- `docs/spec/screens/genre-vote.md`：今回の完了遷移を現行契約に追記。
- `README.md`：確認URL、モック/再読込/演出/PWA/検証の案内。

## 最終検証結果（2026-10-29）

| 検証 | 結果 |
| --- | --- |
| Docker `npm run lint` | 成功 |
| Docker `npm run typecheck` | 成功 |
| Docker `npm run test:genre-vote` | 7件成功 |
| Docker `npm run test:genre-vote-waiting` | 4件成功（0人/全員待機、1/2/3人、増減/取り消し、多数） |
| Docker `npm run build` | 最終CSSを含め成功。全ルートの静的生成を確認 |
| productionの一時サーバー | `/genre-vote-waiting`=200、開発プレビュー=404、デバッグ操作なし。確認後に一時サーバーを終了 |
| `git diff --check` | 成功 |
| Edge指定7幅 | 320/375/390/430/699/700/1024pxで横スクロールなし、アプリ最大430px、ヘッダー/進捗/カード/アバターが範囲内 |
| 横向き・文字拡大 | 844×390と320pxでの文字200%で横スクロールなし。内部スクロールなし、通常の縦スクロールで下端へ到達 |
| 人数・参加者更新 | 初期2/3、1/3、3/3、個別完了の取り消し、0人、12人/長文と長いルームIDを確認。バー幅は33.333…/66.666…/100%、全員完了でもURL維持 |
| 読み上げ/キーボードの構造 | h1/h2、progressbarの人数・値、role=statusの更新、名前/完了・待機の文字を確認。Spaceで個別状態を切替可能 |
| 紙吹雪 | 指定7幅で14片表示、横スクロールと文字への重なりなし。自然終了で0片、人数更新で再生なし。装飾はaria-hidden・pointer-events:none |
| 呼吸 | 3600ms周期/2200ms待機、scale(.97)/1.04/.97を確認。赤円・見出し・カードの座標/寸法は不変 |
| 軽減設定 | 初期reduceでは紙吹雪DOMなし、背景/赤円/装飾のanimationなし。途中のreduce変更で紙吹雪を撤去し、解除後も再生成なし |
| 既存投票 | 16ジャンルの順序、マウスの左右スワイプ、移動量によるラベル、閾値未満の復帰、ボタン、undo、16件後の待機へ到達を確認 |
| タッチ操作 | Edgeのネイティブタッチ入力で縦操作時scrollY145→268・投票0件、右スワイプ/戻るが動作。最後の投票は通常アニメーションで退場し、直接待機と紙吹雪14片を確認 |
| 旧疑似画面の撤去 | 旧集計/投票記録/再試行のDOMと専用CSSを削除。最終投票から遷移までのDOM監視でも旧画面なし。開発プレビューは維持 |
| 再読込/再訪 | 待機とプレビューは2/3へ、投票再訪はラーメン1/16へ初期化 |
| 既存画面 | `/ui-preview`、`/`接続成功、`/api/health`でstatus/database=ok |
| ブラウザー例外/API | 例外0、投票/待機/プレビューからのAPI呼出し0（healthはスモーク確認用に別途実行） |

人数ロジックのNodeテストには、既存の投票テストと同じMODULE_TYPELESS_PACKAGE_JSONの警告が出るが、失敗はない。プロジェクト全体のmodule設定を変えて警告を抑える変更は行わない。

画像08と390px画像を目視比較し、ヘッダー・進捗・円・中央見出し・白カードの配置が近いことを確認。相違はSVGチェック、指定の紙吹雪/背景円の動き、狭幅の自然な折返し、通常ページスクロール。人数は参考コードの固定66%ではなく正確な2/3から算出する。

スクリーンショット/JSON/ブラウザー検証スクリプトはCodexのvisualizations作業領域に保存し、Gitには含めない。主な記録は`genre-waiting-verification.json`、`genre-celebration-verification.json`、`genre-waiting-handoff-touch.json`、`genre-waiting-from-vote-confetti.png`、`genre-waiting-from-vote-idle.png`、`genre-waiting-320.png`、`genre-waiting-430.png`。

実機iOS/Android・Safari・実際のsafe-area・スクリーンリーダー・PWA実インストール/standalone遷移は未検証。画像パス/画像表示部品は変更しておらず、今回の画面確認は既存の写真なしプレースホルダーを使用した。Go/API/DBは変更していないためGo test/vetは対象外。

## Progress

- 完了：指定資料と実コードの照合、Context7確認、実装契約、自己レビュー。
- 実装開始承認：本ユーザー依頼。自己レビュー96/100で着手。
- 完了：待機画面/開発プレビュー/接続の初期実装。Docker lint/typecheck、人数4件/既存投票7件のテスト、初回build成功（フォント取得リトライ後成功）。追加依頼の旧集計撤去・紙吹雪/呼吸の仕様を承認済み、実装に着手。
- 完了：旧完了分岐と専用CSSを撤去、14片の紙吹雪/背景円の呼吸/軽減設定を実装。人数プレビューは維持。追加後のlint/typecheck/build、11件のテストに成功。
- 完了：指定7幅、横844×390、文字200%、人数更新/0人/12人/長文、左右スワイプ/undo/16件後の遷移、再読込、共通UI/接続確認をEdgeで検証。紙吹雪14→0片・再描画で再生なし・赤円/文字/カードの位置不変・軽減設定を確認し、画像08と390pxの画像を比較した。
- 完了：productionプレビュー404、最後の呼吸開始サイズ調整後のbuild、タッチと最終投票からの紙吹雪、画像比較、検証記録。今回の受け入れ条件をすべて確認しVerifiedに更新。新規ルートの初回404は設定を変えずfrontend再起動で解消した。ブラウザー検証の既存共通UI見出しの指定誤りは検証スクリプトだけ修正し、再実行に成功した。
- 残作業：本番の同期/結果画面、実機/支援技術/PWAインストール検証（対象外）。今回のコード変更のブロッカーなし。
- ブロッカー：なし。
- 関連Issue/PR/commit：None（作成/送信なし）。

## Self-Review

- Score: 96/100
- Review date: 2026-10-29
- Reasons for deductions: 一意性29/30、状態20/20、型15/15、外観14/15、再利用10/10、検証8/10。実機/支援技術の確認とFigmaの実測差を残す。
- Revisions made: 再読込/メモリ破棄、0人/多数、通常画面と開発操作の分離、結果未実装時の表示、旧完了画面の撤去、演出の開始/除去/再描画/軽減設定と検証結果を記録した。
