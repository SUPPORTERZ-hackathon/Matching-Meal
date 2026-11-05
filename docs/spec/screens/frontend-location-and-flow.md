# 現在地取得・ルーム復帰・再送制御の修正

- Status: Approved
- Last updated: 2026-11-05
- Related issue: None
- Related specifications: room-create-screen.md, room-waiting-invite.md, room-join-screen.md, restaurant-voting-api-integration.md, ../services/room-request-idempotency.md
- Implementation files: frontend/src/features/room/, frontend/src/features/room-create/, frontend/src/features/restaurant-voting-api/, frontend/src/app/restaurant-{vote,vote-waiting,result}/page.tsx

## 目的・承認・範囲

2026-11-05の明示的な不具合修正依頼を承認根拠とする。既存UI・認証・投票・演出を維持し、現在地取得失敗、進行済みルームへの再アクセス、作成/参加の応答消失、店舗検索の暗黙再送に対応する。既存の画面仕様と相違する部分は本仕様を優先する。

## 対象外

バックエンド、DB、マイグレーション、API仕様書、Docker、環境変数、PWA、README、共通UI、投票・集計規則、Geocoding、OS/ブラウザー権限設定変更、依存追加、コミット/プッシュ/PR作成。既存DBに書き込む検証は行わず、隔離環境がなければ未検証とする。

## 前提・現状・差異

- 作業開始時はfix/frontend-location-and-flow、HEAD/main/origin/mainは275d132、変更なし。GitHubの未マージPR検索は0件。
- 現行の位置取得は高精度/キャッシュなし/10秒のみ。手入力欄はreadOnlyで、座標取得成功が作成条件。
- 冪等APIは任意Idempotency-Key、ASCII英数字/ハイフン/アンダースコア16〜128文字。UUID v4を使用する。同じ入力の再送は201で初回snapshotと同じトークンを返す。HMAC鍵不足はキー付き要求を503にする。キーなしへの自動退避はしない。
- 参加/待機はgenre_voting以外の進行済み状態への復帰が欠ける。店舗検索はホストの候補未準備GETから無条件でPOSTへ進む。
- 旧「検索条件は端末内だけ」「店舗API未接続」の利用者向け文言は現在の実装と異なる。

## 現在地の入力・状態・動作

- requestCurrentLocationを既存の注入可能なGeolocation引数のまま拡張する。高精度取得は15秒/maximumAge=0、timeoutまたはposition_unavailable時のみ標準モードへ1回切替え、20秒/maximumAge=60秒を使用する。最大2回、許可拒否・非対応・不正座標は再要求しない。待機時間にはブラウザーの許可待ちが別途加わり得る。
- UIは取得中と標準モード切替中をrole=statusで案内し、連打ロックを継続する。成功モードを表示し、標準モードでも精度を保証する表現は使わない。座標は有限かつ緯度±90/経度±180を検証し、0や固定値で補完しない。
- 拒否/取得不能/timeout/非対応/非secure contextを区別し、再試行とEdge/Windowsの位置情報設定確認を案内する。許可設定をアプリが変更しない。
- AbortSignalで離脱後の結果を無視し、フォールバックを停止する。ブラウザーのgetCurrentPosition自体は中止できないため、キャンセル後のコールバックは利用しない。手入力/Geocodingは追加しない。
- 現在地は画面のメモリにだけ保持し、URL/ログ/sessionStorageへ座標値を保存しない。取得後の作成API契約と範囲1〜5の対応を維持する。

## 冪等キーの入力・状態・動作

- 作成/参加のPOSTだけへIdempotency-Keyを追加し、他のAPIへは付けない。UUIDはWeb Cryptoで生成する。生成/保存不能時は送信せず、利用者へ案内する。
- 正規化済みの送信先パスと確定した本文のSHA-256にキーを紐付け、メモリとsessionStorageへ保存してからPOSTする。ストレージにはハッシュとキーだけを保存し、ニックネーム/招待コード/座標/認証トークンを複製保存しない。
- 同じ入力での通信失敗・timeout・503・不正応答からの再試行は同じキーを再利用する。同じ確定入力の並行呼出しは1つのPOST Promiseを共有する。異なる入力は別操作として新しいキーを使う。有効な成功応答の役割/ルームを検証後にキーを解放する。連打ロックと成功セッション保存は維持する。
- UIは送信中の入力変更を防ぐ。失敗後に入力を変えると新しい操作になる旨を案内する。作成途中の再読み込みでは座標を再取得する必要があり、座標値が変われば別入力になる。未確定の作成を再読み込みで自動再送しない。この制約を最終報告へ記録する。
- HMAC鍵不足の503を成功扱いにせず、管理者への確認を案内する。503だけから設定不足と断定しない。バックエンド設定は変更しない。

