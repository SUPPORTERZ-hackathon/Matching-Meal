# ジャンル投票サービス

- Status: Verified
- Last updated: 2026-10-30
- Related issue: None
- Related specifications: ../models/genre-votes.md, ../models/rooms-and-participants.md, room-lifecycle.md, ../screens/genre-vote.md, ../screens/genre-vote-waiting.md
- Implementation files: ../../backend/internal/service/genre_voting.go, ../../backend/internal/transport/http/genre_voting.go, ../../backend/internal/repository/postgres/genre_voting.go, ../../backend/internal/security/random.go, ../../backend/cmd/api/main.go

## 目的と対象範囲

参加済み利用者が固定16ジャンルへの`like`または`skip`を一括提出し、本人とルーム全体の提出状況を取得できるAPIを定義する。全員の提出が完了したら最多`like`のジャンルを決定し、最多同数なら同数候補からランダム選択して、ルームを店舗候補検索待ち状態へ進める。

## 対象外

- ジャンル投票画面・待機画面のAPI接続
- Hot Pepper Gourmet API呼出しと店舗候補作成
- 店舗投票と店舗決定
- 1スワイプごとの通信、投票途中の保存・復元
- 提出済み投票の変更、管理者による修正
- WebSocket、Server-Sent Events、プッシュ通知

## 前提条件

- 共通レスポンス、エラー、request ID、Bearer認証は`room-lifecycle.md`に従う。
- データ型、固定ジャンル、集計・抽選規則は`../models/genre-votes.md`に従う。
- APIベースパスは`/api/v1`、JSONはlower camel caseとする。
- フロントエンドは初期実装では状態取得APIを定期実行し、常時接続を追加しない。

## 責務分離

- HTTP Handler: Bearerヘッダー、room ID、JSONの解析、HTTPレスポンスとエラーコードへの変換。
- Genre Voting Service: 入力検証、認証後の所属確認、状態、冪等性、集計、抽選、状態遷移の判断。
- Genre Voting Repository: SQL、トランザクション、ルーム行ロック、提出・票・結果の永続化、DBエラー変換。
- Domain: 固定ジャンル、choice、入力正規化、集計候補の算出を副作用なしで実装。
- Random Selector: 候補集合から等確率で1indexを選択し、Serviceへ結果を返す。RepositoryやHandlerから乱数を直接呼ばない。

## API 1: ジャンル投票提出

`PUT /api/v1/rooms/{roomId}/genre-votes`

Bearerトークン必須。PUTは同一内容の再送を成功扱いにする。

### リクエスト

```json
{
  "votes": [
    {"genreId": "ramen", "choice": "like"},
    {"genreId": "sushi-seafood", "choice": "skip"}
  ]
}
```

実際は固定16ジャンルを重複なくすべて含める。入力配列の順序は問わない。

### 処理順序

1. room ID、Bearerトークン、16票を構文・ドメイン検証する。
2. トークンハッシュから現在参加者を取得し、対象roomへの所属を確認する。
3. トランザクションを開始し、対象roomをIDでロックする。
4. 現在参加者の提出済み内容を取得する。
5. 提出済みで入力と同一なら、保存・version更新・再抽選をせず現在状態を返す。
6. 提出済みで入力と異なるなら`VOTE_ALREADY_SUBMITTED`を返す。
7. 未提出の場合はroomが有効かつ`genre_voting`であることを確認する。
8. 提出レコードと正規化した16票を一括保存する。
9. 提出人数と参加者数を取得する。
10. 未完了ならroom versionを1増やす。
11. 全員完了なら集計し、必要な場合だけランダム選択する。
12. 結果保存、`restaurant_searching`への遷移、versionの1加算を行いコミットする。

### 成功レスポンス

200 OK。

```json
{
  "data": {
    "room": {
      "id": "uuid",
      "joinCode": "7K9M2QXR",
      "status": "genre_voting",
      "version": 4,
      "expiresAt": "2026-10-31T12:00:00Z"
    },
    "currentParticipantId": "uuid",
    "submitted": true,
    "submittedAt": "2026-10-30T12:00:00Z",
    "submittedParticipantCount": 1,
    "totalParticipantCount": 3,
    "participants": [
      {"id": "uuid", "nickname": "ひかる", "role": "host", "submitted": true},
      {"id": "uuid", "nickname": "ひかる", "role": "member", "submitted": false}
    ],
    "result": null
  }
}
```

