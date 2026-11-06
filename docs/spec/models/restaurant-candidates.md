# 店舗検索条件・候補店舗モデル

- Status: Implemented
- Last updated: 2026-11-06
- Related issue: None
- Related specifications: ../services/restaurant-search.md, ../services/restaurant-map-location.md, rooms-and-participants.md, genre-votes.md, ../screens/room-create-screen.md, ../screens/restaurant-vote.md
- Implementation files: ../../backend/internal/domain/room.go, ../../backend/internal/domain/restaurant_candidate.go, ../../backend/internal/repository/room.go, ../../backend/internal/repository/restaurant_search.go, ../../backend/internal/repository/postgres/room.go, ../../backend/internal/repository/postgres/restaurant_search.go, ../../backend/migrations/000004_create_room_search_conditions.up.sql, ../../backend/migrations/000004_create_room_search_conditions.down.sql, ../../backend/migrations/000005_create_restaurant_candidates.up.sql, ../../backend/migrations/000005_create_restaurant_candidates.down.sql, ../../backend/migrations/000008_add_restaurant_candidate_address.up.sql, ../../backend/migrations/000008_add_restaurant_candidate_address.down.sql

## 目的と対象範囲

ルーム作成者の現在地と検索範囲、および確定ジャンルを使って取得したHot Pepper Gourmetの候補店舗を、同じルームの全参加者へ同一内容・同一順序で提供するためのデータモデルを定義する。

## 対象外

- 駅名、住所、郵便番号から緯度・経度を求めるGeocoding
- 参加者ごとに異なる検索地点・検索範囲を持つ機能
- 店舗投票、店舗投票集計、最終店舗決定
- Hot Pepper Gourmet以外の店舗データとの統合
- 候補店舗の手動追加、削除、並び替え、再抽選
- 検索条件のルーム作成後の変更

## 前提条件

- ブラウザが現在地を取得し、ルーム作成APIへ世界測地系の緯度・経度を渡す。
- ジャンル投票結果が保存され、ルーム状態が`restaurant_searching`になっている。
- Hot Pepper Gourmet APIキーはバックエンドだけが保持し、ブラウザ、DB、レスポンス、ログへ出さない。
- 同じルームでは全参加者が同じ候補店舗へ投票する。

## エンティティと関係

```text
rooms 1 ── 1 room_search_conditions
rooms 1 ── 0..5 restaurant_candidates
genre_vote_results 1 ── 0..5 restaurant_candidates
```

### RoomSearchCondition

| フィールド | Go/TypeScript | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `roomId` | string | `UUID` | 必須 | 主キー、`rooms.id`への外部キー、削除時CASCADE |
| `latitude` | float64/number | `DOUBLE PRECISION` | 必須 | -90以上90以下、有限値 |
| `longitude` | float64/number | `DOUBLE PRECISION` | 必須 | -180以上180以下、有限値 |
| `range` | int/number | `SMALLINT` | 必須 | 1〜5。Hot Pepper Gourmet APIの`range`と同値 |
| `createdAt` | time.Time/string | `TIMESTAMPTZ` | 必須 | DB時刻 |

`range`と実距離の対応を以下に固定する。

| range | 半径 |
| ---: | ---: |
| 1 | 300m |
| 2 | 500m |
| 3 | 1,000m |
| 4 | 2,000m |
| 5 | 3,000m |

検索条件はルームとホスト参加者と同じ作成トランザクションで保存する。ルーム作成後は更新しない。ルーム状態取得APIでは検索中心の緯度・経度を返さない。

### RestaurantCandidate

| フィールド | Go/TypeScript | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `roomId` | string | `UUID` | 必須 | `rooms.id`への外部キー、削除時CASCADE |
| `restaurantId` | string | `VARCHAR(32)` | 必須 | Hot Pepper Gourmetの店舗ID |
| `position` | int/number | `SMALLINT` | 必須 | 1〜5、ルーム内で一意 |
| `name` | string | `TEXT` | 必須 | 空文字不可 |
| `address` | *string/string \| null | `TEXT` | 任意 | Hot Pepperの`address`。前後空白除去後、空なら`null` |
| `photoUrl` | *string/string \| null | `TEXT` | 任意 | HTTPS URL |
| `openingHours` | *string/string \| null | `TEXT` | 任意 | APIの`open` |
| `closedDays` | *string/string \| null | `TEXT` | 任意 | APIの`close` |
| `dinnerBudget` | *string/string \| null | `TEXT` | 任意 | `budget.average`を優先し、空なら`budget.name` |
| `access` | *string/string \| null | `TEXT` | 任意 | `mobile_access`を優先し、空なら`access` |
| `stationName` | *string/string \| null | `TEXT` | 任意 | APIの`station_name` |
| `detailUrl` | *string/string \| null | `TEXT` | 任意 | HTTPSのHot Pepper店舗詳細URL |
| `latitude` | *float64/number \| null | `DOUBLE PRECISION` | 任意 | -90以上90以下、有限値 |
| `longitude` | *float64/number \| null | `DOUBLE PRECISION` | 任意 | -180以上180以下、有限値 |
| `source` | string | `TEXT` | 必須 | `hotpepper`固定 |
| `createdAt` | time.Time/string | `TIMESTAMPTZ` | 必須 | DB時刻 |

