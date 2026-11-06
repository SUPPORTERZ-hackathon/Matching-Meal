# S-04 招待QRコードの読み取り

- Status: Implemented
- Last updated: 2026-11-06
- Related issue: None
- Related specifications: room-join-screen.md, room-waiting-invite.md, frontend-ui-integration.md, ../providers/pwa.md
- Implementation files: frontend/src/features/qr-scan/, frontend/src/app/qr-scan/page.tsx, frontend/package.json, frontend/package-lock.json

## 目的・承認・範囲

2026-11-06の正式実装依頼を承認根拠とする。既存S-04のヘッダー・枠・色・余白を維持し、ユーザー操作でカメラを起動して端末内で招待QRを解析し、既存の/j/{joinCode}へ渡す。仮の許可切替・準備中表示の旧仕様を置き換える。

## 前提と調査

- fix/frontend-location-and-flow、HEAD f675b06、作業ツリーはクリーン。現在地/復帰/冪等キー/再検索/PWAの既存コミットを保持する。
- 現行S-04は準備中表示だけ。QRCodeSVGは生成専用。既存QRは現在originの絶対URL/j/{8文字コード}、訂正H・余白4・中央22pxロゴ。生成方式・参加API・セッションは変更しない。
- 標準BarcodeDetectorは対応範囲が限定される。jsQR 1.4.0は依存なしだが最終リリースは2021-04。@zxing/browser 0.2.1（2026-07）はコアを利用するブラウザーラッパー。今回は独自UIと解放制御に必要な@zxing/library 0.23.0だけを固定追加し、QR専用QRCodeReaderを使用する。Reactへのpeer依存なし、Node >=24は既存Docker node:24と一致。推移依存ts-custom-errorとoptionalの@zxing/text-encodingを含み、直接依存1件・導入パッケージ計3件。
- Context7のZXing公式資料とnpm公式メタデータ、MDNのgetUserMedia/BarcodeDetectorを確認。カメラ・CanvasはClient Componentからのみ利用する。

## 対象外

バックエンド/DB/マイグレーション/Docker設定/環境変数/API契約・通信/参加登録の自動実行/投票/現在地/PWA設定/認証永続化/画像アップロード解析/公開・トンネル作成/コミット/プッシュ/PR。既存共通UI本体を変更しない。

## 招待情報の入力と検証

- カメラ解析結果と手入力の招待URLに同じ純粋関数を使う。最大2048文字、外側の空白だけtrim、制御文字やバックスラッシュは拒否する。
- http(s)の絶対URLで、現在のwindow.location.originと厳密に同じorigin（scheme/host/port）を要求する。credentials/query/hashなし、パスは/j/{code}（末尾スラッシュ1つは許容）だけ。codeは既存normalizeJoinCodeで検証・大文字正規化し、/j/{正規化code}という相対パスだけをrouterへ渡す。URL文字列をHTML/スクリプトとして実行しない。
- 外部ホスト、紛らわしいドメイン、JavaScript/data/protocol-relative URL、不正コード・余分なパスは拒否。*.trycloudflare.com等のワイルドカード許可は作らない。
- ホストとゲストは同じ公開originから開く。localhost QRを公開originのスキャナーへ持ち込んだ場合は拒否し、同じ公開URLでQRを再表示するよう案内する。別originの正規アプリを推測しない。新規allowlist/環境変数は不要。
- 読み取り成功は招待形式の検証であり、ルームの存在・参加成功を意味しない。既存参加画面のニックネーム入力/セッション確認/参加API/進行済み復帰/期限切れ等のエラーをそのまま使う。
- S-04は参加POSTやルーム確認APIを呼ばない。QR内容・映像・deviceIdをログ/ストレージ/URLパラメータへ保存しない。

## カメラと解析の状態・遷移

idle→starting→scanning→success→参加画面。失敗はerror、明示停止はidle、非表示/pagehideはpaused。再開・再試行はユーザー操作のみ。starting中でも中止/戻る/URL貼り付けを使える。

- 音声false、背面ideal/environment、解像度ideal 1280×720。ideal指定のため背面がなくても利用可能なカメラを使える。OverconstrainedErrorだけは制約を外して1回取得。拒否・ビジー等で無条件再要求しない。
- 許可後のenumerateDevicesで複数カメラを確認できる場合だけ切替ボタンを出す。現在deviceIdとは別のカメラへ切替え、旧ストリームを停止してから新しく取得する。切替先が消えてNotFound/Overconstrainedになった場合は標準カメラへ1回フォールバックする。
- カメラ起動の同時実行をロックする。getUserMediaの許可待ちはAbortできないため、停止時に世代番号を無効化し、後着のstreamは即全track.stopする。前の許可待ちが未決着なら新しい起動を増やさず、その旨を表示する。
- videoはmuted/playsInline/autoPlay。読み取り中は既存の暗い枠内にobject-fit:coverで表示し、中央のガイドは装飾にする。開始前/エラー時は既存のCameraアイコン・説明・主ボタンを表示する。
- 解析コアは起動時に遅延import。video.play成功後にCanvasへ中央正方形を最大640pxで取得し、RGBA→輝度→QR専用デコード。試行後250ms間隔、処理を並列にしない。見つからない/訂正・形式失敗は通常の未検出として案内を維持し、致命的失敗は停止してエラーとする。
- 任意のQRが検出されたら一旦停止し、招待情報を検証する。不正ならエラー・再試行、正しければ一度だけ遷移する。同じQRの後着結果や連続イベントでは遷移を増やさない。
- 停止/成功/エラー/切替/戻る/コンポーネント破棄/visibilitychange(hidden)/pagehideで、予約タイマー取消、trackイベント解除、全track.stop、video.pause/srcObject=null、Canvas破棄を行う。dispose後の非同期応答はUIへ反映しない。track endedも停止・再試行案内にする。

