# ルーム作成・参加リクエスト冪等化

- Status: Verified
- Last updated: 2026-11-05
- Related issue: None
- Related specifications: room-lifecycle.md, ../models/rooms-and-participants.md
- Implementation files: backend/internal/domain/idempotency.go, backend/internal/security/idempotency.go, backend/internal/repository/room.go, backend/internal/repository/postgres/room.go, backend/internal/service/room.go, backend/internal/service/room_idempotency.go, backend/internal/transport/http/room.go, backend/cmd/api/main.go, backend/migrations/000007_create_room_idempotency_requests.up.sql, backend/migrations/000007_create_room_idempotency_requests.down.sql, docs/api/openapi.yaml, .env.example, compose.yaml

## 目的と対象範囲

ルーム作成または参加のDBコミット後にレスポンスが失われても、同じ利用者操作の再送によってルームや参加者が重複しないようにする。`Idempotency-Key`付きの同一リクエストには、初回と同じルーム、参加者、セッショントークンを返す。

対象APIは次の2つとする。

- `POST /api/v1/rooms`
- `POST /api/v1/rooms/{joinCode}/participants`

既存クライアントとの互換性を維持するため、`Idempotency-Key`は任意とする。キーがないリクエストは既存どおり毎回新規操作として扱う。

## 対象外

- GET、投票開始、ジャンル投票、店舗検索、店舗投票の冪等化変更
- ニックネームによる同一人物判定
- 異なる冪等キーで送られた操作の重複推定
- フロントエンドへの`Idempotency-Key`生成・保存処理の実装
- 既存参加者の退出、再参加、トークン再発行
- 期限切れ冪等レコードの定期物理削除ジョブ
- HMAC鍵のオンラインローテーション

## 前提条件

- 同じルーム内で同じニックネームを許可し、ニックネームを本人識別へ使用しない。
- セッショントークンは32バイト相当の強度を持ち、DBにはSHA-256ハッシュだけを保存する既存契約を維持する。
- ルーム作成ではルーム、ホスト、検索条件を同一トランザクションで作成する。
- 参加ではルーム行をロックし、状態、期限、定員を検証して参加者追加とroom version更新を同一トランザクションで行う。
- APIの成功・エラーエンベロープ、request ID、Bearer認証、タイムアウトは`room-lifecycle.md`に従う。

## API契約

### Idempotency-Key

対象APIは任意のHTTPヘッダー`Idempotency-Key`を受け付ける。

- 推奨値はクライアントが操作開始時に生成するUUID v4とする。
- 許可形式はASCII英数字と`-`、`_`だけ、長さ16〜128文字とする。
- 大文字・小文字を区別し、値をtrim・小文字化・推測補正しない。
- 複数値、空値、形式不正は`400 INVALID_IDEMPOTENCY_KEY`とする。
- 生のキーをDB、構造化ログ、エラーレスポンスへ保存・出力しない。

キーなしの場合は既存のリクエスト・レスポンス・エラー動作を変更しない。

### 初回成功

初回は既存どおり`201 Created`を返す。ルーム、参加者、検索条件、トークンハッシュ、冪等レコードを1トランザクションで確定する。

### 同一内容の再送

同じ操作種別、同じ`Idempotency-Key`、同じ正規化済み入力の場合は、新しいルームまたは参加者を作らず、初回と同じ`201 Created`レスポンスを返す。

再送レスポンスには次のヘッダーを付ける。

```http
Idempotency-Replayed: true
```

初回レスポンスには同ヘッダーを付けない。レスポンス本文は初回時点のroom statusとversionを含めて再現し、現在状態を知る必要があるクライアントは既存のルーム状態GETを使用する。

### 異なる内容でのキー再利用

同じ操作種別とキーに対し、正規化済み入力が初回と異なる場合は次を返す。

```text
HTTP 409 Conflict
code: IDEMPOTENCY_KEY_CONFLICT
message: この操作キーは別のリクエストで使用されています。
```

ルーム作成ではニックネーム、緯度、経度、検索範囲のいずれかが異なれば競合とする。参加では正規化済み参加コードまたはニックネームが異なれば競合とする。

同じニックネームでも異なるキーなら既存仕様どおり別参加者として作成する。

## 入力の正規化とフィンガープリント

Handlerではキーの構文だけを検証し、Serviceへ生のキーを渡す。Serviceは既存Domain処理で業務入力を正規化・検証した後、型付きデータを決定的なバイト列へ変換しSHA-256フィンガープリントを生成する。

- 作成: バージョン識別子、正規化済みニックネーム、IEEE 754の緯度・経度、整数検索範囲
- 参加: バージョン識別子、正規化済み参加コード、正規化済みニックネーム

JSONの空白、プロパティ順、`35`と`35.0`など表記だけの違いでは競合にしない。フィンガープリント形式にはバージョンを含め、将来の変更で既存レコードを誤解釈しない。

## セッショントークン

キーなしの操作では既存の暗号学的乱数トークンを使用する。キー付き操作では、HMAC-SHA-256を使用して同じトークンを再生成できるようにする。

