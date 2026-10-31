# 画面03・既存APIによるルーム待機と招待

- Status: Implemented
- Last updated: 2026-10-31
- Related issue: None
- Related specifications: room-create-screen.md, qr-scan-screen.md, ../services/room-lifecycle.md, ../models/rooms-and-participants.md, ../components/common-ui.md, ../themes/design-system.md
- Implementation files: frontend/src/app/room-waiting/page.tsx, frontend/src/app/j/[joinCode]/page.tsx, frontend/src/app/genre-vote/page.tsx, frontend/src/features/room/{room-data.ts,room-api.ts,room-session.ts,use-room-state.ts,room-waiting-screen.tsx,room-join-screen.tsx,invite-card.tsx,room-fixed-action.tsx,room-genre-entry.tsx,room-waiting.module.css,room-data.test.mjs}, frontend/src/features/room-create/{room-create-screen.tsx,room-create.module.css}, frontend/package.json, frontend/package-lock.json

## 目的・範囲

画面03（03-host-waiting.png）を実装し、既存のルーム作成/参加/状態取得/開始APIを接続する。実ルームのjoinCodeから端末内でQR/招待URLを作り、別ブラウザーから参加してホスト一覧に反映できることを確認する。画面05の参加フォームと参加後の同一待機画面を必要最小限の接続として含める。

## 対象外

バックエンド/DB/マイグレーション/API仕様/Docker/既存環境変数/PWA/共通UI本体/既存の投票・集計・他画面の演出、トンネル作成/公開設定変更、コミット/プッシュ/PR。画面04のカメラ読み取りの本実装も含めず、スマートフォン標準カメラ等でQRのURLを開く。投票保存APIへの接続は含めない。

## 前提・Git・資料調査

- 開始時はfeature/room-waiting-invite、HEAD d47e836、未コミット変更なし。取得したorigin/mainはffb437eで、前提と異なりジャンル改善PR #14は既にマージ済み（QR画面PR #15もマージ済み）。ブランチをff-onlyで最新mainへ追従。ユーザーの変更を移動/破棄せず、新規コミットも作らない。
- AGENTS.md、サービス/モデル/画面02/04/共通UI/テーマ仕様、Figma03/05/06と参照TSX/CSS、Goルート/Handler/Service/Domain/Repository、OpenAPI、Next APIリライトを確認する。画面03/05/06の既存Nextルートと画面03専用仕様は存在しない。
- 画面02の作成ボタンはAPI未接続。ニックネーム/集合場所必須・12文字上限を維持する。現在地ボタン/集合場所検索は未実装のまま。APIへはnicknameだけを送り、集合場所/範囲はホスト端末にだけ保持する案とし、未同期である旨を明記する。
- 画面04はカメラ不可状態への切替だけ。参照Figmaは招待先/j/2481と/j/からの参加判定を持つが、Nextルートは未実装。招待URLの新規構造はユーザー決定が必要。

## API調査結果（変更しない）

ベースは既存Nextリライトの同一オリジン/api/v1。Request/Responseはdocs/api/openapi.yamlとGo実装を照合。成功はdata、失敗はerror:{code,message,requestId}。

| 機能 | 実装 | 入力 | 出力/HTTP |
| --- | --- | --- | --- |
| 作成 | POST /rooms | {nickname:string}、認証なし | 201 {room,participant,sessionToken} |
| 参加 | POST /rooms/{joinCode}/participants | {nickname:string}、認証なし | 201 同上、role=member |
| 状態/参加者取得 | GET /rooms/{roomId} | Bearer token | 200 {room,currentParticipantId,participants} |
| 開始 | POST /rooms/{roomId}/genre-voting/start | Bearer token、bodyなし | 200 状態取得と同形。hostかつ2人以上。開始済みの再送は冪等 |

