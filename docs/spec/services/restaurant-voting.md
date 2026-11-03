# 店舗投票サービス

- Status: Approved
- Last updated: 2026-11-03
- Related issue: None
- Related specifications: ../models/restaurant-votes.md, ../models/restaurant-candidates.md, ../models/rooms-and-participants.md, restaurant-search.md, ../screens/restaurant-vote.md, ../screens/restaurant-vote-waiting.md
- Implementation files: Not implemented

## 目的と対象範囲

参加済み利用者が保存済み候補店舗1〜5件への`like`または`skip`を一括提出し、本人とルーム全体の提出状況を取得できるAPIを定義する。全員の提出完了時に店舗投票モデルの規則で1店舗を決定し、ルームを`decided`へ進める。

## 対象外

- 店舗投票画面・待機画面のAPI接続
- 1店舗を評価するたびの通信、投票途中の保存・復元
- 提出済み投票の変更、取り消し、管理者修正
- Google Maps URL生成、最終結果画面、結果共有
- WebSocket、Server-Sent Events、プッシュ通知
- 店舗候補検索、候補再抽選

## 前提条件

- 共通レスポンス、エラー形式、request ID、Bearer認証は`room-lifecycle.md`に従う。
- データ型、候補完全一致、集計、抽選、トランザクション規則は`../models/restaurant-votes.md`に従う。
- APIベースパスは`/api/v1`、JSONはlower camel caseとする。
- フロントエンドは初期実装では状態取得APIを定期実行し、常時接続を追加しない。
- `.env`の実値、Hot Pepper APIキー、セッショントークンをレスポンスまたはログへ出さない。

## 責務分離

- HTTP Handler: Bearerヘッダー、room ID、JSONの解析、HTTPレスポンスとエラーコードへの変換。
- Restaurant Voting Service: 入力検証、認証後の所属確認、状態、冪等性、集計、抽選、状態遷移の判断。
- Restaurant Voting Repository: SQL、トランザクション、ルーム行ロック、候補・提出・票・結果の読み書き、DBエラー変換。
- Domain: choice、入力正規化、同一内容判定、集計候補の算出を副作用なしで実装。
- Random Selector: 候補集合から等確率で1indexを選択する既存実装を再利用し、RepositoryやHandlerから乱数を直接呼ばない。

## API 1: 店舗投票提出

`PUT /api/v1/rooms/{roomId}/restaurant-votes`

Bearerトークン必須。PUTは同一内容の再送を成功扱いにする。

### リクエスト

```json
{
  "votes": [
    {"restaurantId": "J001234567", "choice": "like"},
    {"restaurantId": "J009876543", "choice": "skip"}
  ]
}
```

保存済み候補1〜5件を重複・不足なくすべて含める。入力配列の順序は問わない。

### 処理順序

1. room ID、Bearerトークン、JSON、1〜5件、空ID、重複ID、choiceを構文・ドメイン検証する。
2. トークンハッシュから現在参加者を取得し、対象roomへの所属を確認する。
3. トランザクションを開始し、対象roomをIDでロックする。
4. 保存済み候補を`position`昇順で取得し、入力店舗ID集合との完全一致を検証する。
5. 現在参加者の提出済み内容を取得する。
6. 提出済みで正規化後の内容が同一なら、保存・version更新・再集計・再抽選をせず現在状態を返す。
7. 提出済みで内容が異なるなら`VOTE_ALREADY_SUBMITTED`を返す。
8. 未提出の場合はroomが有効かつ`restaurant_voting`であることを確認する。
9. 提出レコードと正規化した全票を一括保存する。
10. 提出人数と固定参加者数を取得する。
11. 未完了ならroom versionを1増やす。
12. 全員完了なら集計し、必要な場合だけランダム選択する。
13. 結果保存、`decided`への遷移、versionの1加算を行いコミットする。

### 成功レスポンス

200 OK。

```json
{
  "data": {
    "room": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "joinCode": "7K9M2QXR",
      "status": "restaurant_voting",
      "version": 7,
      "expiresAt": "2026-11-04T12:00:00Z"
    },
    "currentParticipantId": "550e8400-e29b-41d4-a716-446655440001",
    "submitted": true,
    "submittedAt": "2026-11-03T12:00:00Z",
    "submittedParticipantCount": 1,
    "totalParticipantCount": 3,
    "participants": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "nickname": "ひかる",
        "role": "host",
        "submitted": true
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "nickname": "ひかる",
        "role": "member",
        "submitted": false
      }
    ],
    "result": null
  }
}
```

全員完了時は`room.status`が`decided`となり、保存済み候補情報を含む`result`を返す。

