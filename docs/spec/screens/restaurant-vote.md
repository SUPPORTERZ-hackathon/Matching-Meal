# 店舗投票画面・フロントエンドプロトタイプ

- Status: Verified
- Last updated: 2026-10-30
- Related issue: None
- Related specifications: restaurant-vote-waiting.md, genre-result.md, ../components/common-ui.md, ../themes/design-system.md
- Implementation files: frontend/src/app/restaurant-vote/, frontend/src/app/ui-preview/restaurant-vote/, frontend/src/features/restaurant-vote/, frontend/src/features/genre-result/genre-result-prototype.tsx

## 目的・承認・範囲

ユーザーの店舗投票・待機画面の実装指示を承認根拠とし、画像10に沿うボタン専用投票、架空店舗4件、表示用データ境界、ジャンル結果から待機までの操作可能なプロトタイプを実装する。本仕様はこの明示範囲を具体化する。主仕様は本書、待機固有の契約は別紙に定義する。

## 対象外

バックエンド・DB・Docker・環境変数・API仕様・PWA設定の変更、API通信、APIキー、実検索、投票送信/保存/同期/集計、店舗結果画面、ジャンルとAPIジャンルコードの対応付け。左右スワイプを実装しない。

## 前提条件・資料・差異

- `feature/restaurant-vote-waiting`の開始時は未コミット変更なし。取得した最新main `812f643`へfast-forward。ジャンル結果はPR #9でmainにマージ済み。新規コミット/共有履歴の改変はしない。
- AGENTS/README、画像10/11、Figma TSX/CSS/audit/notes、共通UI/テーマ/ジャンル投票・待機・結果仕様と実装を参照。店舗画面の既存仕様はなく、本書を作成する。
- 画像10のボタンは「見送り」「ここがいい」。意味はskip/like。戻るは画像にも既存店舗仕様にもないため今回追加しない。
- 画像の98% MATCHは算出根拠がないため表示しない。集合場所からの徒歩/距離も入力・算出根拠がないため、最寄駅/アクセス情報に置き換える。写真は未用意でプレースホルダーを正規状態とする。
- Figmaの内部スクロールを移植せず、既存PageContainerの通常縦スクロール/最大430px/安全領域を使う。共通UIとglobalsは変更しない。
- 既存ジャンル結果仕様の「店舗選定は準備中」は今回の新画面接続に限って更新する。集計ロジックは変更しない。
- AGENTSの一般的なdev起点に対し、今回はユーザーの最新main起点という明示指定を優先。READMEの「PWA未実装」という記述に対し、コードには限定scopeのmanifestが存在する。設定は変更せず、本書で限定対応/全画面未対応を区別する。
- Next.jsの非同期searchParams、ImageのunoptimizedをContext7の公式ソースで確認。外部画像の将来対応にunoptimizedを使い、Next設定は変更しない。

## URL・アクセス・画面構成

- `/restaurant-vote?genre=ramen`。genreは既存genres.tsの固定ID。省略時だけramenのモック。重複/不明なクエリは無効表示し、勝手に別ジャンルへ置換しない。
- `/ui-preview/restaurant-vote`はdevelopment限定、その他環境は404。ジャンル選択、長文/欠損/画像失敗/候補なし/不正候補、投票記録確認・再開始はプレビューだけに表示する。
- AppHeader(roomNumber=仮2481)、StepProgress(shop)、見出し「お店投票」「どのお店にする？」と現在番号/投票済み件数、店舗カード、2つの円形Button、詳細リンク、モック注記の順。
- カードは白/枠/角丸26px/既存影。写真領域は幅に比例する3:2、object-fit:cover。本文18px、ジャンルchip、店舗名22px、営業時間/定休日、アクセス・ディナー予算の小カード、アクセス原文。長文は折り返し、狭い幅や文字拡大では小カードを折り返す。
- 2操作は横並び、円形64px（狭幅58px）を基準、文字ラベル14px、間隔を均等化。本文・操作は通常フロー、下部safe-areaを確保。
- ジャンル結果の既存onFindShopsにルーターのアダプターを接続し、固定IDをqueryへ渡す。通常画面に開発ボタンは追加しない。