- room={id:UUID,joinCode:8文字,status,version,expiresAt}、participant={id:UUID,nickname,role:host|member}。参加コードは23456789ABCDEFGHJKMNPQRSTVWXYZから8文字。期限24時間、上限20人、ニックネームはtrim後1〜20 Unicode文字・制御文字不可。UIの12文字制限は既存のより狭い範囲であり、バックエンドを変更しない。
- セッショントークンは作成/参加の初回だけ返る。招待コードとは別で、URL/QR/ログに含めない。DBの平文保存はない。
- 400 INVALID_REQUEST、401 UNAUTHORIZED、403 FORBIDDEN/HOST_REQUIRED、404 ROOM_NOT_FOUND（期限切れも同じ）、409 ROOM_NOT_JOINABLE/ROOM_CAPACITY_REACHED/NOT_ENOUGH_PARTICIPANTS/INVALID_ROOM_TRANSITION、500 INTERNAL_ERROR/ROOM_CODE_GENERATION_FAILED、503 SERVICE_UNAVAILABLE。
- 参加者情報にオンライン/準備完了等のフィールドはなく、その更新APIもない。WebSocket/SSEもない。サービス仕様はGETによる状態更新を想定し、取得間隔をフロント側責務としている。
- 未実装：集合場所/検索範囲の保存、未参加者向けの招待先ホスト名/場所/人数取得、招待URLそのものの発行、招待更新/トークン再発行、オンライン状態の更新。前者の表示を架空情報で補わない。
- OpenAPIと実装のURL形状/データ契約は一致。開始APIのパス変数名はOpenAPI roomId/Go roomRefと異なるが、サービスはUUIDとして扱うため、送る値はroom.id。サービス仕様のjoinCode表記とOpenAPI roomRef表記も同じ参加コードを指す。API仕様書は編集しない。
- compose.yamlはfrontend→backend:8080の既存リライト、frontendの公開は127.0.0.1:3000。公開ベースURLの設定はなく、DEV_ALLOWED_ORIGINは開発アクセス許可であり正規URL設定ではない。tunnelは明示profile。今回は起動/設定変更しない。

## 承認済みの実装案

2026-10-31にユーザーが「この仕様案で進める（推奨）」と回答したため、以下を承認済みの現行契約とする。

1. 招待先はFigmaの既存表現に合わせて/j/{joinCode}。待機は/room-waiting?room={UUID}の1ルートとし、APIのroleによりホスト/ゲストを出し分ける。URLにセッショントークンを入れない。
2. QR生成には既存依存で代替できないためqrcode.react@4.2.0を1パッケージ追加する。React/SVGベースで外部サービスへ送信せず、型定義込み。QRCodeSVGを192px（通常表示領域200px）・静かな余白4モジュール・誤り訂正Hで使用する。既存アプリアイコンの22px中央マークを含めたQR画像をローカルでデコードし、URL一致を確認して採用する。
3. 参加情報はsessionStorageへルーム単位で保持し、同一タブの再読み込みでGET検証して復元する。ホストの集合場所/範囲は端末内だけ保持し、APIには未同期であることを表示する。
4. 開始API成功後は既存/genre-voteへroomIdを渡して遷移し、入口で認証済みルームのjoinCodeをヘッダーへ渡す。既存の投票処理・保存未接続状態・演出は変更しない。実接続は開始APIまでであると最終報告で区別する。

## 画面構成・表示・操作

