# ジャンル投票上位3件保存・API連携

- Status: Verified
- Last updated: 2026-11-07
- Related issue: None
- Related specifications: ../models/genre-votes.md, genre-voting.md, ../screens/genre-result-rankings.md, ../screens/genre-voting-api-integration.md
- Implementation files: ../../backend/internal/domain/genre_vote.go, ../../backend/internal/repository/genre_voting.go, ../../backend/internal/repository/postgres/genre_voting.go, ../../backend/internal/service/genre_voting.go, ../../backend/internal/transport/http/genre_voting.go, ../../backend/migrations/000009_create_genre_vote_result_rankings.up.sql, ../../backend/migrations/000009_create_genre_vote_result_rankings.down.sql, ../../frontend/src/features/genre-voting-api/genre-voting-data.ts, ../../docs/api/openapi.yaml

## 目的と対象範囲

ジャンル投票の全参加者提出完了時に、既存の決定ジャンルを1位として維持しながら2位・3位も確定・保存し、既存フロントエンドの上位3件表示へ同じ順序で返す。

本仕様をジャンル順位の決定、保存、API出力、フロントエンド接続の主仕様とする。既存仕様の「1位だけを保存・返却する」という部分は、本仕様により新規確定結果について更新する。

## 対象外

- 4位以下の保存・返却・表示
- フロントエンドでの集計、並べ替え、抽選、不足順位の補完
- 決定ジャンル以外を使った店舗検索
- 投票内容、提出後変更不可、参加者固定、ルーム状態遷移の変更
- 既存結果への2位・3位のバックフィルまたはGET時の再抽選
- ジャンル結果画面のレイアウト、画像、演出、固定操作領域の変更

## 前提条件

- 固定16ジャンル、`like`数の集計、1位の決定方法は`../models/genre-votes.md`と`genre-voting.md`に従う。
- フロントエンドの表示型は`rankings: readonly { genreId: string; votes: number }[]`であり、配列順を確定順位として扱う。
- フロントエンドは受信した順位を並べ替えず、先頭3件だけを表示する。
- 既存の`genre_vote_results`は1位と決定方法を保持し、店舗検索は引き続きその1位だけを使用する。

## 期待動作と処理順序

全員の提出が完了した既存トランザクション内で次を行う。

1. 固定16ジャンルすべての`like`数を0件も含めて集計する。
2. 現行規則で1位を決定する。単独最多はそのジャンル、最多同票は同票集合から抽選、全件0票は16件から抽選する。
3. 既存の`genre_vote_results`へ1位を保存する。
4. 1位を順位候補から除外する。
5. 残りを`like`数の降順にグループ化する。
6. 同票グループから順位へ入るジャンルは、既存の安全な乱数選択器で重複なしに抽選する。
7. 1位を含む3件を順位1〜3として保存する。固定16ジャンルのため新規結果は常に3件保存する。
8. 結果と順位の保存後にルームを`restaurant_searching`へ遷移し、すべてを同一トランザクションでコミットする。

同票でないグループには乱数を使用しない。乱数生成に失敗した場合は、提出、1位、順位、状態遷移、version更新をすべてロールバックする。

## 同票と0票の扱い

- 1位の抽選規則と`decisionMethod`は変更しない。
- 2位・3位の得票数が同じ場合は、その同票グループ内の順序を抽選する。
- 3位の境界に同票候補が複数ある場合は、そのグループから3位へ入る候補を抽選する。
- 正の票を得たジャンルが3件未満でも0票ジャンルを順位対象に含め、3位まで確定する。
- 全16ジャンルが0票の場合は、既存規則で1位を抽選し、残り15件から重複なしで2位・3位を抽選する。
- 表示される1〜3位の順序または採用に抽選が影響した場合、`rankingTieBreakApplied`を`true`とする。表示外だけの同票は`true`の理由にしない。

## 状態と状態遷移

```text
genre_voting
  ├─ 一部参加者が提出 ─> genre_voting（順位なし）
  └─ 最後の参加者が提出 ─> 1位＋上位3件を保存 ─> restaurant_searching

restaurant_searching以降
  └─ GET・同一PUT再送 ─> 保存済みの同じ1位・順位を返す（再集計・再抽選なし）
```

