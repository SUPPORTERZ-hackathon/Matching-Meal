# ジャンル投票モデル

- Status: Verified
- Last updated: 2026-10-30
- Related issue: None
- Related specifications: ../services/genre-voting.md, rooms-and-participants.md, ../screens/genre-vote.md, ../screens/genre-vote-waiting.md
- Implementation files: ../../backend/internal/domain/genre_vote.go, ../../backend/internal/repository/genre_voting.go, ../../backend/internal/repository/postgres/genre_voting.go, ../../backend/migrations/000003_create_genre_votes.up.sql, ../../backend/migrations/000003_create_genre_votes.down.sql

## 目的と対象範囲

参加者固定済みのルームで、各参加者が16ジャンルへ行った`like`または`skip`を一括保存し、全員の提出完了後にジャンルを1つ決定するためのデータモデルを定義する。最多`like`が同数の場合は同数候補からランダムに1件を選び、全員が全件`skip`した場合は16ジャンルすべてからランダムに1件を選ぶ。

## 対象外

- フロントエンドからAPIを呼ぶ処理と待機画面の本番データ接続
- Hot Pepper Gourmet APIによる店舗検索
- 店舗候補、店舗投票、店舗決定
- 投票途中の1件ずつの保存、途中再開、提出後の変更
- 投票の匿名化、ユーザーアカウント、退出・追放

## 前提条件

- ルーム、参加者、セッショントークン、状態遷移は`rooms-and-participants.md`に従う。
- 投票を受け付ける新規提出時のルーム状態は`genre_voting`である。
- ジャンル投票開始後は参加者を追加・削除しないため、現在の参加者集合を提出対象者集合とする。
- フロントエンドの16ジャンルIDと順序を固定契約としてバックエンドにも定義し、表示名からIDを生成しない。

## エンティティと関係

```text
rooms 1 ── * participants
participants 1 ── 1 genre_vote_submissions
genre_vote_submissions 1 ── 16 genre_votes
rooms 1 ── 0..1 genre_vote_results
```

## 固定ジャンル

以下のIDと順序を正とする。

1. `ramen`
2. `sushi-seafood`
3. `yakiniku`
4. `steak-hamburg`
5. `curry`
6. `soba-udon`
7. `teishoku`
8. `italian`
9. `chinese`
10. `korean`
11. `asian`
12. `hamburger`
13. `okonomiyaki-takoyaki`
14. `nabe-shabushabu`
15. `izakaya`
16. `cafe`

Goでは順序付きのreadonly相当スライスと検証用集合を同じ定義から構築する。TypeScript側の`frontend/src/features/genre-vote/genres.ts`とID・順序が一致することをテストする。

## GenreVoteSubmission

参加者が16件をまとめて提出済みであることを表す。

| フィールド | Go | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `participantId` | string | `UUID` | 必須 | 主キー、`participants.id`への外部キー、削除時CASCADE |
| `submittedAt` | time.Time | `TIMESTAMPTZ` | 必須 | DB時刻、初回提出時から変更しない |

## GenreVote

| フィールド | Go | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `participantId` | string | `UUID` | 必須 | `genre_vote_submissions.participant_id`への外部キー、削除時CASCADE |
| `genreId` | string | `VARCHAR(40)` | 必須 | 固定16IDのいずれか |
| `choice` | GenreVoteChoice | `TEXT` | 必須 | `like`または`skip` |

主キーは`(participant_id, genre_id)`とする。1提出につき固定16IDが各1件であることは、API検証と同一トランザクションによる一括挿入で保証する。DB単体では件数16をCHECK制約にできないため、Repository結合テストでも保証する。

## GenreVoteResult

| フィールド | Go | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `roomId` | string | `UUID` | 必須 | 主キー、`rooms.id`への外部キー、削除時CASCADE |
| `genreId` | string | `VARCHAR(40)` | 必須 | 固定16IDのいずれか |
| `likeCount` | int | `INTEGER` | 必須 | 0以上 |
| `decisionMethod` | GenreDecisionMethod | `TEXT` | 必須 | 下記3値 |
| `decidedAt` | time.Time | `TIMESTAMPTZ` | 必須 | DB時刻 |

`GenreDecisionMethod`は以下とする。

- `most_likes`: 最大`like`数の候補が1件だった。
- `random_tie`: 最大`like`数が1以上で、最大候補が複数だったためランダム選択した。
- `random_all_skipped`: 全ジャンルの`like`数が0だったため、16件からランダム選択した。

## PostgreSQLスキーマとインデックス

新規マイグレーションを追加し、既存マイグレーションは変更しない。

- `genre_vote_submissions(participant_id PRIMARY KEY, submitted_at)`
- `genre_votes(participant_id, genre_id, choice, PRIMARY KEY(participant_id, genre_id))`
- `genre_vote_results(room_id PRIMARY KEY, genre_id, like_count, decision_method, decided_at)`
- 提出人数をルーム単位で数えるクエリは`genre_vote_submissions`から`participants`へ主キー結合し、既存`participants.room_id`インデックスを利用する。
- ジャンル集計は`genre_votes`から`genre_vote_submissions`、`participants`を結合し、対象roomだけを`choice = 'like'`でGROUP BYする。
- 固定ジャンル、choice、decision_method、非負like_countへCHECK制約を設定する。

## 状態とトランザクション境界

新規提出は以下を単一トランザクションで行う。

