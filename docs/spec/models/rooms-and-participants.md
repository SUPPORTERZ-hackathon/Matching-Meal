# ルーム・参加者モデル

- Status: Approved
- Last updated: 2026-10-29
- Related issue: None
- Related specifications: ../services/room-lifecycle.md, ../screens/genre-vote.md
- Implementation files: backend/internal/domain/room.go, backend/internal/security/random.go, backend/internal/repository/room.go, backend/internal/repository/postgres/room.go, backend/migrations/000002_create_rooms_and_participants.up.sql, backend/migrations/000002_create_rooms_and_participants.down.sql

## 目的と対象範囲

複数人が同じ投票へ安全に参加するため、ルーム、参加者、ホスト権限、参加コード、参加者セッション、およびルームの進行状態を定義する。本仕様はルーム作成、参加、状態取得、ジャンル投票開始までを対象とする。

## 対象外

- ジャンル投票と店舗投票の保存・集計
- Hot Pepper Gourmet APIによる店舗検索
- 店舗決定とGoogle Maps URL生成
- ユーザーアカウント、パスワード、ソーシャルログイン
- 投票開始後の参加者追加・退出・除外
- 期限切れデータを物理削除する定期ジョブ

## 前提条件

- APIはNext.jsの同一オリジン`/api/*`プロキシを経由する。
- 参加者はユーザーアカウントを持たない。
- ルーム作成者をホストとする。
- ホストがジャンル投票を開始した時点で参加者を固定する。
- `.env`の実値は参照せず、設定項目は`.env.example`で管理する。

## エンティティ

### Room

| フィールド | Go/TypeScript | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `id` | string | `UUID` | 必須 | 主キー。アプリケーションで生成 |
| `joinCode` | string | `VARCHAR(8)` | 必須 | Crockford Base32のうち誤読しやすい文字を除いた大文字8文字。一意 |
| `status` | RoomStatus | `TEXT` | 必須 | CHECK制約で許可値を限定 |
| `version` | number/int64 | `BIGINT` | 必須 | 初期値1。状態変更ごとに1加算 |
| `expiresAt` | string/time.Time | `TIMESTAMPTZ` | 必須 | 作成から24時間後 |
| `createdAt` | string/time.Time | `TIMESTAMPTZ` | 必須 | DB時刻 |
| `updatedAt` | string/time.Time | `TIMESTAMPTZ` | 必須 | DB時刻 |

`RoomStatus`は`lobby`、`genre_voting`、`restaurant_voting`、`decided`、`expired`とする。今回実装する遷移は`lobby`から`genre_voting`だけとし、後続状態は将来の仕様との互換性のため列挙する。

### Participant

| フィールド | Go/TypeScript | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `id` | string | `UUID` | 必須 | 主キー。アプリケーションで生成 |
| `roomId` | string | `UUID` | 必須 | `rooms.id`への外部キー、削除時CASCADE |
| `nickname` | string | `VARCHAR(20)` | 必須 | 前後空白除去後1〜20文字、制御文字不可 |
| `role` | ParticipantRole | `TEXT` | 必須 | `host`または`member` |
| `sessionTokenHash` | 非公開 | `BYTEA` | 必須 | SHA-256、平文を保存しない、全体で一意 |
| `joinedAt` | string/time.Time | `TIMESTAMPTZ` | 必須 | DB時刻 |

同一ルーム内で同じニックネームを許可する。ニックネームを参加者識別や認証に使用せず、参加者IDとセッショントークンで識別する。ホストはルームごとに1人だけとし、`role = 'host'`の部分一意インデックスで保証する。

## セッションと秘密情報

- 参加時に暗号学的乱数32バイトをBase64 URLエンコードしたセッショントークンを発行する。
- APIレスポンスで平文トークンを返すのは作成・参加成功時の一度だけとする。
- DBにはトークンのSHA-256ハッシュだけを保存する。
- 以後のAPIは`Authorization: Bearer <token>`で参加者を特定する。
- 参加コードは認証情報ではない。QRコードへ含めてよいが、セッショントークンは含めない。
- トークン、Hot Pepper APIキー、Authorizationヘッダーをログへ出力しない。

## PostgreSQLスキーマ要件

- 新規マイグレーションを追加し、既存`000001`は変更しない。
- `rooms.join_code`、`participants.session_token_hash`、ルームごとのホストに一意制約を設定する。ニックネームには一意制約を設定しない。
- `participants.room_id`に一覧取得用インデックスを設定する。
- ルーム作成ではルームとホスト参加者を同一トランザクションで作成する。
- 参加と投票開始では対象ルーム行を`SELECT ... FOR UPDATE`でロックし、参加と開始の競合を直列化する。
- DBエラーはリポジトリ固有エラーへ変換し、HTTP層へPostgreSQLの詳細を漏らさない。

## 状態と状態遷移

```text
ルームなし
  └─ create ─> lobby
                  └─ host starts with 2+ participants ─> genre_voting

有効期限到達
  └─ 任意の状態 ─> expired
```