- AppHeaderのロゴ/Room #joinCode、StepProgress currentStep=roomを利用する。Room番号は架空の4桁にせずAPIの参加コード8文字を表示する。
- 緑の「参加者を待っています」バッジ、中央「友達を招待しよう」、補助文「QRコードかリンクをシェアしてください。」。
- 白い角丸カードに実QR、拡大ボタン、招待URLとコピー。Figmaの飾りQRを読取可能なQRへ置換する。拡大はキーボード/閉じる/Escapeに対応したモーダル。外部URLへ招待情報を送信しない。
- URLは現在ブラウザーで開いたhttp(s)のlocation.originを使い、joinCodeを安全にエンコードして同じ値をQRとコピーへ渡す。架空ドメインを作らない。localhost等では「同じPCでの確認用。別端末へ共有するには公開URLから開く」旨を表示し、外部共有できると案内しない。公開URL/別端末は今回は未検証と区別する。
- コピーはユーザー操作でClipboard APIを呼び、成功/失敗をrole=status/alertで通知。失敗時はURLを選択/手動コピーできる。Figmaにない共有ボタンを追加せず、コピーしたURLをLINE等へ貼れるようにする。
- 参加メンバー/実人数、参加者行はParticipantAvatarを再利用。名前はAPIの実値、role=hostのみホストバッジ。緑点は「参加済み」を示し「オンライン」とは呼ばない。長い名前/20人は通常縦スクロール。
- BottomAction+Buttonで主要操作を画面下に固定。最大430px/左右22px/safe-area、実測した固定領域の高さを本文下余白へ反映し、200%文字/短い高さでも本文を隠さない。
- host/lobby/通信正常/2人以上で「投票を開始する」。1人ならdisabledと理由、memberは開始ボタンを表示せず待機メッセージ。POSTの成功応答前に開始成功/遷移にしない。連打はrefで抑止し、失敗時はAPIエラーを表示して再試行できる。

## 参加フォーム・状態・永続化

- /j/のコードを形式検証し、正規化したコードを表示。未参加者はGET不可なのでFigmaの固定「ゆうきさん/渋谷駅」等を表示しない。ニックネームのみ入力して参加POSTへ渡す。既存UIに合わせて1〜12文字の許容範囲とする。
- 参加APIの201を確認してからmemberセッションを保存し、同じroomIdの待機画面へ移動。連打防止・処理中・API失敗・通信失敗を扱う。ニックネームが同じ別人はAPI上許可され、名前だけで二重参加を判定しない。
- 同一ブラウザーに該当ルームの有効セッションがあれば参加POSTを再送せず、GETで検証して待機へ戻る。別ブラウザー/別端末は独立したトークンで参加する。参加POSTのレスポンス喪失時に自動再送しない（APIに参加冪等キー/本人復旧がないため）。
- sessionStorageに保存できない場合は作成/参加前にエラーにする。保存可能か事前確認する。成功後に保存が失敗した場合は得たセッションをそのタブのメモリで保持し、再読み込みで復元できない旨を通知する。トークンをコンソール/URL/画面へ出さない。
- 待機表示はGETで現在参加者とroomIdを検証した実データを使用。初期取得完了前にQRや架空参加者を表示しない。再読み込みは保存セッションからGETする。欠損セッション/別ルーム/期限切れは適切なエラー表示と作成/参加への導線。
- GET更新は既存APIのポーリングで2秒。前回完了後に次を予約し重複させず、非表示タブでは定期取得を停止、表示/フォーカス/オンライン復帰時に再取得する。初期のセッション検証と明示的再取得は非表示でも一度実行できる。リクエスト上限10秒、AbortControllerでアンマウント/非表示への切替時にキャンセル。versionが同じなら不要な一覧更新をしない。認証情報とroomId/joinCode/現在参加者IDが一致する応答だけを表示する。
- 作成/参加POSTは自動再送しない。通信失敗/タイムアウト/不正応答では処理結果が不明なことと再送時の重複の可能性を伝える。GETの不正JSONも通信失敗と混同せず、不正応答として扱う。
- 401/403/404では有効なルームとして扱わずQRと開始操作を停止。通信/5xxでは最後の取得情報と更新失敗を区別し、開始操作を停止して再試行を案内。参加人数の増減/状態をaria-liveで通知する。

## 検証方法・受け入れ条件

