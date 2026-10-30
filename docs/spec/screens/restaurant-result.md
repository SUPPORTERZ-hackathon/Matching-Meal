# 店舗投票結果画面・静的フロントエンドプロトタイプ

- Status: Verified
- Last updated: 2026-10-30
- Related issue: None
- Related specifications: restaurant-vote.md, restaurant-vote-waiting.md, genre-result.md, ../themes/design-system.md, ../components/common-ui.md
- Implementation files: frontend/src/app/restaurant-result/, frontend/src/app/ui-preview/restaurant-result/, frontend/src/features/restaurant-result/, frontend/src/features/restaurant-vote/route-data.ts, frontend/src/app/restaurant-vote/page.tsx, frontend/src/features/restaurant-vote-waiting/restaurant-vote-waiting-preview.tsx

## 目的・承認・範囲

### マッチ率・明示デモの現行契約（2026-10-30）

今回のユーザー指示で計算式が確定したため、以下を現行仕様とする。後段の「マッチ率未定義のため人数バッジ」「IDだけでモックを供給」「Docker未復旧」は前回の記録。既存の未コミット実装を保護し、同じfeature/restaurant-resultで必要部分だけ修正する。ユーザー指示を承認根拠とし、今回必要な未決定事項はない。

- `RestaurantVoteTotals = { likes:number; total:number }`。likesは対象店舗の「ここがいい」人数、totalはその店舗の「ここがいい」＋「見送り」人数。ルーム全参加人数や未投票人数ではない。参加者完了配列から支持数を作らない。既存の内訳形式を保ち、意味とモック定数名を明確にする。
- 純粋関数`calculateMatchRate(votes)`で`Math.round(likes / total * 100)`。total=0、内訳未取得はnull（UIは「集計待ち」）。有限・安全整数、0<=likes<=totalを検証し、不正入力から数値を生成しない。結果resolverも同じ検証を使用する。0%と集計待ちは区別する。
- 画像12の写真左下に赤/白の`BEST MATCH`と整数%（または集計待ち）を静的表示。13px左/下、角丸12px、padding7px 10px、ラベル10px/数値16pxを通常値とし、幅・文字拡大時は折り返し可能。画像の流れ/寸法・固定Maps導線・全域のアニメーション停止は維持。
- サマリーの「全員」は投票済み人数を指すと明記。未投票者まで全員支持と誤認させない。total=0/内訳なしでは完了/満場一致を表示しない。
- 画面10の現実装に数値マッチ率はなく、写真左上の`表示サンプル`がある。写真上のバッジとその専用CSSを撤去し、本文の架空店舗注記とgenre.nameバッジを維持。投票ボタン/状態管理/アニメーション/遷移は無変更。
- `demo=1`（単一の文字列1だけ）を明示デモとする。通常待機にボタンなし。`/restaurant-vote-waiting?genre=italian&demo=1`の時だけ、通常フローの下に既存Buttonを使い「デモ：結果画面へ進む」と説明を表示。既存待機部品・人数/参加者配列・演出・共通UIを変更しない。
- デモ導線は既存16ジャンルを検証し、`createMockRestaurants(genre)`の先頭候補を表示対象にする。これはデモ表示用の選択であり、勝者決定/集計ではない。ジャンル未取得/不正や候補なしでは無効化と説明、他のジャンルへ補完しない。
- ボタン操作時だけgenre/restaurant/demo=1を付けて結果へ遷移。結果ルートはdemo=1かつ両IDが有効な時だけ既存モック内訳（3/3）と既存候補を再利用。通常modeはAPI結果未取得なのでIDだけ渡されても結果なし。デモ内訳はサンプルと明示し、保存/送信/実集計をしない。再読み込みはURLから同じモックを再生成。
- 既存の開発プレビュー導線も明示的にdemo=1を付ける。開発プレビューは引き続きdevelopment限定。結果プレビューに集計待ち/0%/33%/67%/75%/100%を追加し、既存モックの内訳だけを差し替えて確認する（候補を複製しない）。
- 通常フローの投票→待機にはdemoを勝手に追加しない。明示デモは本番ビルドでもquery opt-inで確認可能だが、通常利用者には表示しない。結果の通常modeの結果なし表示を維持する。