## 入力・出力・データ

- `RestaurantCandidate`: id/name、photoUrl?、openingHours?、closedDays?、dinnerBudget?、access?、stationName?、coordinates?（latitude/longitude）、detailUrl?、source(mock/hotpepper)。IDと表示名は独立、候補IDは一意。
- `HotPepperShopFields`は将来の変換境界で必要な部分だけを型定義。id/name、photo.pc.l→m、open/close、budget.average→name、mobile_access→access、station_name、urls.pc、lat/lngを純粋関数で変換する。API全体や取得処理をUIへ持ち込まない。Go型/API契約の追加はしない。
- 写真/詳細URLに不正なschemeや資格情報を許可しない。詳細はHTTPS・hotpepper.jp/www.hotpepper.jp・店舗パス `/strJ数字/` のみ。写真はHTTPSまたはローカル`/restaurants/`・`/genres/`パス。外部写真は将来渡されたURLのみで、今回のモックには外部写真なし。
- 4店舗はID `mock-restaurant-*`、名称にサンプル店を含め、表示用の架空情報。固定ジャンルIDから候補を作るだけで実検索/絞り込みではない。詳細URL/座標は未設定、架空URL/座標を補完しない。
- `RestaurantVote`: restaurantIdとchoice(like/skip)。状態はコンポーネントのメモリ内、再読み込みで全件リセット。待機へ個人の投票配列は渡さず、genre IDのみ引き継ぐ。待機の他参加者は独立モックで実同期ではない。

## 状態・遷移・操作

idle → exiting → entering → idle。最後はexiting → complete → `/restaurant-vote-waiting?genre=ID`へreplace。

- vote(choice)はボタンだけが呼ぶ。同期refロックと記録関数の順序/重複IDチェックを併用し、同一イベントループの連打も抑止。exiting/entering中は両ボタンdisabled。
- 退場180ms/登場220ms・opacity/scale(.985↔1)のみ、横移動なし。CSS animationEndと猶予80msのタイマーで確実に完了、アンマウント時タイマー破棄。reduced-motionはCSS停止・待ち時間0。
- カードに投票用Pointer/Touch/Mouse handlersを付けない。横ドラッグ/縦スクロールは投票を確定しない。Enter/Spaceで通常Buttonを操作でき、キーボード操作後は必要時だけ同じ操作へフォーカス復帰する。
- aria-liveで投票/次の候補を通知。件数のprogressbarはStepProgressと別。空配列を完了扱いせず、0除算を防ぐ。
- onCompleteは1回、将来API通知などへ差し替え可能。集計/全参加者完了とは区別する。

## 詳細リンク・出典・エラー

- 有効な店舗詳細URLはデータから取得し別タブ、rel=noopener noreferrer。未設定/不正ならButtonをdisabledにし「サンプル店舗のため詳細ページはありません」。架空店舗への実URLを生成しない。
- mockは「表示用の架空店舗です。写真・情報はサンプルです。」と示す。hotpepper由来の場合だけ公式クレジット、同写真URLがある場合は画像出典を表示できる部品を用意する。
- 欠損値は営業時間情報なし/定休日情報なし/ディナー予算情報なし/アクセス情報なし。文字列から徒歩時間を抽出・計算しない。予算はディナーのみ。
- 写真は読み込み完了前も同じ領域を維持、失敗時は画像を外してプレースホルダー。ほかの情報/投票は継続可能。候補なし/重複ID/空ID・空名は投票を出さず説明表示、開発プレビューで再開始できる。

## レスポンシブ・検証・受け入れ条件