1. 対象ルームを`SELECT ... FOR UPDATE`でロックする。
2. 既存提出の有無と内容を確認する。
3. 未提出なら提出レコードと16票を保存する。
4. 提出人数と固定参加者数を比較する。
5. 未完了ならルームversionだけを1増やす。
6. 全員完了なら集計、ランダム選択、結果保存、`restaurant_searching`への遷移、versionの1加算を同じトランザクションで行う。

1回の新規提出につきversionは正確に1増やす。最後の提出では、提出と状態遷移を合わせて1回だけ増やす。同じ内容の再送では保存・抽選・version更新を行わない。

## ランダム選択

- 最大`like`数を持つ候補集合を作る。
- 集合が1件なら乱数を使用しない。
- 集合が複数なら暗号学的乱数を使い、`[0, 候補数)`の各indexを等確率で選ぶ。
- 最大値が0なら候補集合は固定16ジャンルすべてで、`random_all_skipped`とする。
- 最大値が1以上の同数なら`random_tie`とする。
- 抽選結果は`genre_vote_results`へ一度だけ保存し、API再送・取得・プロセス再起動で再抽選しない。
- 乱数生成失敗時はトランザクション全体をロールバックし、結果や状態を部分保存しない。
- テストでは選択器を差し替え、候補集合、境界index、非抽選条件を決定的に検証する。

## 入力・出力と検証

- リクエストは16件ちょうどであること。
- 固定16ジャンルが重複・不足なく各1件含まれること。入力順は問わない。
- `choice`は`like`または`skip`だけを許可する。
- DB保存と同一内容判定ではジャンルの固定順に正規化する。
- 他参加者の個別choiceはAPIレスポンスへ返さない。
- 結果確定前は結果をnullableとして扱い、架空のジャンルを返さない。

## エラーと境界条件

- 16件未満・超過、重複、未知ID、不正choiceは保存前に拒否する。
- 提出レコードだけ、または16件未満の票だけがコミットされないよう一括トランザクションとする。
- 同一参加者の同一内容再送は成功扱い、異なる内容は変更不可として競合扱いにする。
- 同時に最後の提出が来てもルーム行ロックにより結果は1件だけ作成する。
- 参加者0人、提出人数が参加者数を超える、結果とroom状態が矛盾する状態は内部整合性エラーとしてロールバックする。

## 受け入れ条件

1. 各参加者の16票が一括保存され、部分保存されない。
2. 同じニックネームでもparticipant IDごとに別の提出として扱われる。
3. 同一内容の再送で票、結果、versionが増えない。
4. 異なる内容の再送が保存済み内容を変更しない。
5. 全参加者の提出前は結果が存在せず、最後の提出で結果が1件だけ作られる。
6. 単独最多、最多同数、全件0票の3条件でdecision methodと選択対象が正しい。
7. 抽選結果が保存され、その後の取得や再送で変化しない。
8. 結果確定と`restaurant_searching`への遷移が同じトランザクションで完了する。

## 検証方法

- 固定16ジャンル、入力正規化、重複・不足・未知IDをテーブル駆動テストで検証する。
- 集計を純粋関数として単独最多、2件以上の同数、全件0票、選択器エラーで検証する。
- 実PostgreSQLで外部キー、主キー、CHECK制約、CASCADE、16件一括保存とロールバックを検証する。
- 最後の提出を複数goroutineで実行し、結果1件、遷移1回、version更新1回を確認する。
- マイグレーションのup、down、再upを確認する。
- `docker compose exec backend go test ./...`、`go vet ./...`、`go test -race ./...`を実行する。

## 未決定事項

None。`restaurant_searching`状態の追加を含め、最多同数と全員skip時のランダム選択、提出後変更不可、一括提出、全員完了時の自動遷移はユーザー承認済み。

## 進捗

- 完了: 既存の固定16ジャンル、投票UI型、ルーム状態・参加者固定、待機画面仕様を確認。
- 完了: 2段階投票、ジャンル最多同数時の同数候補内ランダム、全員skip時の全16候補内ランダムをユーザーと合意。
- 完了: テーブル、制約、トランザクション、抽選結果の永続化、受け入れ条件を定義。
- 推奨: 外部API呼出し前に`restaurant_voting`へ進めないため、中間状態`restaurant_searching`を追加する。
- 承認: ユーザーが`restaurant_searching`状態の追加を承認。
- 完了: 固定16ジャンル、入力正規化、提出・票・結果モデル、CHECK制約、トランザクション保存、集計候補算出を実装。
- 完了: Go公式`crypto/rand`、pgx v5公式ドキュメント、PostgreSQL 17公式ロック仕様を一次情報として確認して実装。
- 検証: Domainテストで16ジャンルとフロントエンド定義の一致、不足・重複・未知ID・不正choice、同数候補、全件0票を確認。
- 検証: 実PostgreSQLで2人の同時提出、32票・結果1件、`restaurant_searching`遷移、version、同一再送、異内容再送を確認。
- 検証: マイグレーションのup、down、再upに成功。
- 残作業: なし。
- ブロッカー: なし。
- 関連Issue・PR・コミット: 本変更コミット。PR未作成。

## Self-Review

- Score: 97/100
- Review date: 2026-10-30
- Reasons for deductions: フロントエンドとの型共有は別言語のため自動生成せず、ID一致テストで担保する。実運用の乱数分布評価は対象外。
- Revisions made: 全員skipを最多0票の同数として統一し、抽選結果の永続化、再送時非再抽選、version更新回数、DBで保証できない16件条件を明文化。