#### 今回の受け入れ条件・検証

1. 0人→集計待ち、0/3→0%、1/3→33%、2/3→67%、3/4→75%、3/3→100%。未投票者の人数は入力/分母に使わない。不正内訳も単体検証。
2. 画面10は写真上の数値/サンプルバッジなし・ジャンル表示あり、ボタンと切替の回帰確認。
3. 通常待機/`demo=0`/重複demoにボタンなし。demo=1でボタン→両ID/demo付き結果、他ジャンルの名前が正しい。欠損genreでラーメンを補完しない。
4. 通常結果（demo未指定）・不正ID・結果なしはエラー表示を維持。デモ/プレビューは実集計でない注記、0%と集計待ちを区別。
5. 320/375/390/430/699/700/1024px・844×390・390×320・文字200%で3画面の横スクロールなし、バッジが写真内、固定Maps本文予約、画面12のgetAnimations=0。既存待機の紙吹雪DOM消去と円アニメーション、店舗投票・既存ジャンルの回帰を確認。
6. 復旧したDocker Composeでlint/typecheck/全フロントエンドテスト/build。前回未完了の水和後表示・遷移・回帰を今回あわせて検証。禁止ファイル無変更をgit diffで確認。実機/インストール/支援技術は未検証として区別。

## Progress（現行）

- 完了：既存未コミット変更/資料/バッジの実体/確定計算式/モックを確認。Docker応答の復旧を確認。
- 完了：計算分離・静的マッチ率バッジ・demo opt-in導線・全ケースの単体/ブラウザーテスト。
- Docker検証：lint成功（既存home-previewの未使用Plus警告1件・エラー0）、typecheck成功、フロントエンド35テスト成功、最終CSSを含むbuild成功。NodeのMODULE_TYPELESS_PACKAGE_JSONは既存構成由来の警告で、module設定は変更しない。
- 実Nextブラウザー検証：Edge/Playwrightで29検証群成功。結果の7幅/844×390/390×320/文字200%・長文/写真未登録/失敗/読み込み中/成功・結果なし・重複/不正query・固定Maps領域と本文末尾予約・アニメーション0を確認。0人/0%/33%/67%/75%/100%を表示で確認。
- デモ境界：通常待機/demo=0/重複demoに操作なし、genre欠損/不正は無効、demo=1でEnter/タップから両ID/demo付き結果へ遷移。通常結果はIDだけ渡されてもモックなし。イタリアン/韓国料理/焼肉、プレビューの寿司・海鮮で名前を確認。通常待機に偽の自動遷移なし。
- 回帰：店舗の両投票ボタン/10連打1票/タッチ横移動で無投票/4店舗後の通常待機、既存ジャンルのスワイプ表示/undo/16件/待機の紙吹雪終了・円2.8秒、ジャンル結果の演出と固定CTAを確認。対象フローでpageerror 0・API通信0。
- 視覚比較：390pxで画像12と比較。文字200%のスクリーンショットから写真領域の幅/最小高による見切れを発見し、幅100%・最小高10remとプレースホルダー下余白で再調整。追加の7幅/200%通常・0人・未取得で、写真/説明/バッジの全矩形が枠内、重なりなし、横スクロールなし、演出なしを確認。
- 本番実行：コンテナ内の一時サーバーで通常待機・明示デモ待機・通常結果の未取得・明示デモ結果100%を確認。開発結果/待機プレビューは404。終了後一時サーバー停止。
- 完了：git diff --check成功。禁止領域・共通UI・既存演出・店舗投票ロジックの差分なし。前回の未コミット実装を維持。コミット/プッシュ/PRなし。
- 残作業：今回の範囲なし。実端末のiOS/Android・支援技術・OSのMaps起動/復帰・PWAインストールは未検証。正式なAPI結果/投票保存/同期/集計は未実装。
- Blockers: None（Docker復旧済み、前回の保留検証も実施）。
- 未決定事項：今回の表示・デモに必要なものなし。実データ取得/実集計/同期は引き続き対象外。