既存結果に順位行がない場合は1位を維持し、`rankings: []`を返す。GET時に2位・3位を生成しない。

## データ要件

### PostgreSQL

新規マイグレーション`000009`で`genre_vote_result_rankings`を追加する。共有済みマイグレーションは変更しない。

| 列 | 型 | 必須 | 制約 |
| --- | --- | --- | --- |
| `room_id` | `UUID` | 必須 | `genre_vote_results(room_id)`への外部キー、削除時CASCADE |
| `rank` | `SMALLINT` | 必須 | 1〜3、`room_id`との複合主キー |
| `genre_id` | `VARCHAR(40)` | 必須 | 固定16ジャンルのいずれか、ルーム内で一意 |
| `like_count` | `INTEGER` | 必須 | 0以上 |
| `tie_break_applied` | `BOOLEAN` | 必須 | 当該表示順位の確定に抽選が影響したか |

- 主キーは`(room_id, rank)`、一意制約は`(room_id, genre_id)`とする。
- 追加インデックスは作成しない。
- `rankingTieBreakApplied`は保存済み上位3件の`tie_break_applied`の論理和として返す。
- downマイグレーションは追加テーブルだけを削除する。

### Go

表示順位を次の意味で表す。API固有の`votes`という名前はHTTP変換層で使用し、ドメイン・DBでは`LikeCount`を使用する。

```text
GenreVoteRanking
- RoomID string
- Rank int16
- GenreID string
- LikeCount int
- TieBreakApplied bool
```

`GenreVotingState`の確定結果へ保存済み順位を含める。順位なしの既存結果は空スライスとする。

## API出力

既存のR5 `PUT /api/v1/rooms/{roomId}/genre-votes`とR6 `GET /api/v1/rooms/{roomId}/genre-voting`で、`data.result`へ次を追加する。

```json
{
  "genreId": "ramen",
  "likeCount": 5,
  "decisionMethod": "most_likes",
  "decidedAt": "2026-11-07T00:00:00Z",
  "rankings": [
    {"genreId": "ramen", "votes": 5},
    {"genreId": "sushi-seafood", "votes": 3},
    {"genreId": "yakiniku", "votes": 3}
  ],
  "rankingTieBreakApplied": true
}
```

- APIには`rank`を返さず、`rankings`の配列順を1〜3位とする。
- 得票数のJSON名は既存フロントエンド型に合わせて`votes`とする。
- 新規結果の`rankings`は3件、既存結果は空配列とする。
- 新規結果では`rankingTieBreakApplied`を真偽値で返す。既存結果では`false`とする。
- `rankings[0].genreId`は`result.genreId`、`rankings[0].votes`は`result.likeCount`と一致する。
- 配列は得票数の降順、ジャンルID重複なしとする。同票内は保存済み抽選順を維持する。
- 結果確定前の`result`は従来どおり`null`であり、順位フィールドを外側へ返さない。

## フロントエンド接続

- `GenreVotingSnapshot.result`へ`rankings`と`rankingTieBreakApplied`を追加する。
- API解析境界では、`rankings`が0件または3件、既知ジャンル、重複なし、安全な非負整数、参加者数以下、得票数降順であることを検証する。
- 3件の場合は先頭のジャンル・票数が既存結果と一致することを検証する。
- APIの`{genreId, votes}`を既存`GenreResultData.rankings`へそのまま渡す。
- `resultPresentation`は順位を生成・ソートせず、保存済み順序と`rankingTieBreakApplied`をそのまま渡す。
- 既存の`GenreResultRankings`、名称・画像解決、同票説明、上位3件制限を再利用する。

## エラー処理と境界条件

- 集計に固定16ジャンル以外、負数、欠損があれば内部不整合として全体をロールバックする。
- 保存対象が3件でない、1位と順位先頭が不一致、順位・ジャンル重複、得票数逆順なら保存しない。
- DB取得時に順位が1〜3の連番でない、1〜2件だけ存在する、新規結果なのに順位が欠損する場合は内部不整合とする。
- 既存結果の順位0件だけは後方互換として許可する。
- 順位行を参加者一覧の取得SQLへ直接JOINして参加者件数を増幅させない。順位は別クエリで取得する。
- 乱数選択器が範囲外indexを返した場合は内部不整合としてロールバックする。
- 個別参加者のchoice、乱数値、セッショントークンをレスポンスまたはログへ出さない。