## エラー・代替導線

- insecure context：HTTPS、またはその端末自身のlocalhostが必要。LAN HTTPではカメラを使えると案内しない。
- 非対応：mediaDevices/getUserMedia未提供。招待URLからの参加を案内。
- NotAllowedError/SecurityError：許可拒否。ブラウザー/OSの権限確認を案内し、設定は変更しない。
- NotFoundError：カメラなし。NotReadableError/AbortError：他アプリの使用や接続状況を確認。OverconstrainedError：フォールバック後も失敗なら別カメラ/再試行を案内。
- 映像再生・解析ロード・致命的解析エラー：停止後に再試行可能とする。生の例外・QR内容を表示しない。
- QR未検出：明るい場所、枠内、距離を調整する案内。未検出を毎フレームalertしない。
- URL不正：「メシマッチの招待QRコードではありません。」。別origin：「同じ公開URLで発行した招待を使用」する案内。
- 小さな折りたたみ領域「招待URLから参加する」に入力欄1つ・参加画面へ進むボタンを置く。開くとカメラを停止し、同じ検証で遷移する。標準カメラや共有URLから直接/j/へ進む導線も維持する。画像ファイル解析は追加しない。

## UI・アクセシビリティ・レスポンシブ

AppHeader/PageContainer/Button・フォント・背景・角丸を再利用。初期ボタンは「カメラを起動する」、起動中は処理中/中止、読取中は停止/可能なら切替、停止後は再開、エラー後は再試行。停止・切替は44px以上の操作領域で折り返せる。映像上のガイドはaria-hidden、状態はrole=status、エラーはrole=alert、videoには用途のラベルを付ける。

既存の暗い枠と縦スクロールを維持し、稼働中の映像は正方形。必要な状態文は縮小せず折り返す。320/375/390/430/768/1024px、横向き・短い画面でボタンを隠さない。safe-areaを既存方針から継承し、読み取りのためにbodyのスクロールを止めない。新しい点滅/スキャンアニメーションは追加しない。

## PWAと実行条件

manifest/start_url/scope/アイコン/SWは変更しない。HTTPSまたはlocalhostでカメラAPIを利用する。PWAでも同じClient処理を使い、バックグラウンドへ移れば停止、復帰後は手動再開。公開originのCloudflare Tunnel等を使う場合も設定・起動を勝手に変更しない。実機iOS/Android/standalone/許可ダイアログを未検証の場合は区別して報告する。

## 受け入れ条件・検証方法

1. URL検証で正規/大小文字/末尾slash、別origin・port・protocol、credentials、query/hash、制御文字、エンコード/不正コード、巨大入力をテストする。外部URLへ進まず参加API未呼出しを確認。
2. fake media/video/decoder/timerで開始・停止・連打・拒否/機器なし/ビジー・フォールバック・切替・track ended・遅延許可後の停止・dispose・非表示相当・連続検出を検証する。
3. qrcode.reactのSVG生成（既存の訂正H/余白4/ロゴ掘り抜き）をsharpで端末内RGBA化し、実ZXingデコーダーで招待URL一致を検証する。これは光学カメラの実機検証とは区別する。
4. Dockerでlint/typecheck/既存・追加テスト/build、git diff --check。既存API書込を伴う結合テストは隔離環境がなければ実行しない。
5. ブラウザーで表示・代替URL入力・不正URL・参加画面遷移・レスポンシブを確認。カメラ許可を勝手に承認せず、実機で確認できない条件は未検証とする。
6. Git差分でバックエンド/DB/Docker/環境変数/PWA/投票/現在地/参加API処理に変更がないことを確認する。

## 未決定事項

今回のフロント実装に必要な未決定事項なし。実端末のカメラ選択・読み取り速度・PWAの権限挙動、公開HTTPS、既存API用HMAC鍵設定などは実機/環境で別途確認する。

## スマートフォン2台の実機確認手順

