# ルーム作成・参加・投票開始サービス

- Status: Approved
- Last updated: 2026-10-29
- Related issue: None
- Related specifications: ../models/rooms-and-participants.md, ../screens/genre-vote.md
- Implementation files: backend/cmd/api/main.go, backend/internal/service/room.go, backend/internal/transport/http/room.go, backend/internal/transport/http/request_id.go

## 目的と対象範囲

ホストによるルーム作成、参加コードを使ったメンバー参加、参加済みメンバーによる状態取得、ホストによるジャンル投票開始のHTTP APIと業務処理を定義する。

## 対象外

- QRコード画像の生成と表示
- 投票内容の保存・集計
- 店舗検索、店舗投票、結果画面
- アカウント認証、参加者の退出・追放、ホスト移譲
- WebSocket、Server-Sent Events、プッシュ通知

## 前提条件

- 主要モデル、制約、セッション形式は`../models/rooms-and-participants.md`に従う。
- フロントエンドは既存の`/api/*`リライトを使用する。
- APIのベースパスは`/api/v1`とする。
- JSONのフィールド名はlower camel caseとする。
- 外部向けエラーは共通エンベロープで返し、開発者向け詳細は秘密情報を除いてサーバーログへ記録する。

## 責務分離

- HTTP Handler: JSONの読取、認証情報の抽出、Application Serviceの呼出、HTTPレスポンス変換だけを担当する。
- Application Service: 権限、ルーム状態、有効期限、人数、冪等性、トランザクション境界を判断する。
- Repository: SQL、行ロック、DB制約エラーの変換を担当する。
- Domain: 状態遷移と入力値の純粋な検証を担当する。
- `cmd/api/main.go`: 設定読込、依存関係の組立、ルート登録、起動・終了だけを担当する。

## API共通仕様

### 成功レスポンス

各APIは必要なリソースを`data`に格納する。

```json
{
  "data": {}
}
```