1. 既存Docker Composeでヘルスチェックと4 APIを確認。テスト用ルーム/ニックネームだけでローカルに作成/参加し、同じroom.id・joinCodeと異なるparticipant.idを検証。トークンを検証ログへ出さない。
2. 実ブラウザーのホスト作成→URL取得/QRデコード値一致→別コンテキストで参加→ホストの人数更新→ゲストに開始ボタンなし→ホスト開始成功とゲスト更新を確認。
3. コピー成功/拒否、sessionStorage再読込、同一招待への再訪問で参加POST重複なし、無効コード/不存在/期限切れ相当/認証/409/503/通信失敗/不正レスポンスを自動テストとブラウザー応答差し替えで確認。実APIとモック応答を記録で区別する。
4. 320/375/390/430/768/1024px、横844×390、390×320、文字200%、20人/長い名前/長いURL。横スクロールなし、QR正方形/余白/読取、本文末尾と固定ボタンの非重複、キーボード/フォーカス/モーダルを確認。390px画像を保存しFigmaと比較する。
5. Docker lint/typecheck/全フロントテスト/build、既存画面回帰、Git差分で禁止領域無変更。実機/別端末/公開URL未確認は未検証と明記する。トンネルを勝手に起動しない。

## 未決定事項

- 今回の実装に必要な未決定事項なし。ルート・QR依存・保存・接続案はユーザー承認済み。
- 別作業：集合場所保存/未参加者向けルーム概要/オンライン状態/参加リトライ復旧を追加するかはバックエンド担当者へ確認。今回APIや業務仕様を追加しない。

## 資料・既存コードとの差異

- 画面02仕様の「作成未実装」とroom-create-screen.tsxのログのみの処理は、今回の承認に沿って実API接続へ更新した。README冒頭の「ルームは今後実装」も現状に合わせた。
- Figma03は4桁のサンプル番号・装飾QR・固定参加者。既存Go/OpenAPIは8文字joinCodeと実参加者を返すため、実値と読み取り可能なQRに置換した。Figma05のホスト名/集合場所等は未参加者には取得できないため表示しない。既存共通ParticipantAvatarが名前から作るイニシャルを使用する。
- 画面02の入力上限12文字とGo/APIの上限20 Unicode文字は異なる。UIは既存12文字制限を維持し、受信データはAPIの20文字まで受け付ける。
- OpenAPIのroomId/roomRef、GoのroomRef、サービス仕様のjoinCodeというパス変数名の違いは前述のとおり。送る識別子の意味は一致している。
- READMEの既存Git手順はmain起点/feat/*/main宛てPRだが、AGENTS.mdはdev起点/feature/*/dev宛てPR。本作業はユーザーの最新main起点・feature/room-waiting-invite指定を優先した。Git手順自体の統一は今回の対象外で、コミット/PRは作らない。
- 既存PWA manifestはscope=/genre-voteであり、今回のroom-waiting/jはscope外。通常ブラウザーの動作とは区別し、manifest/Service Workerは依頼どおり変更しない。PWA全体のscope拡張は別作業。

## Progress

