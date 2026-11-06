# 現在地による店舗候補検索サービス

- Status: Implemented
- Last updated: 2026-11-06
- Related issue: None
- Related specifications: ../models/restaurant-candidates.md, restaurant-map-location.md, ../models/rooms-and-participants.md, ../models/genre-votes.md, room-lifecycle.md, ../screens/room-create-screen.md, ../screens/restaurant-vote.md
- Implementation files: ../../backend/cmd/api/main.go, ../../backend/internal/domain/room.go, ../../backend/internal/domain/restaurant_candidate.go, ../../backend/internal/hotpepper/client.go, ../../backend/internal/repository/room.go, ../../backend/internal/repository/restaurant_search.go, ../../backend/internal/repository/postgres/room.go, ../../backend/internal/repository/postgres/restaurant_search.go, ../../backend/internal/service/room.go, ../../backend/internal/service/restaurant_search.go, ../../backend/internal/transport/http/room.go, ../../backend/internal/transport/http/restaurant_search.go, ../../backend/migrations/000004_create_room_search_conditions.up.sql, ../../backend/migrations/000004_create_room_search_conditions.down.sql, ../../backend/migrations/000005_create_restaurant_candidates.up.sql, ../../backend/migrations/000005_create_restaurant_candidates.down.sql, ../../api/openapi.yaml

## 目的と対象範囲

ルーム作成時に保存した現在地・検索範囲と、ジャンル投票で確定したジャンルを使ってHot Pepper Gourmet APIを検索し、最大100件の有効店舗から最大5件をランダムに選んでルームの共通候補として保存・取得するAPIを定義する。

## 対象外

- 駅名・住所のGeocodingと候補入力
- 現在地のバックエンド取得
- 店舗投票の提出、集計、最終店舗決定
- 候補の再抽選、手動変更、検索条件変更
- 100件を超える検索結果のページング取得
- WebSocket、Server-Sent Events、プッシュ通知

## 前提条件

- データ型、抽選、制約、トランザクション境界は`../models/restaurant-candidates.md`に従う。
- 認証、共通レスポンス、共通エラー、request IDは`room-lifecycle.md`に従う。
- ジャンル結果は`../models/genre-votes.md`に従い、再抽選されない。
- APIベースパスは`/api/v1`、JSONはlower camel caseとする。
- Hot Pepper Gourmet APIのベースURL、APIキー、タイムアウトは設定から注入する。APIキーを`NEXT_PUBLIC_`設定へ置かない。

## 責務分離

- HTTP Handler: Bearer認証情報とroom IDを受け取り、Service結果をHTTPレスポンスへ変換する。
- Restaurant Search Service: 権限、状態、冪等性、外部検索条件、候補変換、抽選、保存順序を制御する。
- Hot Pepper Client: リクエスト生成、タイムアウト、HTTPステータス、JSONデコード、外部エラー変換だけを担当する。
- Repository: 検索条件・ジャンル結果・保存済み候補の取得、ルーム行ロック、候補一括保存、状態遷移を担当する。
- Domain: 外部レスポンスから候補への純粋変換、入力検証、重複除外、最大5件の抽選を担当する。
- Random Selector: 既存の暗号学的乱数を再利用し、テストでは差し替え可能にする。

## ルーム作成APIの拡張

`POST /api/v1/rooms`のリクエストへ検索条件を必須追加する。

```json
{
  "nickname": "ひかる",
  "searchLocation": {
    "latitude": 35.658,
    "longitude": 139.7016
  },
  "searchRange": 3
}
```

- `searchLocation`と`searchRange`は必須とする。
- 緯度は-90〜90、経度は-180〜180の有限値とする。
- `searchRange`は1〜5の整数とする。
- 無効な場合は`400 INVALID_SEARCH_CONDITION`を返す。
- ルーム、ホスト、検索条件は同じトランザクションで作成する。
- 成功レスポンスに検索中心の緯度・経度は含めない。

ブラウザの位置情報取得拒否、未対応、タイムアウトはフロントエンドで処理し、座標なしのルーム作成リクエストを送らない。バックエンドはIPアドレスなどから位置を推測しない。

## API 1: 店舗候補検索

`POST /api/v1/rooms/{roomId}/restaurant-candidates/search`

ホストのBearerトークン必須。リクエストボディなし。

### 処理順序