## 受け入れ条件

1. 新規に確定するジャンル投票で1〜3位が3件保存され、APIへ同じ順序で返る。
2. 1位は既存の決定ジャンル・票数・決定方法と変わらず、店舗検索も1位だけを使用する。
3. APIの順位要素がフロント型と同じ`{genreId, votes}`で返る。
4. 異なる票数は得票数降順となり、同票がない部分で乱数を使用しない。
5. 1位同票、2・3位同票、3位境界同票、上位3件同票、全件0票で重複なしの順位が保存される。
6. 抽選が表示順位へ影響した場合だけ`rankingTieBreakApplied`が`true`になる。
7. GET、同一PUT再送、プロセス再起動、複数参加者の取得で順位が変わらない。
8. 結果・順位保存、状態遷移、version更新が同一トランザクションで完了する。
9. 既存結果は再抽選されず、既存1位と`rankings: []`が返る。
10. フロントエンドが順位を生成・並べ替えず、既存上位3件UIへ実API順位を表示する。

## 検証方法

- Domainテストで異なる票数、1位同票、2・3位同票、3位境界同票、上位3件同票、全件0票、乱数失敗・範囲外を確認する。
- Serviceテストで1位との一致、順位3件、抽選対象、保存順、同一再送の非再抽選を確認する。
- Repository統合テストで順位制約、3件保存・取得、結果とのCASCADE、同時最終提出、ロールバックを確認する。
- Handler・OpenAPIテストで`rankings`、`votes`、`rankingTieBreakApplied`、既存結果の空配列を確認する。
- フロントエンド解析テストで正常6ケース、欠損、1・2件、4件、未知・重複ID、逆順、先頭不一致、不正票・フラグを確認する。
- 実API結合テストで複数参加者が同じ順位を取得し、再送・再取得で不変であることを確認する。
- マイグレーションのup、down、再up、再実行`no change`をDocker開発DBで確認する。
- Docker Compose内でfrontendのlint、typecheck、関連テスト、build、backendの`go test ./...`、`go vet ./...`、必要なraceテストを実行する。

## 未決定事項

None。ユーザー承認により、フロントエンドの`{genreId, votes}`と配列順へAPIを合わせ、0票を含め常に3位まで確定し、既存結果はバックフィルしない。

## 進捗

- 完了: 現行のジャンル投票Domain、Service、Repository、DB、R5/R6、フロントエンド順位型・表示・API解析境界を確認。
- 完了: 現行バックエンドは1位だけを保存し、フロントエンドは確定済み上位3件の表示受け口を持つ差分を確認。
- 完了: フロントエンドへ合わせたAPI形、同票抽選、0票、既存結果、トランザクション、マイグレーション案をユーザーが承認。
- 完了: `genre_vote_result_rankings`、Domain、Repository、Service、Handler、OpenAPI、フロントエンド解析・表示接続を実装。新規結果は3件、既存結果は空配列として共存する。
- 検証: Domain・Service・Handler・Repository統合・フロント解析テストで、異なる票数、各同票境界、全skip、乱数エラー、既存結果を確認。
- 検証: Docker Composeでbackend `go test ./...`・`go vet ./...`・`go test -race ./...`、frontend lint・typecheck・build、実API結合5ケース、OpenAPI Validatorに成功。
- 検証: マイグレーションのup・down・再up・再実行`no change`に成功。検証DBで新規5結果に順位3件、既存8結果に順位0件が共存することを確認。
- 残作業: なし。
- ブロッカー: None。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 97/100
- Review date: 2026-11-07
- Reasons for deductions: 実運用中の既存結果は順位なしであり、新旧結果が混在する期間の表示は空順位として扱うため3点減点。
- Revisions made: フロント型と同じJSON名、配列順契約、1位一致、0票を含む3件、同票境界、既存結果、別クエリ取得、原子的保存を明文化。