検証スクリプト/結果/画像はGit対象外の`C:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/`へ保存。`verify-match-demo.cjs`、`restaurant-match-demo-results.json`（29群）、`verify-match-photo-final.cjs`、`match-photo-final-results.json`、`verify-match-demo-touch.cjs`。390px画像：`restaurant-vote-no-badge-390.png`、`restaurant-waiting-demo-390.png`、`restaurant-result-match-390.png`。

### 今回の修正ファイル（前回の未コミット分へ追記）

- 写真上バッジ撤去：`frontend/src/features/restaurant-vote/restaurant-photo.tsx`、`restaurant-vote.module.css`。
- 計算/表示/モック/検証：`frontend/src/features/restaurant-result/`のresult-data.ts、prototype-data.ts、restaurant-result-screen.tsx、restaurant-result.module.css、restaurant-result-preview.tsx、restaurant-result.test.mjs、README.md。
- 明示mode：`frontend/src/app/restaurant-vote-waiting/page.tsx`、`frontend/src/app/restaurant-result/page.tsx`、`frontend/src/features/restaurant-vote-waiting/restaurant-vote-waiting-preview.tsx`、新規restaurant-demo-action.tsx・restaurant-demo-action.module.css。
- 仕様：本書、restaurant-vote.md、restaurant-vote-waiting.md。前回の実装ファイルは下段の一覧も参照。

## Self-Review

- Score: 97/100
- Review date: 2026-10-30
- Reasons for deductions: 実機とOSの外部Maps引継ぎは未検証（3点）。
- Revisions made: 投票済みtotalの意味、正常/明示demoの境界、0人/0%/未取得の区別、200%時の写真/バッジ寸法を明文化し検証した。

## 初回実装時の契約（以下は履歴）

ユーザーの2026-10-30の実装指示を承認根拠とし、Figma画像12に沿う静的な店舗結果画面、固定マップ導線、動的ジャンル表示、開発プレビューとモック遷移を実装する。本文書が主仕様。取得/保存/集計の業務ルールは定義しない。

## 対象外

バックエンド/Go/Gin/API/認証/DB/PostgreSQL/Docker/環境変数/API仕様/PWA/Service Worker変更、Hot Pepper/Maps API通信、APIキー、実投票集計/同期/全員完了判定、既存投票ロジック・既存演出の変更、共通UIの変更、新規依存。画面12に入場/拡縮/フェード/紙吹雪/スクロール連動等のアニメーションを実装しない。

## 前提・資料・ブランチ・差異

- 開始時feature/restaurant-resultは812f643、未コミット変更なし。取得したmainは0b718b6（店舗投票・待機をPR #10でマージ済み）。作業ブランチをfast-forwardして追従。新規コミット/プッシュ/PRなし。
- 画像09/10/11/12、保存済みFigma TSX/CSS、共通UI/テーマ/関連画面仕様、既存の型/モック/ルーティング/固定CTAを確認。店舗結果の既存仕様はないため新規作成。
- Figmaの98%は定義・入力がないため生成しない。写真内の赤いバッジは渡された「行きたい人数/参加人数」を表示。画像未登録と住所/座標欠損はそのまま代替表示。住所は表示用型と純粋変換に任意項目を追加し、値がない時に補完しない。
- 店舗投票仕様の「genre省略時ramen」は今回の「未取得情報をラーメンにしない」という明示要件で更新する。見た目のバッジは既存genre.nameを引き続き利用。
- 待機画面には元々ジャンルバッジがない。通常待機に新しいバッジ/開発ボタン/自動遷移を加えない。URLのgenreを保持し、開発プレビューの明示操作だけで結果へ接続する。
- 共通BottomActionは通常フローのまま。結果専用fixedラッパーに入れ、ジャンル結果と同じResizeObserverによる高さ予約方式を使う。

