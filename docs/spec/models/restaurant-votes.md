# 店舗投票モデル

- Status: Implemented
- Last updated: 2026-11-03
- Related issue: None
- Related specifications: restaurant-candidates.md, rooms-and-participants.md, ../services/restaurant-voting.md, ../screens/restaurant-vote.md, ../screens/restaurant-vote-waiting.md
- Implementation files: ../../backend/internal/domain/restaurant_vote.go, ../../backend/internal/repository/restaurant_voting.go, ../../backend/internal/repository/postgres/restaurant_voting.go, ../../backend/migrations/000006_create_restaurant_votes.up.sql, ../../backend/migrations/000006_create_restaurant_votes.down.sql

## 目的と対象範囲

`restaurant_voting`状態のルームで、固定済みの候補店舗1〜5件に対する各参加者の`like`または`skip`を一括保存する。全参加者の提出完了時に最多`like`の店舗を1件決定し、最多同数または全店舗0票では承認済みの規則に従ってランダム選択するためのデータモデルを定義する。

## 対象外

- 店舗投票画面・待機画面とAPIの接続
- 1店舗を評価するたびの逐次保存、投票途中の復元
- 提出後の投票変更、取り消し、管理者修正
- 店舗候補の追加、削除、並び替え、再検索、再抽選
- Google Maps URL生成と結果画面
- WebSocket、Server-Sent Events、プッシュ通知

## 前提条件

- ルーム、参加者、認証、参加者固定、状態遷移は`rooms-and-participants.md`に従う。
- 候補店舗は`restaurant-candidates.md`に従って同じルームへ1〜5件保存済みで、ルーム状態は`restaurant_voting`である。
- ジャンル投票開始後は参加者を追加・削除しないため、現在の参加者集合を店舗投票の提出対象者集合とする。
- 同一ニックネームを許可し、ニックネームではなく参加者IDとセッショントークンで個人を識別する。

## エンティティと関係

```text
rooms 1 ── * participants
rooms 1 ── 1..5 restaurant_candidates
participants 1 ── 0..1 restaurant_vote_submissions
restaurant_vote_submissions 1 ── 1..5 restaurant_votes
rooms 1 ── 0..1 restaurant_vote_results
restaurant_candidates 1 ── * restaurant_votes
restaurant_candidates 1 ── 0..1 restaurant_vote_results
```

### RestaurantVoteSubmission

参加者が、そのルームに保存された候補店舗すべてへの投票を提出済みであることを表す。

| フィールド | Go | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `roomId` | string | `UUID` | 必須 | 参加者と同じルーム。複合主キー、複合外部キーに使用 |
| `participantId` | string | `UUID` | 必須 | 複合主キー。`participants`への複合外部キー、削除時CASCADE |
| `submittedAt` | time.Time | `TIMESTAMPTZ` | 必須 | DB時刻。初回提出後は変更しない |

主キーは`(room_id, participant_id)`とする。`participants`へ`UNIQUE (room_id, id)`を追加し、`(room_id, participant_id)`から複合外部キーを設定する。これにより、参加者と提出対象ルームの一致をDBでも保証する。

### RestaurantVote

| フィールド | Go | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `roomId` | string | `UUID` | 必須 | 提出・候補店舗と同じルーム |
| `participantId` | string | `UUID` | 必須 | `restaurant_vote_submissions`への複合外部キー、削除時CASCADE |
| `restaurantId` | string | `VARCHAR(32)` | 必須 | `restaurant_candidates`への複合外部キー、削除時CASCADE |
| `choice` | RestaurantVoteChoice | `TEXT` | 必須 | `like`または`skip` |

主キーは`(room_id, participant_id, restaurant_id)`とする。1提出につき、そのルームの候補店舗IDを重複・不足なく各1件含めることは、Serviceの事前検証と同一トランザクション内の一括挿入で保証する。

### RestaurantVoteResult

| フィールド | Go | PostgreSQL | 必須 | 制約 |
| --- | --- | --- | --- | --- |
| `roomId` | string | `UUID` | 必須 | 主キー、`rooms.id`への外部キー、削除時CASCADE |
| `restaurantId` | string | `VARCHAR(32)` | 必須 | 同じルームの`restaurant_candidates`への複合外部キー |
| `likeCount` | int | `INTEGER` | 必須 | 0以上、参加者数以下 |
| `decisionMethod` | RestaurantDecisionMethod | `TEXT` | 必須 | 下記3値 |
| `decidedAt` | time.Time | `TIMESTAMPTZ` | 必須 | DB時刻 |