全員完了時は`room.status`が`restaurant_searching`となり、`result`を返す。後続の店舗検索PRが候補保存に成功した時点で`restaurant_voting`へ進める。

```json
{
  "result": {
    "genreId": "sushi-seafood",
    "likeCount": 2,
    "decisionMethod": "random_tie",
    "decidedAt": "2026-10-30T12:01:00Z"
  }
}
```

## API 2: ジャンル投票状況取得

`GET /api/v1/rooms/{roomId}/genre-voting`

Bearerトークン必須。

### 処理

1. room IDとBearerトークンを検証する。
2. トークンに対応する参加者が対象roomに所属することを確認する。
3. room、本人の提出有無、提出人数、参加者ごとの提出状態、確定済み結果を取得する。
4. 他参加者の個別choiceとセッショントークンは返さない。

200 OK。レスポンスは提出APIと同じ形で、未提出の本人は`submitted: false`、`submittedAt: null`とする。

- `genre_voting`では結果はnullになり得る。
- `restaurant_searching`、`restaurant_voting`または`decided`では保存済みジャンル結果を返す。
- 参加者は`joinedAt`、同時刻なら`id`の昇順で返す。
- ポーリング間隔はフロントエンド仕様の責務とし、バックエンドへ固定値を持たせない。

## 集計とランダム決定

1. 固定16ジャンルそれぞれの`like`数を0件も含めて作る。
2. 最大`like`数を求め、その値を持つ候補集合を固定ジャンル順で作る。
3. 候補が1件ならそのジャンルを`most_likes`で決定する。
4. 候補が複数かつ最大値が1以上なら、候補内から等確率で選び`random_tie`とする。
5. 最大値が0なら16件から等確率で選び`random_all_skipped`とする。
6. 選択結果と最大like数を保存してからroom状態を遷移する。

例：ラーメン3票、寿司3票、他2票以下なら、ラーメンと寿司だけを抽選対象にする。全員が全件skipなら16ジャンルすべてを抽選対象にする。

## 状態遷移と冪等性

```text
genre_voting
  ├─ 一部参加者が新規提出 ─> genre_voting（version + 1）
  └─ 最後の参加者が新規提出 ─> restaurant_searching（result作成、version + 1）

restaurant_searching以降
  └─ 同一内容の提出再送 ─> 同じ状態を維持（version・result変更なし）
```

- 未提出者が`genre_voting`以外で新規提出することはできない。
- 提出済み参加者の同一内容再送は、結果確定後も成功する。
- 提出済み参加者の異なる内容はroom状態にかかわらず変更不可とする。
- 同時提出はroom行ロックで直列化し、結果作成と遷移は1回だけ行う。

## エラー処理とステータスコード

| 条件 | HTTP | code |
| --- | ---: | --- |
| JSON、room ID、件数、重複、未知genre、choice不正 | 400 | `INVALID_GENRE_VOTES` |
| トークン欠落・不正 | 401 | `UNAUTHORIZED` |
| 別roomの参加者 | 403 | `FORBIDDEN` |
| roomなし・期限切れ | 404 | `ROOM_NOT_FOUND` |
| 未提出者が投票中以外で提出 | 409 | `GENRE_VOTING_NOT_ACTIVE` |
| 提出済み内容と異なる再送 | 409 | `VOTE_ALREADY_SUBMITTED` |
| 結果とroom状態などの内部不整合 | 500 | `INTERNAL_ERROR` |
| DB・処理タイムアウト | 503 | `SERVICE_UNAVAILABLE` |
| 乱数生成失敗、想定外エラー | 500 | `INTERNAL_ERROR` |

エラーに既存票、他参加者のchoice、トークン、SQL、乱数内部情報を含めない。

## タイムアウト・ログ・セキュリティ

- リクエストコンテキストを認証、DB、トランザクションへ伝播し、既存の名前付きDB操作タイムアウトを使用する。
- トークンはSHA-256ハッシュだけを検索に使用し、平文をDB・レスポンス・ログへ残さない。
- ログはrequest ID、ルート、ステータス、処理時間、内部エラー分類を対象とする。ニックネームと個別choiceは通常ログへ出さない。
- 乱数選択は候補件数を上限とする安全な整数生成を使い、剰余バイアスを持つ単純な`random % n`を使わない。