## URL・アクセス・階層

- `/restaurant-result?genre=既存ID&restaurant=既存店舗ID`。両IDを検証した場合だけ、共有モック候補と明示したモック投票内訳を供給する。通常ルートにも「サンプル結果・実際の集計ではありません」と表示。未指定/空/重複query/不正IDは結果なし/確認できない状態、別ジャンル・店舗へ補完しない。
- `/ui-preview/restaurant-result`はdevelopment限定（その他404）。ジャンル・店舗の選択、長店舗名/長ジャンル名、写真なし/失敗、情報欠損、票数なし/一部支持、結果なしを確認。通常画面に操作を混ぜない。
- AppHeader(仮Room2481) → StepProgress(result) → 「決定！」→「みんなの『行きたい』がマッチしました！」→ 店舗写真カード（赤い票数バッジ、genre.name、店舗名、営業時間、住所・ディナー予算・アクセス）→ ハート付き投票サマリー → モック注記。下端に固定Maps導線。
- 住所/予算/アクセスはdl、見出しh1→店舗h2、装飾SVGはaria-hidden。カード全体をリンクにしない。

## 入出力・再利用・データ

- `RestaurantResultData = { genreId:string; restaurantId:string; votes?:{ likes:number; total:number } }`。入力の決定IDを使い、票数から勝者を計算/並び替えしない。
- `resolveRestaurantResult`は既存Genre[]とRestaurantCandidate[]からIDを照合。候補の一意性、ID/名前、票数の有限整数・0以上・likes<=totalを検証。不正ならnull。0/0や内訳未取得は全員支持と判定しない。total>0かつlikes===totalの時だけ全員支持の説明。
- 既存genres.ts、RestaurantCandidate/toRestaurantCandidate/createMockRestaurantsを再利用。同一店舗モックを複製しない。表示用店舗型にはaddress?:string、入力部分型にはaddress?:string|nullを任意追加し、値がある時だけ変換する。
- モック結果の3/3は表示確認用に渡す値で実集計ではない。参加者完了数と店舗への支持数を同一視しない。店名/画像/住所/予算/アクセスは共有候補から取得。
- `resolveRestaurantGenre`の暗黙の既定値を撤去。通常店舗投票はジャンル必須、プレビューの明示された初期選択のみramenを使用してよい。16ジャンルの固定ID/日本語名は変更しない。
- 画像は同じ安全URL関数を再利用する。既存RestaurantPhotoにはフェードがあるため、結果専用の静的Photoを作る（既存写真部品は無変更）。next/image unoptimized/fill・object-fit:cover、固定アスペクト比、成功時の透明度遷移なし。失敗時だけ画像要素を外し、背景のプレースホルダーを残す。
- 正式Hot Pepper由来の入力には既存と同じクレジット文言/公式リンクを表示可能にし、モックには付けない。

## Googleマップ・固定操作領域

- [Google公式Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)を参照。`https://www.google.com/maps/search/`、api=1、query=latitude,longitudeをURLSearchParamsでエンコード。キー/API/位置検索は使わない。
- 緯度は有限numberの[-90,90]、経度は[-180,180]。0は有効。片側欠損/文字列/NaN/Infinity/範囲外はURLなし。店名や住所から座標を推測しない。
- 有効時は既存Button(dark,meal)をasChildでaに適用、target=_blank・rel=noopener noreferrer・別タブの読み上げ名を付ける。元画面は保持。無効時はdisabledボタンと「位置情報がないためマップを開けません」。通常モック全件に座標がないため無効が正しい初期表示。
- 結果専用fixedラッパーをbottom:0、width100%/max430px/中央、共通22px左右余白とsafe-areaで配置。本文に実測高さ+24pxの下余白。SSR時も保守的なrem予約高を設定。ResizeObserverはリサイズ/文字拡大で再計測し、unmountで解除。低い画面では注記を隠すのではなく通常スクロールで本文末尾まで到達させる。

## 状態・遷移・アクセシビリティ