1. 担当者が同じアプリ/APIへ到達できるHTTPS公開URLと既存APIのHMAC設定を用意する。今回の作業では公開・設定変更をしていない。localhost QRを別端末へ共有しない。
2. 端末Aで公開URLのホームを開き、名前と現在地・検索範囲を入力して実ルームを作成する。作成成功後の待機画面でQRを表示し、必要なら拡大する。
3. 端末Bも同じ公開URLから「QRコードから参加する」を開き、「カメラを起動する」を押す。利用者自身がカメラの許可を承認する。背面カメラでAのQRを枠内へ入れる。
4. Bの映像が停止し、/j/実joinCodeへ移動して名前欄が1つだけ表示されることを確認。ここまでは参加登録ではない。
5. Bの名前を入力して「参加する」を押し、実APIの成功後にゲスト待機へ進み、Aの参加者一覧・人数が更新されることを確認。再読み込み・招待再訪で同じ参加情報へ復帰することも確認する。
6. 停止・ホームへ戻る・バックグラウンド・カメラ切替・許可拒否と再試行を試し、不要なカメラ使用表示が続かないことを確認。無関係なQRで外部へ移動せず、日本語エラーになることも確認。
7. カメラが使えない場合は、同じ公開originの招待URLを代替欄へ貼り付け、同じ参加フォームに進めることを確認する。
8. Android Chrome/iPhone Safariと、ホーム画面から開いたPWAで繰り返す。ブラウザーとPWAが同じsessionStorageを共有するとは想定せず、実際に参加したコンテキストで復帰を確認する。

## Progress

- 完了：Git/既存UI・QR生成・参加ルート/API・PWA・依存と最新公式情報を確認。Docker Desktopを起動。Compose startは依存サービスも起動したが、migrateはno changeで終了し、設定やDB定義は変更していない。
- 完了：既存UI内のvideo/起動・停止・中止・再開・切替、端末内QR解析、同一origin検証、URL貼り付け、全停止条件、遅延許可の破棄を実装。旧準備中表示を置換し、関連UI統合仕様に本書への参照を追加。画像ファイル解析は対象外のまま。
- コード検証：Docker Composeでlint/typecheck/buildが成功。既存と追加の全130テスト中126成功、失敗0、実API結合4件skip。QR単独15テスト成功。既存のMODULE_TYPELESS_PACKAGE_JSON警告あり。git diff --check成功。
- 自動テスト：URLのorigin/形式、拒否・機器なし・ビジー・制約フォールバック、連打、切替先の消失、停止・非表示相当・track ended・dispose、未決着の許可と後着stream停止、連続検出、URL貼り付け、参加APIを呼ばないことをモックで確認。実ZXingで既存と同じH訂正/余白4/中央ロゴ22pxを持つ192px・320px QR画像を解析し、URL一致・空画像の未検出を確認。
- ブラウザー検証：localhostのアプリ内ブラウザーで開始中・中止・未決着中の新規起動抑止、別origin URLの拒否、同一origin URLから/j/7K9M2QXRの既存参加フォームへ到達を確認。参加POSTは押していない。カメラの許可は承認しておらず、実映像の取得・光学読み取りは未確認。起動中が継続した環境固有の要因は未特定のため、実カメラ動作成功とはしない。
- 表示検証：320/375/390/430/768/1024px、844×390px横向き、390×320px短画面で横スクロールなし。短画面で通常スクロール後に下部ホームボタンへ到達（下端約288px/高さ320px）、ヘッダー上端0を確認。動画はmuted/playsinline、共通manifestリンク1件をDOM確認。Consoleのerror/warnは確認時0件。
- HTTP確認：/qr-scanと/j/7K9M2QXRは200・共通manifest参照あり。manifestのstart_url=/home-preview・scope=/を維持。既存/api/healthのstatus/databaseともok（GETのみ）。Git差分でPWA設定・共通UI・既存QR生成/コピー・参加/セッション/API・現在地・投票に変更なし。
- 確認画像：初期画面390pxをGit管理外のC:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/qr-scan-390-20261106.jpgへ保存。カメラ映像のスクリーンショットではない。
- 未検証：Android/iPhoneの実カメラ・実際の許可拒否/切替・OSのカメラ使用表示、実機PWA・公開HTTPS/Tunnel、2台の実ルーム作成・参加・セッション復帰、live videoの実機レスポンシブ・性能。実機未検証のためStatusはVerifiedにしない。
- 接続の残件：稼働backendのROOM_IDEMPOTENCY_HMAC_KEYは未設定（有無のみ確認、値取得なし）。既存のキー付き作成/参加APIを実機確認する前にバックエンド担当者の設定が必要。今回は環境変数を変更せず、QR形式確認を参加成功として扱わない。
- Git：開始時のHEAD f675b06と既存コミットを保持。変更はQR feature・依存/テストscript・関連フロント画面仕様に限定。バックエンド/DB定義/Docker設定/環境変数/API仕様/PWA/READMEは未変更。
- コミット/プッシュ/PR：なし。

## 参照資料

- Context7: ZXing JS Browser /zxing-js/browser、ZXing JS /zxing-js/library の公式資料。
- [ZXingコア](https://github.com/zxing-js/library)・[ブラウザーラッパー](https://github.com/zxing-js/browser)・[jsQR](https://github.com/cozmo/jsQR)
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)・[BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)

## Self-Review

- Score: 96/100
- Review date: 2026-11-06
- Reasons for deductions: OS/ブラウザーの許可待ち・光学読み取り・実機PWAの検証が環境依存（4点）。
- Revisions made: 同一originと正規コード、未決着の許可待ち、全停止条件、解析依存1件、モックと実機の区別を具体化。