## 受け入れ条件

1. 有効な参加者が固定16ジャンルを一括提出できる。
2. 不足・重複・未知ジャンル・不正choiceは1件も保存せず400となる。
3. 待機中に本人、提出人数、総人数、参加者ごとの提出状態を取得できる。
4. 他参加者の個別choiceは取得できない。
5. 同一内容の再送は200で、票、submittedAt、version、結果が変化しない。
6. 異なる内容の再送は409で、保存内容が変化しない。
7. 最後の提出より前に結果が作られず、最後の提出で自動的に結果が1件作られる。
8. 単独最多は必ずそのジャンル、最多同数は同数候補だけ、全員skipは16件だけから選ばれる。
9. 結果確定後は`restaurant_searching`となり、再取得・再送で結果が変わらない。
10. 同時提出でも二重結果、二重遷移、versionの余分な加算が起きない。
11. 同じニックネームの参加者をparticipant IDにより別人として扱う。
12. 既存のルーム作成・参加・状態取得・投票開始と`/api/health`が回帰しない。

## 検証方法

- Domainの16件検証、正規化、集計候補をテーブル駆動テストで確認する。
- ServiceをRepository・Random Selectorのstubで検証し、抽選対象と選択indexを確認する。
- Handlerを`httptest`で正常、入力不正、401、403、404、409、503、500と秘密値非出力を確認する。
- 実PostgreSQLで一括保存、再送比較、進捗、集計、結果、ロールバックを検証する。
- 最後の複数提出をgoroutineで実行し、結果・状態・versionの一意性を検証する。
- 実HTTPで作成、2人以上参加、開始、各参加者提出、待機取得、結果取得まで確認する。
- マイグレーションup、down、再up、既存ヘルスチェックを確認する。
- `docker compose exec backend go test ./...`、`go vet ./...`、`go test -race ./...`を実行する。

## 未決定事項

None。`restaurant_searching`状態の追加を含め、2段階投票、ジャンル最多同数時の同数候補内ランダム、全員skip時の全16候補内ランダム、提出後変更不可、一括提出はユーザー承認済み。

## 進捗

- 完了: 既存の投票画面、待機画面、ルームAPI、固定16ジャンル、参加者固定方式を確認。
- 完了: 一括提出、提出状況取得、冪等性、集計、抽選、状態遷移、エラー契約を定義。
- 完了: ユーザーが2段階投票と、最多同数・全員skip時のランダム決定を承認。
- 推奨: ジャンル決定と店舗候補検索を分離するため、中間状態`restaurant_searching`を追加する。
- 承認: ユーザーが`restaurant_searching`状態の追加を承認。
- 完了: ジャンル投票提出API、状況取得API、Bearer認証、冪等性、進捗取得、集計、暗号学的乱数による抽選、結果永続化を実装。
- 完了: PostgreSQLのルーム行ロックにより、提出保存・version更新・最終結果作成・状態遷移を直列化。
- 検証: Service・Handlerテストで部分提出、同数、全skip、同一・異内容再送、inactive、入力・認証・競合・内部エラーを確認。
- 検証: 実HTTPでルーム作成、同一ニックネーム参加、開始、2人同時提出、結果取得、同一再送、異内容再送まで成功。
- 検証: Docker Compose内で`go test ./...`、統合テスト、`go vet ./...`、`go test -race ./...`に成功。
- 残作業: なし。Hot Pepper Gourmet API検索と`restaurant_voting`遷移は別仕様・次PRの対象。
- ブロッカー: なし。
- 関連Issue・PR・コミット: 本変更コミット。PR未作成。

## Self-Review

- Score: 97/100
- Review date: 2026-10-30
- Reasons for deductions: フロントエンドのポーリング間隔とAPI接続は別仕様のため未確定。実運用の乱数分布測定は対象外。
- Revisions made: 同数と全員skipを最大候補集合の抽選として統一し、再送時の処理順、結果確定後の同一再送、version加算回数、待機画面に必要な参加者提出状態を明記。