- 結果なし→入力された有効結果の静的表示。画像はmissing/loading/loaded/failed。結果取得のネットワーク/スケルトン/リトライは未実装で、取得済みpropsを将来差し込む。
- 画面12全域でCSS animation/transitionを停止する。共有Buttonの遷移/押下時拡縮も専用CSSで停止し、フォーカス表示は残す。キーフレーム・演出タイマーなし。reduced-motion設定に関係なく静止。
- 通常店舗投票→待機の既存動作は維持。全員完了の入力だけでは本番画面から架空結果に移動しない。
- 待機開発プレビューにgenre/restaurant選択と「全員完了からサンプル結果へ」を追加。明示操作でモック参加者を全員完了にしたうえで両IDをqueryに含めて遷移。通常待機/演出ロジックは変更しない。プレビューは直接queryから受け取った有効genreを優先、無指定は明示されたサンプル選択を初期表示、不正は結果導線無効。
- キーボードEnter/タッチ/フォーカス、読み上げ見出し/状態、色以外の票数文字を用意する。マップURL以外の外部通信なし（テストで外部遷移は応答差し替え）。

## レイアウト・レスポンシブ

最大430px、通常左右22px、700px以上の外側余白/角丸、安全領域・通常縦スクロールを維持。画像は約7:4、カード26px角丸/白/既存影、内側18px。見出し22px、店名22px、バッジ12px、情報12pxを基準にremで調整。200%時も自然に折り返し、装飾アイコンは本文を押し出さない。票数バッジは写真の下辺へ重ね、長文時は写真外に文字を切らない可変高を確保する。

## 受け入れ条件・検証

1. 画像12に近い静的表示で、結果画面のgetAnimationsは0。時間経過・画像成功/失敗・スクロール・reduced-motion・条件変更でも演出なし。
2. 指定7幅320/375/390/430/699/700/1024px、横844×390、低390×320、文字200%、長店舗/ジャンル名で横スクロールなし。固定領域のviewport下端位置が不変、スクロール末尾で本文が操作領域より上に表示される。
3. 内訳あり/なし/0票/一部支持、不正ID/重複query/結果なし、写真未登録/成功/失敗/読み込み中、住所等欠損を検証。
4. Maps URLはapi=1/座標エンコード/範囲/0/欠損を単体テスト。有効リンクのtarget/rel/Enter操作と元画面維持、通常モックでdisabledをブラウザー確認。テスト座標は実店舗モックに混ぜず、テスト内の境界値入力/応答差し替えで検証する。
5. 全16ジャンルのID→名前、非ラーメンで結果→店舗投票→待機→開発結果を確認。通常待機からの偽の自動遷移なし。既存ジャンル投票16件/スワイプ/戻る、両待機演出/結果を回帰確認。
6. Docker Composeのlint/typecheck/フロントエンドテスト/build。本番で開発プレビュー404。型検査とbuildは生成型の競合防止のため順次実施。
7. 390px画像を保存しFigmaと比較。git diffで禁止領域・共通UI・既存演出・投票ロジック無変更を確認。実機/インストール/支援技術は未検証と区別。

## 未決定事項

今回の表示実装に必要な未決定事項なし。実集計/同票/本人識別/取得API/同期/正式な結果通知・遷移/PWA全体設定は対象外として保留。

## 初回実装時のProgress（履歴）