主キーは`(room_id, restaurant_id)`、一意制約は`(room_id, position)`とする。候補店舗数は1〜5件とし、同じルームに6件以上保存しない。候補集合の件数上限はServiceでも検証し、DBの`position`制約と一意制約で誤った追加を防ぐ。

## API出力型

候補店舗はフロントエンドの`RestaurantCandidate`へ直接変換できるlower camel caseで返す。

```json
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
  "coordinates": {
    "latitude": 35.658,
    "longitude": 139.7016
  },
  "source": "hotpepper"
}
```

- APIの`id`はDBの`restaurantId`に対応する。
- 住所保存とGoogle Mapsでの利用は`../services/restaurant-map-location.md`を主仕様とする。既存行は新規マイグレーション適用後も`address = NULL`とし、バックフィルしない。
- `coordinates`は緯度と経度が両方有効な場合だけ返し、片方だけの値は保存・返却しない。
- 任意文字列が空または空白だけの場合は`null`として保存し、レスポンスでは`null`とする。
- 候補配列は`position`昇順で返す。
- `position`と検索中心の緯度・経度はレスポンスへ返さない。

## 候補抽選

1. Hot Pepper Gourmet APIから抽選母集団を最大100件取得する。1検索のジャンルは`count=100`、2検索を結合する複合ジャンルは各検索を`count=50`とする。
2. 店舗IDが空の要素と同じ店舗IDの重複を除外し、有効な店舗だけで抽選母集団を作る。
3. 母集団が1〜5件なら全件を採用する。
4. 母集団が6〜100件なら、各店舗が同じ確率になる重複なし抽選で5件を採用する。
5. 抽選された順に`position`を1から付与し、候補集合を一度だけ保存する。
6. 保存後の取得、画面再読み込み、検索API再送、プロセス再起動では再抽選しない。

公式APIの1回の取得上限が100件であるため、`results_available`が取得件数を超える場合でも追加ページは取得しない。複合ジャンルは定義順に最大50件ずつ結合して重複を除外するため、抽選母集団は常に最大100件となる。全ページ取得はAPI負荷と応答時間を抑えるため対象外とする。

乱数選択は既存の暗号学的乱数実装を再利用し、剰余バイアスのないFisher-Yates方式または同等の重複なし選択とする。テストでは選択器を差し替え、結果を決定的に検証できるようにする。

## 状態とトランザクション境界

```text
restaurant_searching
  ├─ 外部検索失敗・0件 ─> restaurant_searching
  └─ 1〜5件を保存 ─> restaurant_voting（version + 1）

restaurant_voting以降
  └─ 検索API再送 ─> 保存済み候補を返す（再検索・再抽選なし）
```

- 外部API通信中はDBトランザクションとルーム行ロックを保持しない。
- API呼出し前に認証、ルーム状態、検索条件、ジャンル結果、保存済み候補を確認する。
- API呼出し後にトランザクションを開始してルーム行をロックし、候補の有無と状態を再確認する。
- 競合リクエストが先に候補を保存していた場合、後続処理は自身の抽選結果を破棄し、保存済み候補を返す。
- 候補1〜5件の一括保存、`restaurant_voting`への遷移、versionの1加算を同じトランザクションで行う。
- 候補の部分保存、候補保存済みで`restaurant_searching`のまま、候補なしで`restaurant_voting`になる状態を許可しない。

## エラー処理と境界条件

- 非有限値、範囲外の緯度・経度、1〜5以外の検索範囲はルーム・ホスト・検索条件を1件も作らず拒否する。
- APIが0件を返した場合、候補と状態を変更せず再試行可能にする。
- 外部APIのタイムアウト、不正JSON、エラーレスポンスでは候補と状態を変更しない。
- APIレスポンス中の不正URLはそのフィールドだけ`null`にし、有効な店舗自体は候補にできる。
- 店舗IDまたは店舗名が空の店舗は候補から除外する。
- 抽選またはDB保存に失敗した場合、候補の部分保存と状態遷移をロールバックする。
- 現在地、APIキー、リクエストURLのクエリ文字列、Authorizationヘッダーをログへ記録しない。