`RestaurantDecisionMethod`は以下とする。

- `most_likes`: 最大`like`数の候補が1件だった。
- `random_tie`: 最大`like`数が1以上で、最大候補が複数だったため、その候補集合からランダム選択した。
- `random_all_skipped`: 全候補の`like`数が0だったため、保存済み候補すべてからランダム選択した。

## 入力、正規化、出力

- 入力件数は対象ルームの保存済み候補数と完全に一致させる。
- 入力には保存済み候補店舗IDを重複・不足なく各1件含める。入力配列の順序は問わない。
- `choice`は`like`または`skip`だけを許可する。
- DB保存と同一内容の再送判定では、候補の`position`昇順に正規化する。
- 結果確定前は`result`をnullableとして扱い、架空の店舗や暫定結果を返さない。
- 他参加者の店舗ごとのchoiceはAPIレスポンスへ返さない。

## 集計とランダム選択

1. 保存済み候補1〜5件それぞれについて、`like`数を0件も含めて作る。
2. 最大`like`数を求め、その値を持つ候補集合を候補の`position`昇順で作る。
3. 最大値が1以上で最大候補が1件なら、乱数を使わず、その店舗を`most_likes`で決定する。
4. 最大値が1以上で最大候補が複数なら、その候補集合から等確率で1件を選び`random_tie`とする。
5. 最大値が0なら保存済み候補すべてを選択対象とし、`random_all_skipped`とする。候補が複数なら等確率で1件を選び、候補が1件だけなら乱数を使わずその1件を選ぶ。
6. 選択結果を`restaurant_vote_results`へ一度だけ保存し、API再送、取得、プロセス再起動で再抽選しない。

乱数選択は既存の暗号学的乱数によるindex選択器を再利用し、単純な剰余による偏りを持たせない。テストでは選択器を差し替え、抽選対象と選択indexを決定的に検証する。乱数生成失敗時は提出、結果、状態遷移を含むトランザクション全体をロールバックする。

## PostgreSQLスキーマとインデックス

既存マイグレーションを変更せず、新しいup/downマイグレーションを追加する。

- `participants`へ`UNIQUE (room_id, id)`制約を追加する。
- `restaurant_vote_submissions(room_id, participant_id, submitted_at, PRIMARY KEY(room_id, participant_id))`
- `restaurant_votes(room_id, participant_id, restaurant_id, choice, PRIMARY KEY(room_id, participant_id, restaurant_id))`
- `restaurant_vote_results(room_id PRIMARY KEY, restaurant_id, like_count, decision_method, decided_at)`
- `restaurant_vote_submissions`は参加者へ、`restaurant_votes`は提出と候補店舗へ、`restaurant_vote_results`はルームと候補店舗へ外部キーを設定する。
- choice、decision method、非負like countへCHECK制約を設定する。
- 提出人数は`restaurant_vote_submissions`の主キー先頭`room_id`で数えるため、追加インデックスを作成しない。
- 店舗別集計は`restaurant_votes`の主キー先頭`room_id`を利用し、`choice = 'like'`で候補ごとに集計する。最大20人×5候補のため、choice単独インデックスは作成しない。
- ルーム削除時は提出、票、結果をCASCADE削除する。

## 状態とトランザクション境界

```text
restaurant_voting
  ├─ 一部参加者が新規提出 ─> restaurant_voting（version + 1）
  └─ 最後の参加者が新規提出 ─> decided（結果作成、version + 1）

decided
  └─ 提出済み参加者の同一内容再送 ─> decided（変更・再抽選なし）
```

新規提出は次を単一トランザクションで行う。

1. 対象ルームを`SELECT ... FOR UPDATE`でロックする。
2. 保存済み候補と現在参加者の既存提出を取得する。
3. 同一内容の再送なら保存、version更新、集計、抽選をせず現在状態を返す。
4. 異なる内容の再送なら競合として拒否する。
5. 未提出なら候補集合との完全一致と`restaurant_voting`状態を確認する。
6. 提出レコードと全票を一括保存する。
7. 提出人数と固定参加者数を比較する。
8. 未完了ならroom versionだけを1増やす。
9. 全員完了なら集計、必要時のランダム選択、結果保存、`decided`への遷移、versionの1加算を行う。

1回の新規提出につきversionは正確に1増やす。最後の提出でも、提出と状態遷移を合わせて1回だけ増やす。同時提出はルーム行ロックで直列化し、結果作成と状態遷移を1回だけ行う。

## エラー処理と境界条件