- 完了：資料/現行コード/mainマージ調査・fast-forward、Google公式仕様/Context7確認、変更方針説明、仕様自己レビュー。
- 完了：静的結果/マップURL/固定領域/プレビュー/ジャンル境界/開発導線の実装。
- 補助検証：同梱Nodeと既存依存関係でlint（既存ホーム画面Plus未使用の警告1件・エラー0）、typecheck、新規8＋既存24の32テスト成功。本番buildはsandboxのGoogle Fonts接続制限で初回失敗後、設定を変更せずネットワーク利用可能な環境で再実行して成功。
- 静的SSR検証：実TSXのSSR/ビルド済み共通CSS/専用CSSを使った表示で指定7幅、アニメーション0、下部固定、320px文字200%・末尾の非重複を確認。有効座標はテスト専用の境界値入力でMapsリンクの実コンポーネントSSR、target/rel/Enterによる別タブ・元画面維持を確認。外部遷移はテスト応答に差し替え、架空店舗へ座標を設定しない。
- 残作業：Docker Compose検証と水和後の実Next画面でのResizeObserver/画面遷移/画像状態/既存画面回帰・390px画像比較。静的SSR画像と実際のNext画面の検証を混同しない。
- Blockers: Docker Desktop Linux Engineのcontainers APIが500（v1.51）を返し、localhost:3000も未起動。ユーザーはDocker復旧を選択。一時フロントエンドサーバーを勝手に起動しない。
- 関連PR/コミット：基点0b718b6。今回コミット/プッシュ/PR作成なし。

補助検証の結果・静的SSR画像はGit対象外の`C:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/`に保存。`verify-final-map-component.cjs`、`verify-final-static.cjs`、`restaurant-result-static-results.json`、`restaurant-result-static-390.png`。復旧後の実Next検証スクリプトは`verify-restaurant-result.cjs`。

### 作成・変更ファイル

- 新規：`frontend/src/app/restaurant-result/page.tsx`、`frontend/src/app/ui-preview/restaurant-result/page.tsx`。
- 新規feature：`frontend/src/features/restaurant-result/`のresult-data.ts、maps-url.ts、prototype-data.ts、result-photo.tsx、result-map-action.tsx、restaurant-result-screen.tsx、restaurant-result-preview.tsx、restaurant-result.module.css、restaurant-result.test.mjs、README.md。
- 新規：`frontend/src/features/restaurant-vote-waiting/restaurant-waiting-preview.module.css`、本仕様。
- 既存変更：`frontend/src/features/restaurant-vote/route-data.ts`、restaurant-data.ts、restaurant-vote.test.mjs、restaurant-vote-preview.tsx、`frontend/src/app/restaurant-vote/page.tsx`、`frontend/src/features/restaurant-vote-waiting/restaurant-vote-waiting-preview.tsx`、`frontend/src/app/ui-preview/restaurant-vote-waiting/page.tsx`、`frontend/package.json`（テストscriptのみ）、既存の店舗投票/待機仕様2件。
- Git差分確認：backend/DB/Docker/.env/lockfile/Next設定/共通UI/globals/layout/PWA/既存ジャンル全feature/店舗投票ロジック・CSS・通常待機に差分なし。新規依存/コミット/プッシュ/PRなし。

### Figma・既存仕様との差と採用判断

1. 画像12の98%は定義がないため、入力された支持人数の3/3表示へ置換。モック内訳は実集計でない旨を表示。
2. 写真・住所・座標は共有モックに未登録。画像はプレースホルダー、住所は未取得、マップは無効。架空の実店舗/地理情報を補完しない。
3. Figmaの固定写真高205pxは幅に追従する7:4へ変更。本文の8〜10pxの情報文字は読みやすさと文字拡大を考慮して11〜12pxを基準にする。通常縦スクロールで全内容へ到達できる。
4. 共通テーマのBottomAction通常フローと異なり、ユーザーの明示要件に合わせ画面専用ラッパーのみfixed。共通部品の契約を変更しない。
5. 店舗投票の従来の暗黙ラーメンと結果未実装という旧記録は、本書と既存仕様の追加節で更新。ジャンル未取得を別データに補完せず、通常待機の自動遷移は引き続き追加しない。

## 初回実装時のSelf-Review（履歴）

- Score: 96/100
- Review date: 2026-10-30
- Reasons for deductions: 実機の安全領域・OSのGoogleマップへの引継ぎ・支援技術の最終確認はブラウザーだけで保証できない（4点）。
- Revisions made: 暗黙のラーメン補完撤去、静的写真/共有Buttonの動き停止、住所/座標欠損、ID照合、票数と参加者完了数の分離、開発限定の明示遷移を規定。