1. 4件をボタンのみで投票し、skip/like/店舗ID・順序・件数を正しく記録、連打でも1件のみ、最後に待機へ直接遷移する。
2. 写真未設定/読み込み中/成功/失敗、情報欠損/長文、0件/不正候補/不明genreでレイアウトと代替表示を確認する。
3. 詳細URLの正規化/危険URL拒否、外部リンク属性、mockと正式データのクレジット分岐を検証する。
4. 320/375/390/430/699/700/1024px、横844×390、低い390×320、文字200%で横スクロールなし・通常縦スクロール・操作到達可能。マウス/タッチ/キーボード、reduced-motionをブラウザーで確認する。
5. ジャンル結果から固定IDの受け渡し、既存ジャンル投票16件/undo/スワイプ、既存待機/共通プレビューの回帰を確認する。
6. Docker Compose経由のfrontend lint/typecheck/全フロントエンドテスト/build。型検査とbuildは.next-buildの競合を防ぐため順次実施。
7. git diffで禁止ファイル変更なし。390pxの投票/待機/演出中/終了後スクリーンショットを保存する。実機はエミュレーションと区別する。

## 公式資料・PWA調査（変更しない）

- [APIフィールド](https://webservice.recruit.co.jp/doc/hotpepper/reference.html)：予算はディナー、アクセスは駅等の案内、ID/URL/写真/座標を確認。
- [クレジット](https://webservice.recruit.co.jp/doc/hotpepper/guideline.html)：正式利用時にPowered by表記と公式リンク、同写真に画像提供元を表示する。モックに提供元表記は付けない。
- 既存manifestはscope/start_url/idが`/genre-vote`、standalone。新しい`/restaurant-vote`・`/restaurant-vote-waiting`はscope外。既存結果もscope外で共通manifest参照なし。今回設定は変更せず、別作業でアプリ共通scope `/` とroot metadata参照、start_url/idの移行方針、HTTPS実機インストール/遷移を検討する。Service Worker/オフライン保証/実インストール検証は今回対象外。

## 未決定事項・将来の課題

今回のプロトタイプに必要な未決定事項なし。API連携、16ジャンルと公式ジャンルマスタの対応、検索条件/件数/順序、正式なルーム/参加者同期、集計/同票、店舗結果への遷移・PWA全体設定は別作業のまま保留。

## Progress

- 完了：既存コード/仕様/Figma/公式API・ガイドライン/Context7調査、最新mainの確認・作業ブランチ追従、変更範囲の事前説明、仕様自己レビュー、画面/型/変換/モック/状態管理/待機接続/プレビューの実装・検証。
- 残作業：今回の実装範囲なし。実機/本番API/同期/店舗結果/PWA全体設定は対象外として未対応。
- Blockers: None
- 関連PR/コミット：main基点812f643。今回コミット/プッシュ/PRなし。

## 検証記録（2026-10-30）

| 検査 | 結果 |
| --- | --- |
| Docker frontend lint | 成功（エラー0）。既存home-preview-screen.tsxの未使用Plus警告1件を検出、対象外のため変更しない |
| Docker frontend typecheck | 成功。buildとは順次実施 |
| Docker frontend tests | 新規9件＋既存ジャンル投票7/待機4/結果4、計24件成功。既存構成由来のMODULE_TYPELESS_PACKAGE_JSON警告あり。packageのmodule設定を勝手に変更しない |
| Docker frontend build | 成功。通常2ルートと開発プレビュールートを生成 |
| 本番実行 | コンテナ内の一時3100番で通常2ルート200、開発プレビュー2ルート404。終了後一時サーバー停止 |
| Edge/Playwright | 37検証群成功、pageerror 0、操作中のAPI通信0。API実通信は実装も実行もしない |
| 指定7幅 | 320/375/390/430/699/700/1024pxで両画面・ヘッダー/ステップ/カード/ボタン/参加者が範囲内、横スクロールなし |
| 横向き・低い画面・200% | 844×390/390×320で通常縦スクロールと操作到達、320px文字200%と長文でも横スクロールなし。プレースホルダーの装飾円は文字倍率でつぶれない寸法へ調整 |
| 投票 | マウスドラッグ/縦スクロールは0票、同一ループ10連打は1票。4候補の順序/like・skip/ID記録、完了後の待機とgenre=cafe引継ぎを確認 |
| キーボード/タッチ | Space・フォーカス復帰、追加確認でEnter・通常モーション時のCDPタッチ縦スクロール/誤投票なし・4件タップ後待機（genre=asian）成功。軽減設定時の横タッチは無投票、ボタンタップは投票 |
| 空/不正/欠損/長文 | 0候補/重複ID/不明・重複genreクエリは説明表示。営業時間/定休/予算/アクセス欠損は代替文字、長文も折り返し |
| 写真 | 未登録/404失敗/読み込み中/成功を確認。成功時はテスト内でローカルPNG応答へ差し替え、外部写真を取得しない。読み込み前後の領域寸法不変、失敗時画像DOMなし。遅延読み込みは領域をスクロール表示して確認 |
| 詳細URL/クレジット | 構文・偽ホスト/scheme/資格情報拒否は単体検証。架空店舗はURLなし・disabled/説明あり・HP出典なしをブラウザー確認。有効な実店舗リンクへの実クリックやAPI由来写真は今回用意しておらず未検証 |
| 状態・回帰 | 再読み込みで0票、プレビュー条件変更でリセット。ジャンル結果CTA→店舗、既存ジャンルの右スワイプ表示/投票/undo/16件完了→ジャンル待機、共通UIをブラウザー確認。最後に注記を確認し、既存結果プレビューはcafeのID確認だけで画面に留まる挙動を維持 |
| PWA配信確認 | 配信JSONのscope/start_urlはともに/genre-vote、新規店舗2画面のmanifest参照はなし。設定を変更せず、全画面対応の課題を維持 |
| 変更範囲 | git diff --check成功。backend/DB/Docker/env/API仕様/PWA/共通UI/globals/ジャンル投票ロジック/既存演出ファイルの差分なし。新規依存なし |

ブラウザー確認はWindows Edgeのエミュレーション。iOS/Android実機、実際のホームインジケーター/インストール/スクリーンリーダー音声は未検証。backendのgo test/go vetはフロントエンド限定・バックエンド無変更のため実施しない。

検証スクリプト・結果・スクリーンショットはGit対象外の`C:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/`へ保存。`verify-restaurants.cjs`、`restaurant-browser-results.json`（37群）、`verify-restaurant-touch.cjs`、`restaurant-touch-results.json`。画像はrestaurant-vote-320/390/430.png、restaurant-details-390.png、restaurant-waiting-confetti-390.png、restaurant-waiting-finished-390.png、restaurant-vote-text200.png、restaurant-waiting-text200.png。Next開発用インジケーターは製品UIではない。

### 作成・変更ファイル

- 新規画面：`frontend/src/app/restaurant-vote/page.tsx`、`restaurant-vote-waiting/page.tsx`、`ui-preview/restaurant-vote/page.tsx`、`ui-preview/restaurant-vote-waiting/page.tsx`。
- 新規店舗feature：`frontend/src/features/restaurant-vote/`のrestaurant-data.ts、prototype-data.ts、route-data.ts、vote-state.ts、vote-config.ts、use-restaurant-vote.ts、restaurant-photo.tsx、restaurant-details.tsx、restaurant-vote-screen.tsx、restaurant-vote-prototype.tsx、restaurant-vote-preview.tsx、restaurant-vote.module.css、restaurant-vote.test.mjs。
- 新規待機feature：`frontend/src/features/restaurant-vote-waiting/`のprototype-data.ts、restaurant-vote-waiting-screen.tsx、restaurant-vote-waiting-preview.tsx。
- 新規接続/説明：`frontend/src/features/genre-result/genre-result-prototype.tsx`、`frontend/public/restaurants/README.md`、本仕様とrestaurant-vote-waiting.md。
- 既存変更：`frontend/src/app/genre-result/page.tsx`、`frontend/src/features/genre-result/result-bottom-action.tsx`、`frontend/src/features/genre-vote-waiting/genre-vote-waiting-screen.tsx`、`frontend/package.json`（テストscriptのみ）、`docs/spec/screens/genre-result.md`、`genre-vote-waiting.md`。

## Self-Review

- Score: 96/100
- Review date: 2026-10-30
- Reasons for deductions: 実機の操作感・OSの安全領域/インストールを今回の自動検証だけで保証できない（4点）。
- Revisions made: Figmaの未裏付けマッチ率/距離を除外、ボタンラベルと戻るなし、URL安全性/欠損/二重投票/再読み込みを明記。