1. room IDとBearerトークンを検証する。
2. 参加者が対象ルームのホストであることを確認する。
3. ルーム、有効期限、状態、保存済み候補を取得する。
4. 候補保存済みなら外部APIを呼ばず、保存済み候補を返す。
5. `restaurant_searching`以外で候補未保存なら競合エラーとする。
6. 検索条件と確定ジャンル結果を取得する。
7. ジャンルIDを承認済み検索条件へ変換し、Hot Pepper Gourmet APIを呼ぶ。
8. 外部レスポンスを検証・変換し、店舗IDで重複を除外する。
9. 有効店舗が0件なら保存・状態変更せずエラーを返す。
10. 有効店舗が1〜5件なら全件、6件以上なら重複なしで5件を抽選する。
11. トランザクションを開始し、ルーム行をロックして状態と候補を再確認する。
12. 競合処理が候補を保存済みなら自身の結果を破棄し、保存済み候補を返す。
13. 候補を一括保存し、ルームを`restaurant_voting`へ遷移してversionを1増やす。
14. コミット後、保存順の候補を返す。

### Hot Pepper Gourmet APIリクエスト

共通パラメータを以下に固定する。

| パラメータ | 値 |
| --- | --- |
| `key` | サーバー設定から取得 |
| `lat` | 保存済みlatitude |
| `lng` | 保存済みlongitude |
| `range` | 保存済み1〜5 |
| `count` | 1検索のジャンルは100、2検索の複合ジャンルは各50 |
| `start` | 1 |
| `format` | json |
| `datum` | world |

位置検索ではAPI仕様により距離順となる。`results_available`が100を超えても追加ページは取得せず、返却された最大100件を抽選母集団とする。

### ジャンル検索条件案

ジャンルコードだけで十分に区別できるジャンルはコードを使い、広いコードに複数のアプリジャンルが含まれる場合はキーワードを併用する。キーワードは店名、住所、駅名、ジャンルキャッチ、キャッチへの部分一致であり、完全な料理分類ではない点を許容する。

| アプリgenreId | Hot Pepper条件案 |
| --- | --- |
| `ramen` | `genre=G013` |
| `sushi-seafood` | `genre=G004`, `keyword=寿司`と`keyword=海鮮`を別検索してマージ |
| `yakiniku` | `genre=G008` |
| `steak-hamburg` | `genre=G005`, `keyword=ステーキ`と`keyword=ハンバーグ`を別検索してマージ |
| `curry` | `keyword=カレー` |
| `soba-udon` | `genre=G004`, `keyword=そば`と`keyword=うどん`を別検索してマージ |
| `teishoku` | `genre=G004`, `keyword=定食` |
| `italian` | `genre=G006` |
| `chinese` | `genre=G007` |
| `korean` | `genre=G017` |
| `asian` | `genre=G009` |
| `hamburger` | `keyword=ハンバーガー` |
| `okonomiyaki-takoyaki` | `genre=G016`, `keyword=お好み焼き`と`keyword=たこ焼き`を別検索してマージ |
| `nabe-shabushabu` | `genre=G004`, `keyword=鍋`と`keyword=しゃぶしゃぶ`を別検索してマージ |
| `izakaya` | `genre=G001` |
| `cafe` | `genre=G014` |

- 1ジャンルにつき外部検索は最大2回とする。
- 1検索の場合は`count=100`、2検索の場合は各検索へ同じ位置・rangeと`count=50`を指定する。
- 2検索のレスポンスは検索定義順に結合して店舗IDで重複除外し、最大100件の全体から最大5件を抽選する。
- 片方が成功し片方が失敗した場合は部分結果を採用せず、検索全体を失敗として再試行可能にする。
- コード値は実装前にHot Pepper Gourmetジャンルマスタの公式レスポンスまたは公式資料で再確認し、仕様と違う場合は実装せず仕様を再レビューする。

この表を検索条件の正とする。コード値は実装前に公式ジャンルマスタで再確認し、相違があれば実装を止めて本仕様を再レビューする。

### 成功レスポンス

新規検索と保存済み候補の再取得はいずれも200 OK。

```json
{
  "data": {
    "room": {
      "id": "uuid",
      "status": "restaurant_voting",
      "version": 5,
      "expiresAt": "2026-10-31T12:00:00Z"
    },
    "genreId": "ramen",
    "restaurants": [
      {
        "id": "J001234567",
        "name": "店舗名",
        "address": "東京都渋谷区...",
        "photoUrl": "https://...",
        "openingHours": "月〜日 11:00〜23:00",
        "closedDays": "なし",
        "dinnerBudget": "3001〜4000円",
        "access": "駅から徒歩3分",
        "stationName": "渋谷",
        "detailUrl": "https://www.hotpepper.jp/strJ001234567/",
        "coordinates": {"latitude": 35.658, "longitude": 139.7016},
        "source": "hotpepper"
      }
    ]
  }
}
```