```json
{
  "result": {
    "restaurant": {
      "id": "J001234567",
      "name": "店舗名",
      "photoUrl": "https://...",
      "openingHours": "月〜日 11:00〜23:00",
      "closedDays": "なし",
      "dinnerBudget": "3001〜4000円",
      "access": "駅から徒歩3分",
      "stationName": "渋谷",
      "detailUrl": "https://www.hotpepper.jp/strJ001234567/",
      "coordinates": {
        "latitude": 35.658,
        "longitude": 139.7016
      },
      "source": "hotpepper"
    },
    "likeCount": 2,
    "decisionMethod": "random_tie",
    "decidedAt": "2026-11-03T12:01:00Z"
  }
}
```

店舗フィールドのnull条件、URL、座標、sourceは`restaurant-candidates.md`のAPI出力型をそのまま再利用する。Google Maps URLはこのレスポンスへ含めない。

## API 2: 店舗投票状況取得

`GET /api/v1/rooms/{roomId}/restaurant-voting`

Bearerトークン必須。

### 処理

1. room IDとBearerトークンを検証する。
2. トークンに対応する参加者が対象roomに所属することを確認する。
3. room、本人の提出有無、提出人数、参加者ごとの提出状態、確定済み結果を取得する。
4. 他参加者の店舗ごとのchoiceとセッショントークンは返さない。

200 OK。レスポンスは提出APIと同じ形で、未提出の本人は`submitted: false`、`submittedAt: null`とする。

- `restaurant_voting`では`result`はnullである。
- `decided`では保存済み`result`を必ず返す。
- 参加者は`joinedAt`、同時刻なら`id`の昇順で返す。
- `restaurant_searching`以前は候補と投票が準備できていないため409を返す。
- ポーリング間隔はフロントエンド仕様の責務とし、バックエンドへ固定値を持たせない。

## 集計とランダム決定

1. 保存済み候補それぞれの`like`数を0件も含めて作る。
2. 最大`like`数を求め、その値を持つ候補集合を`position`昇順で作る。
3. 最大値が1以上で候補が1件なら、その店舗を`most_likes`で決定する。
4. 最大値が1以上で候補が複数なら、候補内から等確率で選び`random_tie`とする。
5. 最大値が0なら全候補を選択対象とし、`random_all_skipped`とする。候補が複数なら等確率で1件を選び、候補が1件だけなら乱数を使わずその1件を選ぶ。
6. 選択結果と最大like数を保存してからroom状態を遷移する。

例：候補Aが3票、候補Bが3票、候補Cが2票なら、AとBだけを抽選対象にする。全員が全候補をskipした場合は、保存済み候補1〜5件すべてを選択対象にする。候補が1件でlike数が0の場合は抽選せずその店舗を選ぶが、全員skipの事実を示すためdecision methodは`random_all_skipped`とする。

## 状態遷移と冪等性

```text
restaurant_voting
  ├─ 一部参加者が新規提出 ─> restaurant_voting（version + 1）
  └─ 最後の参加者が新規提出 ─> decided（result作成、version + 1）

decided
  └─ 同一内容の提出再送 ─> 同じ状態を維持（version・result変更なし）
```

- 未提出者が`restaurant_voting`以外で新規提出することはできない。
- 提出済み参加者の同一内容再送は、結果確定後も成功する。
- 提出済み参加者の異なる内容はroom状態にかかわらず変更不可とする。
- 同時提出はroom行ロックで直列化し、結果作成と遷移は1回だけ行う。
- `restaurant_searching`や`restaurant_voting`へ戻す操作と再投票は提供しない。

## エラー処理とステータスコード

| 条件 | HTTP | code |
| --- | ---: | --- |
| JSON、room ID、件数、重複、空ID、choice不正 | 400 | `INVALID_RESTAURANT_VOTES` |
| トークン欠落・不正 | 401 | `UNAUTHORIZED` |
| 別roomの参加者 | 403 | `FORBIDDEN` |
| roomなし・期限切れ | 404 | `ROOM_NOT_FOUND` |
| 入力に候補外・不足・過剰な店舗IDがある | 409 | `RESTAURANT_CANDIDATES_MISMATCH` |
| 未提出者が店舗投票中以外で提出 | 409 | `RESTAURANT_VOTING_NOT_ACTIVE` |
| 状況取得時に候補店舗が未準備 | 409 | `RESTAURANT_VOTING_NOT_READY` |
| 提出済み内容と異なる再送 | 409 | `VOTE_ALREADY_SUBMITTED` |
| 結果、候補、提出数、room状態などの内部不整合 | 500 | `INTERNAL_ERROR` |
| DB・処理タイムアウト | 503 | `SERVICE_UNAVAILABLE` |
| 乱数生成失敗、想定外エラー | 500 | `INTERNAL_ERROR` |