入力にはバージョン識別子、操作種別、生の冪等キー、参加者IDを長さ付きで含める。HMAC出力32バイトをBase64 URLエンコードし、既存と同じSHA-256ハッシュを`participants.session_token_hash`へ保存する。

- HMAC鍵は`ROOM_IDEMPOTENCY_HMAC_KEY`から注入する。
- 設定値はBase64エンコードした32バイト以上とし、ソースコードへハードコードしない。
- `.env.example`へ名前、生成方法、用途だけを記載し、実値をGit管理しない。
- 生の鍵、生の冪等キー、平文セッショントークンをログへ出さない。
- キー付きリクエスト時にHMAC鍵が未設定・不正なら、書込み前に`503 SERVICE_UNAVAILABLE`を返す。
- 冪等レコードの有効期間中は同じ鍵を維持する。鍵変更時の旧鍵併用は別仕様とする。

## データモデルとマイグレーション

既存マイグレーションを変更せず、新しいup/downマイグレーションで`room_idempotency_requests`を追加する。

| 列 | PostgreSQL | 制約・用途 |
| --- | --- | --- |
| `operation` | `TEXT` | `create_room`または`join_room` |
| `key_hash` | `BYTEA` | 生キーのSHA-256。`operation`との複合主キー |
| `request_fingerprint` | `BYTEA` | 正規化済み入力のSHA-256 |
| `state` | `TEXT` | `pending`または`completed` |
| `room_id` | `UUID NULL` | 完了後必須。roomsへの外部キー、削除時CASCADE |
| `participant_id` | `UUID NULL` | 完了後必須。participantsへの外部キー、削除時CASCADE |
| `response_room_status` | `TEXT NULL` | 初回レスポンスのroom status |
| `response_room_version` | `BIGINT NULL` | 初回レスポンスのroom version |
| `created_at` | `TIMESTAMPTZ` | DB時刻 |
| `expires_at` | `TIMESTAMPTZ NULL` | pendingではNULL、completedでは対象ルームの有効期限 |

- `completed`ではリソースIDとレスポンスsnapshotを`NOT NULL`相当のCHECK制約で必須にする。
- `pending`はリソースIDとsnapshotを持たない。
- フィンガープリントとキーのハッシュは32バイトCHECKを付ける。
- operation、state、status、version、有効期限へCHECK制約を付ける。
- 冪等レコードだけがコミットされる状態を作らない。
- 初回処理が失敗またはロールバックした場合、冪等レコードもロールバックし、同じキーで再試行できる。

定期削除は本仕様の対象外とする。rooms削除時はCASCADEし、論理的な有効期限到達後の再送は`ROOM_NOT_FOUND`として扱う。

## 責務分離

- Handler: ヘッダー構文検証、Service呼出し、HTTPコード、`Idempotency-Replayed`の付与。
- Service: 業務入力の正規化、フィンガープリント、HMACトークン生成、既存業務エラーと冪等競合の判断。
- Repository: 冪等キーの直列化、同一トランザクション内の作成・参加、snapshot保存・復元、DBエラー変換。
- Domain/Security: キー形式、決定的エンコード、HMAC生成の純粋処理。
- `cmd/api`: HMAC鍵設定の読込みと依存注入。鍵の値をログへ出さない。

HTTPレスポンスJSONをRepositoryへ保存せず、Domainのroom・participantと初回snapshotを列として保存する。RepositoryからTransportの型へ依存させない。

## 状態とトランザクション

```text
キーなし
  └─ 既存処理

キーあり・未登録
  └─ pending確保
       ├─ 業務処理成功 → completed → commit → 201
       └─ 失敗 → 全体rollback

キーあり・completed
  ├─ fingerprint一致 → 保存済み結果を復元 → 201 + replayed
  └─ fingerprint不一致 → 409
```

`INSERT ... ON CONFLICT DO NOTHING`と同一キー行のロックを使い、同時要求をDBで直列化する。待機中もリクエストコンテキストと既存DBタイムアウトを使用する。

参加処理では冪等キーを確保してから対象ルームをロックする。同じキーの再送は保存済み結果を返すため、初回成功後にルームが`genre_voting`へ進んでも新規参加拒否へ分岐しない。異なるキーの新規参加は従来どおりロビー以外で拒否する。

## エラー処理と境界条件

| 条件 | HTTP | code |
| --- | ---: | --- |
| キーの形式不正・複数指定 | 400 | `INVALID_IDEMPOTENCY_KEY` |
| 同じキーを異なる正規化済み入力で再利用 | 409 | `IDEMPOTENCY_KEY_CONFLICT` |
| 冪等結果のroomが期限切れ | 404 | `ROOM_NOT_FOUND` |
| HMAC鍵未設定・不正 | 503 | `SERVICE_UNAVAILABLE` |
| 冪等キー待機またはDB操作のタイムアウト | 503 | `SERVICE_UNAVAILABLE` |
| 保存済み参照先・snapshotの不整合 | 500 | `INTERNAL_ERROR` |