- 0件、候補数と異なる件数、重複店舗ID、候補外店舗ID、空ID、不正choiceは1件も保存せず拒否する。
- 別ルームの参加者または候補店舗を使用した票はService検証と複合外部キーで拒否する。
- 提出レコードだけ、または候補数未満の票だけをコミットしない。
- 提出済みの同一内容は成功、異なる内容は変更不可の競合とする。
- 未提出者は`restaurant_voting`以外で新規提出できない。
- 参加者0人、候補0件または6件以上、提出人数超過、結果とroom状態の矛盾は内部整合性エラーとしてロールバックする。
- 結果のlike数が参加者数を超える状態を内部整合性エラーとする。

## 受け入れ条件

1. 各参加者の候補1〜5件への票が一括保存され、部分保存されない。
2. 同じニックネームでもparticipant IDごとに別の提出として扱われる。
3. 候補の不足、重複、別ルームまたは不明な店舗ID、不正choiceを保存しない。
4. 同一内容の再送で票、submittedAt、結果、versionが変化しない。
5. 異なる内容の再送で保存済み内容が変化しない。
6. 全参加者の提出前は結果が存在せず、最後の提出で結果が1件だけ作られる。
7. 単独最多、最多同数、全件0票の3条件でdecision methodと選択対象が正しい。
8. 抽選結果が保存され、取得、再送、プロセス再起動で変化しない。
9. 同時提出でも二重結果、二重遷移、versionの余分な加算が起きない。
10. 結果保存と`decided`への遷移が同一トランザクションで完了する。
11. DB制約でも参加者、票、候補店舗のroom一致が保証される。

## 検証方法

- Domainの候補数可変入力、正規化、重複、不足、候補外ID、不正choiceをテーブル駆動テストで確認する。
- 集計候補算出を単独最多、2件以上の同数、全件0票、候補1件で確認する。
- ServiceをRepositoryと乱数選択器のstubで検証し、抽選対象、非抽選条件、再送、状態遷移を確認する。
- 実PostgreSQLで主キー、複合外部キー、CHECK制約、CASCADE、一括保存とロールバックを確認する。
- 最後の複数提出をgoroutineで実行し、結果1件、遷移1回、各提出につきversion更新1回を確認する。
- マイグレーションup、down、再upを確認する。downの実行許可がない場合は未検証として明記し、Statusを`Verified`にしない。
- Docker Compose内で`go test ./...`、`go vet ./...`、`go test -race ./...`を実行する。

## 未決定事項

None。候補全件の一括提出、提出後変更不可、全員完了時の自動集計、最多同数時の同数候補内ランダム、全員skip時の全候補内ランダム、結果永続化はユーザー承認済み。

## 進捗

- 完了: 既存の店舗候補、ジャンル投票、店舗投票・待機画面、ルーム状態仕様を確認。
- 完了: 候補1〜5件への一括提出、冪等性、集計、抽選、複合外部キー、トランザクション境界を設計。
- 完了: ユーザーが実装方針を承認。
- 承認: ユーザーが本仕様、およびDB・Domain・Repositoryの実装案を承認。
- 完了: 店舗投票、結果、参加者別提出状態のDomain型、候補順への正規化、同一内容比較、最多候補とdecision methodの算出を実装。
- 完了: `000006`で提出・票・結果テーブル、choice・decision method・like数のCHECK制約、参加者・候補店舗との複合外部キー、CASCADEを実装。
- 完了: Repositoryへルーム行ロック、候補・提出取得、一括保存、人数取得、like数集計、結果保存、version更新、`decided`遷移、状態取得を実装。
- 検証: Docker Compose内の`go test ./...`、`go vet ./...`、`go test -race ./...`に成功。
- 検証: 実PostgreSQLで2人×3候補の保存・集計・結果取得、同じニックネームの別参加者、候補順の正規化、不正choiceと別ルーム参加者・候補のロールバック、複合外部キーを確認。
- 検証: マイグレーションupと再実行の`no change`に成功。downは実行許可がないため未検証。
- 残作業: Service・HTTP API・OpenAPIの実装と検証。down検証後のStatus `Verified`化。
- ブロッカー: マイグレーションdownの実行許可なし。
- 関連Issue・PR・コミット: 本変更コミット。

## Self-Review

- Score: 97/100
- Review date: 2026-11-03
- Reasons for deductions: フロントエンドAPI接続と結果画面は別仕様のため、本仕様だけでは画面遷移全体を検証できない（3点）。
- Revisions made: 可変候補数の完全一致、同じニックネームの識別、別ルーム混入防止、同時提出、version加算、再送時非再抽選、全員skipの抽選母集団を明文化。