## ルーム復帰の状態と遷移

R3の実状態から共通の純粋関数で遷移先を求める。トークンはsessionStorageの既存セッションだけを使う。

| 状態 | 復帰先 |
| --- | --- |
| lobby | /room-waiting?room=UUID |
| genre_voting | /genre-vote?room=UUID。既存R6処理が本人提出済みなら待機へ振り分ける |
| restaurant_searching | /genre-result?room=UUID。R6の実結果を表示して既存CTAへつなぐ |
| restaurant_voting | /restaurant-vote?room=UUID。既存R10処理が本人提出済みなら待機へ振り分ける |
| decided | /restaurant-result?room=UUID。R10の確定結果が必須 |
| expired/不正ID/セッションなし/認証失敗 | 自動遷移せず既存エラー案内 |

restaurant_searchingは「候補検索前」と「検索要求中」をAPIで区別できないため、復帰先はジャンル結果とする。クライアントが検索中かどうかを推測しない。待機からはlobbyの同一URLへreplaceせず、古い情報/通信エラーでは遷移しない。参加成功・冪等再送後は現在状態を待機側で再確認する。

## 店舗候補取得・検索・エラー

- 候補GET、初回検索POST、明示再検索を別の取得理由として扱う。ホストの初回候補未準備時だけ自動検索を1回許可し、その後のtimer/focus/online/visibility復帰はGETのみ。
- ユーザーの再試行だけが再検索を許可する。再試行でもGETで候補があればPOSTしない。ゲストはPOSTしない。Strict Modeのeffect再実行でも検索開始済みの記録をuseRefで保持する。
- 検索失敗は直近エラーを保持し、通常のGETが409未準備に戻ってもエラーを無言で読み込み表示へ消さない。キャンセルで結果不明の場合も、GETで確認し、明示再試行なしにPOSTを増やさない。
- cleanup後の応答はUIへ反映しない。abort、timer、listenerを解除し、再試行キューを通常取得より優先しても並列検索しない。既存の投票送信・結果表示は変更しない。

## UI・エラー表示・レスポンシブ

既存AppHeader/PageContainer/FixedBottomAction/ButtonとCSSを再利用する。位置取得の状況/再試行・権限案内と、実際の状態に合う説明文だけを追加/修正する。失敗時も通常の縦スクロールを維持し、固定領域は実測余白を使う。320/375/390/430/768/1024px、横向き/短画面/文字200%を検証し、実行できない条件は未検証とする。

## 受け入れ条件・検証方法

1. 注入した位置情報モックで成功、拒否、未対応、timeout、取得不能、標準取得成功、両方失敗、キャンセル、同期例外、再試行、不正座標をテストする。許可拒否で2回目を呼ばない。
2. fetch stubで作成/参加の本文・キー形式・同一入力の再送・別操作・成功後の新キー・503保持・保存失敗時の未送信を確認する。座標をストレージへ出さない。
3. 全状態と不正/期限切れ/認証失敗で復帰先をテストし、既存R6/R10の本人提出状態による振分けを回帰確認する。
4. 検索制御の実処理をモックAPIで検証し、初回/連続GET/失敗/focus相当/Strict Mode相当/明示再試行/ゲストでPOST回数を確認する。
5. Docker Composeでlint/typecheck/既存・追加テスト/build、git diff --check。DB結合テストは有効化しない。ブラウザーの位置成功モックや全遷移を確認できない場合は単体テストと区別する。
6. Git差分で禁止領域と既存投票/演出/共通UIに変更がないことを確認する。

## 未決定事項

今回のフロント修正に必要な未決定事項なし。HMAC/Hot Pepper鍵の運用設定、Edge/Windowsでの実位置取得、Geocoding、バックエンドの欠損座標検証・検索スナップショット整合性、PWA全体設定は別対応。

## Progress

- 完了：作業ブランチ/クリーン状態/未マージPRなしを確認し、現行コードと冪等API・状態遷移を照合。
- 進行中：承認範囲のフロント修正とテスト。
- 検証：未実施。
- コミット/プッシュ/PR作成：なし。

## Self-Review

- Score: 96/100
- Review date: 2026-11-05
- Reasons for deductions: OS由来の位置取得と隔離DBを使う実API書込は実行環境に依存するため（4点）。
- Revisions made: 冪等キーの寿命/座標非保存と再読み込み制約、restaurant_searchingの復帰先、検索POSTの初回/再試行/通常GETの区別を具体化。