## PostgreSQLスキーマとインデックス

- 既存マイグレーションを変更せず、新規マイグレーションを追加する。
- `room_search_conditions`は`room_id`を主キー兼外部キーとし、緯度、経度、rangeへCHECK制約を設定する。
- `restaurant_candidates`は複合主キー、`(room_id, position)`一意制約、position、座標、sourceへCHECK制約を設定する。
- 候補取得は`(room_id, position)`一意インデックスを利用してposition昇順にする。追加インデックスは作成しない。
- ルーム削除時は検索条件と候補店舗をCASCADE削除する。

## 受け入れ条件

1. 有効な現在地と検索範囲がルーム・ホストと同じトランザクションで保存される。
2. 不正な座標またはrangeではルームを含め何も保存されない。
3. APIの有効店舗が10件なら、重複なしで5件が等確率の抽選対象となる。
4. 有効店舗が1〜5件なら全件、6件以上なら5件だけ保存される。
5. 同じルームの全参加者へ同じ候補と順序が返る。
6. 再送・再取得・プロセス再起動で候補が再抽選されない。
7. 同時検索でも候補集合は1つだけ保存され、状態とversionは1回だけ更新される。
8. 外部API失敗または0件では`restaurant_searching`を維持し、再試行できる。
9. APIキーと検索中心座標がレスポンスおよびログへ出ない。
10. 候補保存と`restaurant_voting`への遷移が同一トランザクションで完了する。

## 検証方法

- 座標、range、候補フィールド、URL、重複店舗の検証をテーブル駆動テストで確認する。
- 1、5、6、10、100件の母集団と乱数選択器の境界値をユニットテストで確認する。
- 実PostgreSQLで主キー、外部キー、一意制約、CHECK制約、CASCADEを確認する。
- マイグレーションのup、down、再upを確認する。
- モックHTTPサーバーで正常、0件、タイムアウト、不正JSON、HTTPエラー、欠損フィールドを確認する。
- 同時検索を実行し、候補1集合、連番position、状態遷移1回、version更新1回を確認する。
- Docker Compose内で`go test ./...`、`go vet ./...`、必要なraceテストを実行する。

## 未決定事項

None。最大100件を抽選母集団とすること、最大5件を重複なしで抽選すること、および固定16ジャンルの検索条件はユーザー承認済み。

## 進捗

- 完了: 現行のルーム、ジャンル投票、店舗投票画面仕様を確認。
- 完了: Context7が利用できないため、Hot Pepper Gourmet公式APIリファレンスと利用案内を一次資料として確認。
- 完了: 現在地とrangeの保存、最大100件から最大5件の重複なし抽選、候補永続化、状態遷移、競合時の再抽選防止を設計。
- 完了: ユーザーが最大100件から最大5件を抽選することと、ジャンル検索条件を承認。
- 完了: 複合ジャンルは2検索を各50件とし、抽選母集団を合計最大100件に保つ方針をユーザーが承認。
- 完了: `RoomSearchCondition`の検証、DB制約、ルーム・ホストとの同時保存を実装し、単体・実PostgreSQL統合テストに成功。
- 完了: 候補店舗モデル、1〜5件保存、最大100件からの重複なし抽選、同時保存の一意確定、`restaurant_voting`遷移を実装。
- 検証: 1/5/6/10件の境界、複合検索の重複除外、再送時の非再抽選、DB制約、同時保存、CASCADEを単体・実PostgreSQL統合テストで確認。
- 検証: 000004・000005のマイグレーションupとup再実行に成功。downは実行許可が得られなかったため未検証。
- 完了: Hot Pepperの住所を任意項目として保存・取得する`000008`と候補モデルを実装。
- 検証: `000008`のup、down、再up、既存11行の`address IS NULL`、住所保存・取得の実PostgreSQL統合テストに成功。
- 残作業: マイグレーションdown検証後のStatus `Verified`化。
- ブロッカー: マイグレーションdownの実行許可なし。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 95/100
- Review date: 2026-10-31
- Reasons for deductions: 実APIを用いた検索結果品質と実運用の乱数分布は未検証。
- Revisions made: 100件超過時の抽選母集団、競合検索、再送時の非再抽選、候補0件、欠損・重複店舗、位置情報の非公開範囲を明文化。