候補は1〜5件で、保存済み`position`昇順とする。

Hot Pepperの`address`の保存、`address: string | null`のAPI契約、既存候補の扱いは`restaurant-map-location.md`を主仕様とする。

## API 2: 店舗候補取得

`GET /api/v1/rooms/{roomId}/restaurant-candidates`

対象ルームに所属する参加者のBearerトークン必須。

- `restaurant_voting`またはそれ以降で候補保存済みなら200で検索API成功時と同じレスポンスを返す。
- `restaurant_searching`で候補未保存なら`409 RESTAURANT_CANDIDATES_NOT_READY`を返す。
- 外部APIは呼ばず、再抽選もしない。
- 他ルーム参加者は403、ルームなし・期限切れは404とする。

## 状態、冪等性、同時実行

- 検索APIは保存済み候補がある場合に冪等であり、再検索・再抽選・version更新を行わない。
- 同時リクエストは外部APIを複数回呼ぶ可能性があるが、ルーム行ロックと再確認により保存される候補集合は1つだけとする。
- 外部通信中にDBトランザクションを保持しない。
- `restaurant_searching`での外部障害・0件は状態を維持し、ホストが同じAPIを再試行できる。
- `restaurant_voting`以降で候補が存在しない状態は内部整合性エラーとする。

## タイムアウト、再試行、レート制御

- 外部HTTPクライアントへ名前付きタイムアウトを設定し、リクエストコンテキストを伝播する。
- 1回のHTTPリクエスト内で自動再試行しない。利用者操作による明示的な再試行だけを許可する。
- タイムアウト値、APIベースURL、APIキー設定名は実装時に既存設定方式へ合わせる。
- 同じプロセス内の同一roomへの同時検索は可能な範囲で単一実行化するが、正しさはDBの再確認で保証する。
- APIキーを含む完全URLをエラーまたはログへ出さない。

## エラー処理とステータスコード

| 条件 | HTTP | code |
| --- | ---: | --- |
| room ID、座標、range不正 | 400 | `INVALID_SEARCH_CONDITION` |
| トークン欠落・不正 | 401 | `UNAUTHORIZED` |
| 別ルーム参加者 | 403 | `FORBIDDEN` |
| 検索APIをホスト以外が実行 | 403 | `HOST_REQUIRED` |
| ルームなし・期限切れ | 404 | `ROOM_NOT_FOUND` |
| 候補取得時に未保存 | 409 | `RESTAURANT_CANDIDATES_NOT_READY` |
| 検索できないルーム状態 | 409 | `RESTAURANT_SEARCH_NOT_ACTIVE` |
| 有効店舗0件 | 422 | `RESTAURANT_CANDIDATES_NOT_FOUND` |
| 外部APIのHTTPエラー・不正応答 | 502 | `RESTAURANT_SEARCH_FAILED` |
| 外部APIタイムアウト | 504 | `RESTAURANT_SEARCH_TIMEOUT` |
| DB・処理タイムアウト | 503 | `SERVICE_UNAVAILABLE` |
| 内部整合性、乱数、想定外エラー | 500 | `INTERNAL_ERROR` |

外部エラーのレスポンスへAPIキー、完全URL、外部レスポンス本文、現在地、内部スタックを含めない。

## クレジットと画像出典

- APIレスポンスの`source`を`hotpepper`とし、フロントエンドが「Powered by ホットペッパーグルメ Webサービス」を表示できるようにする。
- `photoUrl`を表示する画面では「画像提供：ホットペッパー グルメ」を表示する。
- バックエンドは公式店舗URLと画像URLを改変せず、安全性検証後に返す。
- クレジット表示自体は画面仕様の責務だが、正式データであることを判定できる契約を本仕様で保証する。

## 受け入れ条件