- 不正な業務入力は冪等レコードを作成する前に既存400を返す。
- 初回のルームなし、参加不可、定員超過など既存業務エラーは保存せず、条件解消後に同じキーで再試行できる。
- リクエストキャンセル後もコミット済み結果は再送で復元できる。
- raw key、fingerprint、HMAC鍵、平文トークンは外部エラーへ含めない。

## 受け入れ条件

1. キーなしの作成・参加は既存と同じ動作をする。
2. 同じキーと内容でルーム作成を逐次・並行再送しても、ルームとホストが1組だけ作成される。
3. 同じキーと内容で参加を逐次・並行再送しても、参加者が1人だけ作成され、room versionが1回だけ増える。
4. 初回と再送でroom、participant、sessionToken、201レスポンス本文が一致する。
5. 同じニックネームでも異なるキーなら別ID・別トークンの参加者として作成される。
6. 同じキーの異なる入力は409となり、DBを変更しない。
7. 初回処理の失敗・ロールバック・クライアント応答消失後も、安全に同じキーで再試行できる。
8. 参加成功後に投票開始しても、同じ参加キーの再送は初回結果を返し、新しい参加者を作らない。
9. DBとログに平文のキー、HMAC鍵、セッショントークンが残らない。
10. 既存の同一ニックネーム許可、参加上限、期限、参加と開始の競合、参加コード衝突再試行が回帰しない。

## 検証方法

- Domain/Securityのキー検証、決定的フィンガープリント、HMACトークンをテーブル駆動テストで確認する。
- Serviceでキーなし、初回、再送、競合、鍵不正、既存業務エラーを確認する。
- Handlerでヘッダーなし、正常キー、不正・複数キー、replayヘッダー、HTTPコードを`httptest`で確認する。
- Docker ComposeのPostgreSQLでマイグレーションup、down、再up、CHECK、FK、CASCADEを確認する。
- 実PostgreSQLで同一キーを複数goroutineから送り、作成件数、参加者件数、version、同一トークンを確認する。
- 応答消失相当として初回成功レスポンスを破棄し、同じキーの再送だけで認証可能なトークンを回復できることを確認する。
- DB行とテストログに平文キー・鍵・トークンが含まれないことを確認する。
- Docker Compose内で`go test ./...`、`go vet ./...`、`go test -race ./...`を実行する。
- OpenAPI検証と既存実APIの作成・参加・取得・開始フローを回帰確認する。

## 未決定事項

None。任意ヘッダー、16〜128文字、ルーム期限まで有効、HMAC鍵未設定時はキー付き要求だけ503、再送も201とする仕様をユーザー承認済み。

## 進捗

- 完了: 既存のService、Repository、Handler、乱数生成、DB制約、関連仕様を確認。
- 完了: 平文トークンをDB保存せず同一レスポンスを再現するには、決定的HMACトークンまたは暗号化保存が必要と確認。
- 完了: 暗号化レスポンス保存より責務と保存データが小さいHMAC方式を推奨案として選定。
- 完了: キーなしの後方互換、同一ニックネーム、並行再送、投票開始後の再送、期限、秘密情報を仕様化。
- 完了: ユーザーが仕様を承認。Statusを`Approved`へ更新。
- 完了: キー検証、入力フィンガープリント、HMACセッショントークン、Handler・Service・Repositoryの責務分離を実装。
- 完了: `room_idempotency_requests`のup/downマイグレーション、OpenAPI、`.env.example`、Compose設定を追加。
- 修正: 初回結果とDBから復元した再送結果で`expiresAt`のナノ秒精度が異なる問題を結合テストで検出し、保存前にPostgreSQLのマイクロ秒精度へ正規化。
- 検証: Domain、Security、Service、Handlerの単体テストでキー形式、決定的生成、初回・再送・競合・設定不備・再送ヘッダーを確認。
- 検証: 実PostgreSQLへ同一キーの作成・参加を各8 goroutineから同時実行し、同一レスポンス、作成件数1、version加算1回、別キーの同名参加、異入力409、投票開始後の再送を確認。
- 検証: CHECK制約、キーのハッシュ保存、rooms削除時CASCADE、マイグレーションup・down・再upを確認。
- 検証: Docker Compose内の`go test ./...`、`go vet ./...`、`go test -race ./...`と全PostgreSQL結合テストに成功。OpenAPI YAMLの構文とローカル参照を確認。
- 残作業: 実環境ではデプロイ前に`ROOM_IDEMPOTENCY_HMAC_KEY`の設定が必要。
- ブロッカー: なし。
- 関連Issue・PR・コミット: 本変更コミット、PR未作成。

## Self-Review

- Score: 97/100
- Review date: 2026-11-04
- Reasons for deductions: HMAC鍵の実環境投入と将来のローテーション手順はデプロイ運用仕様で別途決定が必要（3点）。
- Revisions made: トークン再現方法、キーなし互換、正規化単位、同時要求、初回snapshot、期限、ロールバック、開始後再送、秘密情報を具体化。