- `lobby`だけが新規参加を受け付ける。
- `genre_voting`へ移った後は参加者を追加・削除しない。
- 開始要求と参加要求が競合した場合、先にルーム行をロックしてコミットした処理を基準にする。開始が先なら参加は`ROOM_NOT_JOINABLE`、参加が先ならその参加者を含めて開始する。
- 同じ開始要求が再送された場合、すでに`genre_voting`なら現在状態を返して成功扱いとする。ただしホスト以外は常に拒否する。

## 入力・出力とデータ要件

- ニックネームはUnicodeとして扱い、前後のUnicode空白を除去する。
- 空文字、20文字超過、制御文字を含む値を拒否する。
- 参加コードは大文字へ正規化して完全一致検索する。
- 1ルームの参加者上限は20人とし、名前付き設定値で変更可能にする。
- 投票開始に必要な最小参加者数はホストを含め2人とする。
- 24時間の有効期間、参加者上限、参加コード長、トークンバイト数は名前付き設定または定数に集約する。

## エラー処理と境界条件

- 参加コードの衝突時は新しいコードを生成して再試行する。上限回数を超えた場合は`ROOM_CODE_GENERATION_FAILED`とし、500を返す。
- 存在しない、または期限切れの参加コードは、推測による列挙を避けるため同じ`ROOM_NOT_FOUND`として扱う。
- 参加者上限到達は`ROOM_CAPACITY_REACHED`、ロビー以外への参加は`ROOM_NOT_JOINABLE`として409を返す。
- 不正または欠落したトークンは401、別ルームの参加者は403を返す。
- ホスト以外の開始操作は`HOST_REQUIRED`として403を返す。
- 参加者が2人未満の開始は`NOT_ENOUGH_PARTICIPANTS`として409を返す。
- DB障害のレスポンスには内部エラー、SQL、接続情報を含めない。

## 受け入れ条件

1. ルームとホストが1トランザクションで作成される。
2. 参加コード、ルームID、参加者ID、平文セッショントークンがそれぞれの責務で分離される。
3. DBおよびログに平文セッショントークンが残らない。
4. 同じルームに同じニックネームで参加でき、それぞれ異なる参加者IDとセッショントークンを持つ。
5. ホストはルームごとに必ず1人だけである。
6. 参加と投票開始が競合しても、開始後の参加者が紛れ込まない。
7. 投票開始後は新規参加できず、既存参加者は同じトークンで状態を取得できる。
8. 期限切れルームは参加・開始できない。

## 検証方法

- モデルの入力検証をテーブル駆動ユニットテストで確認する。
- 実PostgreSQLにマイグレーションを適用し、主キー、外部キー、一意制約、CHECK制約、インデックスを確認する。
- 同じ参加コードと複数ホストの挿入がDB制約で失敗することを確認する。
- 同じルームへ同じニックネームの参加者を複数作成でき、IDとトークンで別人として取得できることを確認する。
- ルーム作成途中のエラーでルームだけが残らないことを確認する。
- 参加と開始を並行実行し、直列化された結果になることを確認する。
- マイグレーションのup、down、再upを確認する。
- `go test ./...`、`go vet ./...`をDocker Compose内で実行する。

## 未決定事項

None。参加者上限20人、最小2人、有効期限24時間は本仕様レビューで承認対象とする。

## 進捗

- 完了: 現行UI仕様、既存Gin/pgx構成、Next.js APIプロキシ、Composeの設定項目を確認。
- 完了: Context7が利用できないため、Gin、pgx、PostgreSQLの公式一次情報を使用して設計。
- 完了: ルーム・参加者モデル案、状態、制約、受け入れ条件を作成。
- 完了: ユーザーが参加者固定と同一ニックネーム許可を含む仕様を承認。
- 完了: 最初の実装単位としてRoom/Participantの型、入力検証、安全なID・参加コード・トークン生成、ルームとホストを作成するトランザクション、DBマイグレーションを実装。
- 検証: ローカルおよびDockerで`go test ./...`と`go vet ./...`に成功。マイグレーションのup、down、再upに成功。実APIでルームとホストを作成し、DBには32バイトのトークンハッシュだけが保存されることを確認。
- 完了: 参加コードの正規化・検証、同一ニックネームを許可したメンバー追加、参加者上限、ルーム行ロック、version更新を実装。
- 検証: 実PostgreSQLへ25件を同時参加させ、ホストを含む20人だけが保存され、残りは定員エラーになること、全員が異なる参加者IDと32バイトのトークンハッシュを持つことを確認。
- 完了: UUID形式のルームID検証、セッショントークンハッシュ照合、ルームと参加者一覧の読み取りを実装。参加者は`joined_at`、同時刻は`id`の昇順で取得。
- 検証: 実PostgreSQLで同一ニックネームのホストとメンバーを別IDとして取得し、Bearerトークンに対応する現在参加者IDと参加順序を確認。
- 残作業: 投票開始のモデル・リポジトリ実装と検証。
- ブロッカー: なし。
- 関連Issue・PR・コミット: 本変更コミット（ルーム状態取得API）、PR未作成。

## Self-Review

- Score: 96/100
- Review date: 2026-10-29
- Reasons for deductions: 実際の負荷計測とモバイル実機でのトークン永続化は未実施。
- Revisions made: 参加と開始の競合、期限切れ、コード衝突、トークン漏えい、DB制約の検証を明文化。同一ニックネームを許可し、IDとトークンによる識別を明記。