1. ホストだけが`restaurant_searching`のルームで検索を開始できる。
2. 保存済み現在地、range、確定ジャンル以外を検索条件に使わない。
3. 外部APIキーがブラウザ、DB、レスポンス、ログへ出ない。
4. 有効店舗10件なら重複なしで5件を抽選して保存する。
5. 有効店舗1〜5件は全件を保存し、0件は再試行可能なエラーにする。
6. 全参加者が保存済みの同じ候補と順序を取得できる。
7. 検索再送・取得・再起動で外部再検索と再抽選をしない。
8. 同時検索でも候補集合と状態遷移が1つだけ確定する。
9. 外部失敗時に候補を部分保存せず、`restaurant_searching`を維持する。
10. 候補保存成功時だけ`restaurant_voting`へ遷移し、versionを1増やす。
11. 公式クレジットと画像出典に必要な`source`と画像URLをフロントへ提供する。

## 検証方法

- Handlerテストで認証、権限、状態、各HTTPステータス、共通エンベロープを確認する。
- モックHTTPサーバーで検索パラメータ、URLエンコード、タイムアウト、0件、HTTPエラー、不正JSON、最大100件を確認する。
- Domainテストで変換、欠損値、重複排除、1/5/6/10/100件の抽選を確認する。
- Repository統合テストで候補一括保存、順序、冪等性、ロールバック、同時検索を確認する。
- APIキーと現在地がログ・エラーへ含まれないことを確認する。
- マイグレーションのup、down、再upを確認する。
- Docker Compose内で`go test ./...`、`go vet ./...`、必要なraceテストを実行する。
- 実API疎通はAPIキーをログ・コマンド出力へ出さない方法が準備できた場合だけ手動確認し、未実施なら明記する。

## 公式資料

- [Hot Pepper Gourmet APIリファレンス](https://webservice.recruit.co.jp/doc/hotpepper/reference.html): 緯度・経度、range、count最大100、JSON、位置検索時の並び、レスポンス項目。
- [Hot Pepper Gourmetご利用案内](https://webservice.recruit.co.jp/doc/hotpepper/guideline.html): サービスクレジットと画像出典の表示義務。

## 未決定事項

None。上記ジャンル検索条件を採用することはユーザー承認済み。

## 進捗

- 完了: 既存のルーム作成、ジャンル投票、店舗投票画面との境界を確認。
- 完了: Context7が利用できないため、Hot Pepper Gourmet公式APIリファレンス・利用案内を一次資料として確認。
- 完了: 現在地検索、最大100件から最大5件の抽選、候補保存、取得、状態遷移、冪等性、エラー契約を設計。
- 完了: ユーザーがジャンル検索条件と最大100件から最大5件を抽選する方針を承認。
- 完了: 複合ジャンルは各50件の2検索とし、抽選母集団を合計最大100件に固定する方針をユーザーが承認。
- 完了: 最初の実装単位としてルーム作成時の現在地・検索範囲検証、トランザクション保存、HTTP契約、OpenAPI更新を実装・検証。
- 完了: Hot Pepper Client、16ジャンル検索定義、最大2検索、重複除外、ランダム最大5件、候補保存、検索・取得API、冪等性、状態遷移を実装。
- 検証: Hot Pepper公式ジャンルマスタAPI version 1.30でジャンルコードを確認。実グルメサーチAPIで現在地・range・ジャンル検索の正常応答と使用フィールドを確認。
- 検証: Clientの正常・欠損・危険URL・HTTPエラー・不正JSON・APIエラー・タイムアウト、Serviceの100/50件条件・重複排除・抽選・権限・状態・再送、Handlerの成功・主要エラーを自動テストで確認。
- 検証: Docker内の`go test ./...`、`go vet ./...`、`go test -race ./...`、実PostgreSQL統合テスト、マイグレーションupと再up、OpenAPI検証に成功。
- 完了: Hot Pepperの`address`を候補へ変換し、検索・取得・決定結果APIで`address: string | null`を返す処理とOpenAPI契約を実装。
- 検証: 住所あり・欠損のクライアントテスト、Handlerテスト、実PostgreSQL統合テスト、Docker内の全Goテスト・vetに成功。
- 未実施: マイグレーションdownは実行許可が得られなかったため未検証。
- 残作業: マイグレーションdown検証後のStatus `Verified`化。フロントエンドAPI接続と店舗投票保存は別仕様。
- ブロッカー: マイグレーションdownの実行許可なし。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 95/100
- Review date: 2026-10-31
- Reasons for deductions: キーワード検索の実際の適合率と実API応答時間は未検証。
- Revisions made: 最大100件の母集団、2検索の失敗時ルール、外部通信とDBトランザクションの分離、同時検索、再送、0件、クレジット、エラーコードを明文化。