- 完了：Git/関連資料/4 APIのソースとOpenAPI調査、Figma確認、既存依存とルーティング確認、最新mainへ安全な追従。
- 完了：Context7でqrcode.reactの端末内SVG生成/余白/訂正レベル/中央画像を確認。既存のReact/Nextの仕組みを使用し、QR以外の依存を追加しない案。
- 完了：Docker Desktopを起動し、既存frontend/backend/dbがhealthy。設定は変更せず、トンネルも起動しない。
- 完了：ローカルの実APIで作成201/参加201/一覧2人/ホスト開始200/開始再送のversion不変を検証。1人開始409、ゲスト開始403、認証なし401、開始後参加409も確認。トークンを出力せず、Git対象外にroom-invite-api-audit.jsonを保存。
- 完了：ユーザーが仕様案を承認。
- 完了：画面03・参加フォーム・作成API接続・sessionStorage復元・ルーム単位のセッション検証・GET更新・ホスト開始・ジャンル投票入口の接続を実装。共通UI本体と既存投票処理は再実装していない。
- 完了：ローカルの実APIを使用したEdge/Chromiumの独立した3ブラウザーコンテキストで、ホスト作成→ゲスト2人の同じroom.idへの参加→一覧3人→ホスト開始→ゲストの開始検知→実joinCode付きジャンル投票を確認。ゲストは開始ボタンなし。再読み込み復元・招待への再訪問で参加POSTが重複しないことを確認。開始後の参加409も実APIで確認。
- 完了：コピー成功/クリップボード内容一致・拒否通知、QR拡大/Escapeを確認。保存した200px QR画像をQA用jsQRで端末内デコードし、招待URLと完全一致。認証トークンの外部送信なし。QAデコーダーはコンテナの/tmp内だけに置き、プロジェクト依存は増やしていない。
- 完了：実APIの20人/長い名前で320/375/390/430/768/1024px、844×390、390×320を検証。全幅でdocument.scrollWidth=viewport幅、QRは200px正方形。固定領域の実測後、最終参加者の下端がボタン領域より24px以上上に到達できる。390px文字200%（実際の計算済み文字サイズを2倍）でも同条件を確認。長いURLはレイアウト確認用の文字差し替えで検証し、公開URLでの成功とは扱わない。
- 完了：実APIの401/不存在招待404、モック応答の503→実GET復旧、期限切れ相当404、不正構造/JSON、通信失敗、取得中、ストレージ事前拒否をブラウザーで確認。取得前/無効セッションではQRを表示しない。通信失敗時は最後の一覧と更新失敗を併記し、開始を停止する。
- 完了：作成/参加ボタンへの同時連続clickでPOSTが各1件だけ発生。作成後のストレージ保存だけを拒否し、メモリで待機可能・警告表示・再読み込み後はセッションなしのエラーになることを確認。作成503では待機へ進まずQRも表示しない。参加フォームも指定幅/横向き/短い高さ/文字200%で横スクロールなし、キーボードEnterで実参加できる。
- 完了：/home-preview、/genre-vote、/genre-vote-waiting、/genre-result、/restaurant-vote、/restaurant-vote-waiting、/restaurant-result、/qr-scan、/ui-previewが200・横スクロールなし。既存ジャンル投票のボタン投票と戻る操作を確認。
- 完了：Docker Composeでlint、typecheck、全フロントテスト51件（新規8件）、本番build、backend go test ./...、go vet ./...が成功。既存NodeのMODULE_TYPELESS_PACKAGE_JSON警告は失敗ではなく、無関係なpackage全体のmodule設定を変更していない。npm audit --omit=devは0件（開発依存の既存16 moderateは対象外として更新しない）。
- 記録：Git対象外のCodex検証領域にroom-invite-api-audit.json、room-invite-flow-results.json、room-invite-layout-results.json、room-invite-error-results.jsonと390px画面を保存。トークンはログ/ファイルへ記録しない。ローカル検証用ルームは通常の24時間期限で失効する。
- 未検証：実機でのカメラ読取/別端末/公開URL/インストールPWA。トンネルは起動せず、公開設定も変更していない。仕様のローカル受け入れは確認済みだが実機確認を残すためStatusはImplementedとする。
- 差分確認：フロントエンドと画面仕様/READMEのみ。バックエンド/DB定義/API仕様/Docker/環境変数/PWA/共通UI本体に変更なし。
- Blockers: None
- 関連PR/コミット：今回作成なし。

## Self-Review

- Score: 96/100
- Review date: 2026-10-31
- Reasons for deductions: 実機と公開オリジン/別端末の検証は追加環境を要する（4点）。
- Revisions made: 未実装APIで架空情報を補わず、同一ルーム/秘密情報/更新失敗/参加POSTの非冪等性/既存プロトタイプとの境界を明示した。