### エラーレスポンス

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "ルームが見つかりません。",
    "requestId": "..."
  }
}
```

- `code`はフロントエンドが分岐に使用する安定した識別子とする。
- `message`は利用者向け日本語とし、SQLや内部構造を含めない。
- `requestId`はリクエスト単位で生成または受け入れ、レスポンスと構造化ログに含める。
- JSONの未知フィールドは、前方互換性を妨げない範囲で無視する。型不一致、必須値欠落、不正値は400とする。

## API 1: ルーム作成

`POST /api/v1/rooms`

認証は不要。

### リクエスト

```json
{
  "nickname": "青山学院大学は陽キャラ"
}
```

### 処理順序

1. ニックネームを正規化・検証する。
2. ルームID、参加コード、参加者ID、セッショントークンを生成する。
3. トークンをハッシュ化する。
4. トランザクション内でルームとホスト参加者を作成する。
5. 参加コード衝突時だけ、名前付き上限までコード生成から再試行する。
6. 平文トークンを成功レスポンスで一度だけ返す。

### レスポンス

201 Created。

```json
{
  "data": {
    "room": {
      "id": "uuid",
      "joinCode": "7K9M2QXR",
      "status": "lobby",
      "version": 1,
      "expiresAt": "2026-10-30T12:00:00Z"
    },
    "participant": {
      "id": "uuid",
      "nickname": "青山学院大学は陽キャ",
      "role": "host"
    },
    "sessionToken": "plain-token-returned-once"
  }
}
```

## API 2: ルーム参加

`POST /api/v1/rooms/{joinCode}/participants`

認証は不要。

### リクエスト

```json
{
  "nickname": "ともだち"
}
```

### 処理順序

1. 参加コードとニックネームを正規化・検証する。
2. トランザクションを開始し、参加コードに対応するルームをロックする。
3. 存在、有効期限、`lobby`、参加者上限を確認する。同一ニックネームは許可する。
4. 参加者IDとセッショントークンを生成し、ハッシュを保存する。
5. ルームの`version`を1加算してコミットする。
6. 平文トークンを成功レスポンスで一度だけ返す。

201 Created。レスポンスはルーム作成と同じ構造で、`role`は`member`とする。

## API 3: ルーム状態取得

`GET /api/v1/rooms/{roomId}`

Bearerトークン必須。

### レスポンス

200 OK。

```json
{
  "data": {
    "room": {
      "id": "uuid",
      "joinCode": "7K9M2QXR",
      "status": "lobby",
      "version": 2,
      "expiresAt": "2026-10-30T12:00:00Z"
    },
    "currentParticipantId": "uuid",
    "participants": [
      {"id": "uuid", "nickname": "青山学院大学は陽キャ", "role": "host"},
      {"id": "uuid", "nickname": "ともだち", "role": "member"}
    ]
  }
}
```

- 参加者は`joinedAt`、同時刻なら`id`の昇順で返す。
- セッショントークンのハッシュは返さない。
- 初期実装はフロントエンドからの状態取得を利用し、常時接続方式を追加しない。
- `version`が変化した場合だけ画面状態を更新できる契約とする。取得間隔はフロントエンド仕様で定義し、バックエンドへハードコードしない。

## API 4: ジャンル投票開始

`POST /api/v1/rooms/{roomId}/genre-voting/start`

ホストのBearerトークン必須。リクエストボディなし。

### 処理順序

1. トランザクションを開始し、ルームをIDでロックする。
2. トークンに対応する参加者が同じルームのホストであることを確認する。
3. 有効期限と現在状態を確認する。
4. `lobby`の場合は参加者が2人以上いることを確認する。
5. `status`を`genre_voting`へ変更し、`version`を1加算する。
6. `genre_voting`の場合は変更せず現在状態を返し、再送を成功扱いにする。
7. その他の状態は`INVALID_ROOM_TRANSITION`として409を返す。

200 OK。状態取得と同じ`room`および`participants`を返す。

## タイムアウトとサーバー設定

- HTTPサーバーのReadHeader、Read、Write、Idle、Shutdownタイムアウトを名前付き設定へ集約する。
- DB操作はリクエストコンテキストを引き継ぎ、名前付きDBタイムアウトを適用する。
- タイムアウト値は実装時に`.env.example`へ説明付きで追加するか、変更頻度が低いものは名前付き定数にする。
- クライアント切断時は処理コンテキストをキャンセルする。

## エラー処理とステータスコード

| 条件 | HTTP | code |
| --- | ---: | --- |
| JSON、パス、ニックネーム不正 | 400 | `INVALID_REQUEST` |
| トークン欠落・不正 | 401 | `UNAUTHORIZED` |
| 別ルーム参加者、ホスト以外 | 403 | `FORBIDDEN` / `HOST_REQUIRED` |
| ルームなし・期限切れ | 404 | `ROOM_NOT_FOUND` |
| 参加不可状態 | 409 | `ROOM_NOT_JOINABLE` |
| 上限到達 | 409 | `ROOM_CAPACITY_REACHED` |
| 人数不足 | 409 | `NOT_ENOUGH_PARTICIPANTS` |
| 不正な状態遷移 | 409 | `INVALID_ROOM_TRANSITION` |
| DBタイムアウト | 503 | `SERVICE_UNAVAILABLE` |
| 想定外エラー | 500 | `INTERNAL_ERROR` |

## ログと監視

- requestId、HTTPメソッド、ルート、ステータス、処理時間、内部エラー分類を構造化ログへ記録する。
- ニックネーム、トークン、Authorizationヘッダー、APIキー、DB接続文字列をログへ記録しない。
- panicはGin Recovery相当で回復し、共通500レスポンスへ変換する。
- `/api/health`は既存動作を維持する。プロダクトAPIのRepositoryとは責務を混在させない。

## 受け入れ条件

1. 正常なルーム作成、2人目の参加、状態取得、ホストによる開始がAPI経由で完了する。
2. 各成功レスポンスが明示した型とステータスコードに一致する。
3. 参加者トークンで別ルームの情報を取得・変更できない。
4. ホスト以外は投票を開始できない。
5. 1人だけでは投票を開始できない。
6. 開始要求の再送で二重遷移やエラーにならない。
7. 開始後の参加要求を拒否する。
8. 参加と開始の並行実行でも参加者集合が確定する。
9. トークン、Authorizationヘッダー、DB詳細がレスポンスとログへ漏れない。
10. 既存`/api/health`が回帰しない。
11. 同一ルームへ同じニックネームで複数人が参加でき、参加者IDとトークンにより別人として扱われる。

## 検証方法

- DomainとApplication Serviceをテーブル駆動ユニットテストで検証する。
- RepositoryはDocker ComposeのPostgreSQLを使用して、作成、参加、ロック、制約違反、ロールバックを検証する。
- Handlerは`httptest`でJSON、認証、HTTPステータス、エラーコードを検証する。
- 参加と開始を複数goroutineから実行し、競合結果を検証する。
- ログをテスト用出力へ送り、秘密値が含まれないことを検証する。
- `docker compose exec backend go test ./...`と`go vet ./...`を実行する。
- マイグレーションのup、down、再upと既存ヘルスチェックを確認する。

## 未決定事項

None。API形状、人数、期限、固定方式は本仕様レビューで承認対象とする。

## 進捗

- 完了: 現行のNext.js API転送、Ginヘルスチェック、pgxpool、Composeマイグレーションを確認。
- 完了: Context7が利用できないため、Gin、pgx、PostgreSQLの公式一次情報を使用して設計。
- 完了: ルーム作成・参加・取得・開始API、責務境界、競合時の動作を定義。
- 完了: ユーザーが参加者固定と同一ニックネーム許可を含む仕様を承認。
- 完了: 最初の実装単位として`POST /api/v1/rooms`、共通エラー形式、requestId、ルーム作成Application Serviceを実装。
- 検証: 正常・不正リクエスト、ニックネーム検証、乱数形式、参加コード衝突再試行、トークンハッシュ引渡しの自動テストとローカルrace検査に成功。実PostgreSQLを使うAPIで201と既存`/api/health`の正常応答を確認。
- 完了: `POST /api/v1/rooms/{joinCode}/participants`を案Aの行ロック方式で実装。期限・状態・定員はServiceで判断し、Repositoryはトランザクション操作を提供する責務分離を維持。
- 検証: 小文字コード、同一ニックネーム、期限切れ、投票開始済み、定員到達、入力不正、HTTPレスポンスを自動テスト。実APIで同一ニックネームの2人が別IDで参加し、versionが2、3へ更新されることを確認。
- 完了: `GET /api/v1/rooms/{roomId}`を実装。BearerトークンのSHA-256ハッシュによる参加者認証、別ルームのアクセス拒否、有効期限判定、参加順の一覧取得をHandler、Service、Repositoryへ分離。
- 調査: Context7未接続のため、Gin公式のパスパラメータ資料（https://gin-gonic.com/en/docs/routing/param-in-path/）とpgx公式Goパッケージ資料（https://pkg.go.dev/github.com/jackc/pgx/v5）を参照。
- 検証: Docker内の`go test ./...`と`go vet ./...`に成功。実PostgreSQLで同一ニックネーム2名、現在参加者ID、参加者順序、既存の同時参加制御を確認。
- 残作業: ジャンル投票開始APIの実装と検証。
- ブロッカー: なし。
- 関連Issue・PR・コミット: 本変更コミット（ルーム状態取得API）、PR未作成。

## Self-Review

- Score: 95/100
- Review date: 2026-10-29
- Reasons for deductions: フロントエンド側のトークン保存方法と状態取得間隔は別仕様の責務であり、本仕様では確定していない。
- Revisions made: 正常系だけでなく、権限、期限、冪等性、同時参加・開始、ログ秘匿、回帰検証を追加。同一ニックネームを許可し、IDとトークンによる識別を追加。