候補外IDの存在を別の404として公開せず、候補集合不一致として一律409にする。エラーに保存済み票、他参加者のchoice、トークン、SQL、現在地、APIキーを含めない。

## タイムアウト、ログ、セキュリティ

- リクエストコンテキストを認証、DB、トランザクションへ伝播し、既存の名前付きDB操作タイムアウトを使用する。
- トークンはSHA-256ハッシュだけを検索に使用し、平文をDB、レスポンス、ログへ残さない。
- ログはrequest ID、ルート、ステータス、処理時間、内部エラー分類を対象とする。ニックネームと個別choiceは通常ログへ出さない。
- 集計時に外部APIを呼ばず、保存済み候補と票だけを使う。
- 乱数選択は候補件数を上限とする安全な整数生成を使い、剰余バイアスを持つ単純な`random % n`を使わない。

## 受け入れ条件

1. 有効な参加者が保存済み候補1〜5件への票を一括提出できる。
2. 不足、過剰、重複、候補外ID、不正choiceは1件も保存しない。
3. 待機中に本人、提出人数、総人数、参加者ごとの提出状態を取得できる。
4. 他参加者の店舗ごとのchoiceは取得できない。
5. 同一内容の再送は200で、票、submittedAt、version、結果が変化しない。
6. 異なる内容の再送は409で、保存内容が変化しない。
7. 最後の提出より前に結果が作られず、最後の提出で自動的に結果が1件作られる。
8. 単独最多は必ずその店舗、最多同数は同数候補だけ、全員skipは全候補だけから選ばれる。
9. 結果確定後は`decided`となり、再取得、再送、プロセス再起動で結果が変わらない。
10. 同時提出でも二重結果、二重遷移、versionの余分な加算が起きない。
11. 同じニックネームの参加者をparticipant IDにより別人として扱う。
12. 結果レスポンスの店舗情報が保存済み候補と一致し、Google Maps URLを含まない。
13. 既存のルーム、ジャンル投票、店舗検索、候補取得、`/api/health`が回帰しない。

## 検証方法

- Domainの可変件数検証、正規化、同一内容判定、集計候補をテーブル駆動テストで確認する。
- ServiceをRepository・Random Selectorのstubで検証し、抽選対象と選択indexを確認する。
- Handlerを`httptest`で正常、入力不正、401、403、404、409、503、500と秘密値非出力を確認する。
- 実PostgreSQLで一括保存、候補完全一致、再送比較、進捗、集計、結果、ロールバックを確認する。
- 最後の複数提出をgoroutineで実行し、結果、状態、versionの一意性を確認する。
- 実HTTPで作成、2人以上参加、ジャンル決定、候補保存、各参加者提出、待機取得、結果取得まで確認する。
- マイグレーションup、down、再up、既存ヘルスチェックを確認する。downの実行許可がない場合は未検証として明記する。
- Docker Compose内で`go test ./...`、`go vet ./...`、`go test -race ./...`を実行する。
- OpenAPI文書を更新し、既存の検証手段で構文を確認する。

## 未決定事項

None。候補全件の一括提出、提出後変更不可、最多同数時の同数候補内ランダム、全員skip時の全候補内ランダム、全員完了時の`decided`遷移はユーザー承認済み。Google Maps URLと結果画面接続は次の機能として分離する。

## 進捗

- 完了: 既存の店舗投票・待機画面、ジャンル投票API、候補店舗API、ルーム状態を確認。
- 完了: 提出API、状況取得API、Bearer認証、冪等性、進捗取得、集計、抽選、結果レスポンス、状態遷移、エラー契約を設計。
- 完了: ユーザーが実装方針を承認。
- 承認: ユーザーが本仕様を承認。
- 完了: 前提となる店舗投票Domain、DBマイグレーション、Repositoryを実装し、単体・実PostgreSQL・race検査に成功。
- 残作業: Service・HTTP Handler・ルート登録・OpenAPIの実装と検証。
- ブロッカー: None。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 97/100
- Review date: 2026-11-03
- Reasons for deductions: ポーリング間隔とフロントエンド接続、Google Maps URLを別仕様としているため、利用フロー全体の検証は本仕様だけでは完結しない（3点）。
- Revisions made: 候補完全一致の検証順、可変候補数、結果店舗情報、候補1件・同数・全員skip、再送、同時提出、状態別の状況取得、エラーコードを明文化。
