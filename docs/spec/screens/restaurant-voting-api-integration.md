# 店舗検索・投票・待機・結果の実API連携

- Status: Implemented
- Last updated: 2026-11-04
- Related issue: None
- Related specifications: restaurant-vote.md, restaurant-vote-waiting.md, restaurant-result.md, genre-voting-api-integration.md, ../services/restaurant-search.md, ../services/restaurant-voting.md, ../models/restaurant-candidates.md, ../models/restaurant-votes.md
- Implementation files: frontend/src/features/restaurant-voting-api/, frontend/src/features/restaurant-vote/restaurant-vote-screen.tsx, frontend/src/features/restaurant-vote/use-restaurant-vote.ts, frontend/src/features/genre-voting-api/genre-voting-entry.tsx, frontend/src/app/restaurant-vote/page.tsx, frontend/src/app/restaurant-vote-waiting/page.tsx, frontend/src/app/restaurant-result/page.tsx

## 目的と対象範囲

承認済みの実装方針に基づき、実ルームの店舗候補準備、候補表示、投票一括提出、参加者の提出待機、決定結果表示、Google Maps導線を既存バックエンドAPIへ接続する。既存の店舗カード、投票アニメーション、待機画面、結果画面、Google Maps URL生成、ルームセッション保存を再利用し、開発デモと実ルームを分離する。

対象画面は`/restaurant-vote`、`/restaurant-vote-waiting`、`/restaurant-result`とする。実ルームURLは`room=UUID`だけで状態を復元し、セッショントークン、店舗ID、ジャンルIDをURLへ保存しない。既存の`demo=1`では従来のモックを使用し、API通信しない。

## 対象外

- バックエンド、DB、マイグレーション、OpenAPI、APIレスポンスの変更
- Google Maps API、Geocoding API、Places API、APIキーの導入
- 店舗候補、票数、勝者のフロントエンド独自生成
- 店舗検索条件、抽選件数、投票集計、同数・全員skip規則の変更
- アカウント間・端末間でのセッショントークン共有
- WebSocket、Server-Sent Events、Push通知
- PWA、共通デザイン、既存アニメーション時間、Hot Pepperクレジット表記の変更

## 前提条件と確認済み事項

- ルーム作成・参加時のセッションが既存`sessionStorage`または同一タブのメモリに保存されている。
- バックエンドの店舗候補検索・取得、店舗投票提出・状態取得APIは実装済みである。
- 店舗検索開始はホストだけが実行でき、保存済み候補の再取得と検索再送は冪等である。
- 店舗投票は保存済み候補すべてへの`like`または`skip`を一括提出する。
- 各参加者は各候補へ必ず1票提出するため、決定店舗のマッチ率分母には`totalParticipantCount`を使用できる。
- 決定結果には保存済み店舗情報、`likeCount`、`decisionMethod`、`decidedAt`が含まれる。
- Google Maps URLは既存`createGoogleMapsUrl()`が座標から生成する。Google公式Maps URLsの`https://www.google.com/maps/search/?api=1&query=緯度,経度`形式を使用し、APIキーは不要である。

## APIと認証

すべて既存のroomセッションに含まれるBearerトークンを使用し、`cache: no-store`、既存リクエストタイムアウト、AbortSignalを適用する。

| 操作 | API | 利用者 |
| --- | --- | --- |
| 候補検索・保存 | `POST /api/v1/rooms/{roomId}/restaurant-candidates/search` | ホストのみ |
| 保存済み候補取得 | `GET /api/v1/rooms/{roomId}/restaurant-candidates` | 全参加者 |
| 店舗投票提出 | `PUT /api/v1/rooms/{roomId}/restaurant-votes` | 全参加者 |
| 店舗投票状況・結果取得 | `GET /api/v1/rooms/{roomId}/restaurant-voting` | 全参加者 |

成功応答は既存`data`エンベロープを明示型と実行時検証で受け取る。room ID、joinCode、currentParticipantIdは保存済みセッションと一致しなければ成功扱いにしない。未知のジャンル、店舗、room状態、decision method、不正URL、不正座標、人数不整合をモックや既定値で補完しない。

## 状態と画面遷移

```text
restaurant_searching
  ├─ ホスト: 候補GETで未準備 → 検索POST → 候補取得
  └─ メンバー: 候補GETをポーリング → 候補取得

restaurant_voting
  ├─ 本人未提出 → /restaurant-vote
  └─ 本人提出済み → /restaurant-vote-waiting

decided + resultあり → /restaurant-result
```

- 各画面へ直接アクセス・再読み込みした場合も、候補APIと店舗投票状態APIを根拠に正しい画面へ`replace`する。
- `room`と`demo`が併記された場合は実ルームを優先し、セッション欠落や不正roomをデモへフォールバックしない。
- `restaurant_searching`より前の状態は店舗画面を表示せず、ジャンル投票フローまたは状態確認案内へ戻す。
- 確定結果取得後はポーリングを停止する。人数だけを見て結果画面へ進まず、必ず保存済み`result`を確認する。

## 店舗候補の準備

1. `room=UUID`を検証し、同一roomのセッションを読み込む。
2. 候補GETを実行する。
3. 200なら`genreId`と1〜5件の候補を検証し、`position`に対応するレスポンス順を維持して表示する。
4. 候補未準備の409で本人がホストなら、1リクエストだけ検索POSTを実行する。Strict Mode、再描画、連打で重複POSTしない。
5. 候補未準備の409で本人がメンバーなら、既存`ROOM_CONFIG.pollInterval`の2秒後にGETを再実行する。
6. ホストの検索POSTが一時失敗した場合は自動連続再送せず、エラーと明示的な再試行操作を表示する。
7. 422は該当店舗なし、502は外部サービス応答失敗、504は検索タイムアウトとして、利用者向けメッセージと再試行を表示する。

前回通信完了後に次回を予約し、候補GET・検索POSTを並列重複させない。非表示中は停止し、表示復帰、online、focusで再確認する。離脱時はtimer、listener、fetchを解除し、cleanup後の応答を無視する。

## 店舗投票と下書き

- API候補を既存`RestaurantVoteScreen`へ渡し、既存のボタン、カード切替、reduced-motion対応を変更しない。
- 回答はroom ID、participant ID、候補ID列に紐づくsessionStorage下書きとして保存する。候補集合・順序が変わった下書きは復元しない。
- 部分回答は候補順に一致する有効prefixだけ復元する。店舗ID、choice、件数が不正な下書きは破棄し、推測しない。
- 全候補回答後は回答を封印し、メモリと利用可能ならsessionStorageに保持して1回だけPUTする。1カードごとに送信しない。
- 成功応答は本人の`submitted=true`を確認して待機画面へ進む。提出済みなら下書きを削除する。
- 応答消失、409、503など保存結果が不明な場合は状態GETで確認する。提出済みなら再PUTせず待機・結果へ進み、未提出かつ`restaurant_voting`なら同じ内容だけを明示再試行する。
- 保存失敗後に回答内容を変更させない。異なる内容の再提出を発生させない。
- ストレージ利用不可の場合は同一マウント中のメモリへ保持し、再読み込みでは復元できない旨を通知する。

## 待機・ポーリング

- 状態GETの`participants[].submitted`を既存`WaitingParticipant`へ変換する。同じニックネームでもparticipant IDで別人として扱う。
- 2秒間隔で、前回GET完了後に次回GETを予約する。非表示中は停止し、表示復帰、online、focusで即時再確認する。
- 一時通信失敗は最後の正常状態を保持し、古い情報であることと再取得操作を表示する。
- 400、401、403、404、不正応答はポーリングを停止する。古いroom versionで表示を巻き戻さない。
- `room.status=decided`かつ`result`ありを確認した時だけ結果画面へ`replace`する。

## 結果表示とGoogle Maps

- `result.restaurant`を既存店舗結果画面へ渡す。店舗ID、名前、任意情報、source、座標はAPI値だけを使用する。
- 候補GETの`genreId`を既存16ジャンル定義と照合し、結果画面のジャンル表示へ渡す。URLやラーメン既定値から補完しない。
- `votes.likes=result.likeCount`、`votes.total=totalParticipantCount`として既存マッチ率計算を使用する。0票と未取得を区別する。
- `decisionMethod`と`decidedAt`は実行時検証するが、勝者をフロントで再計算しない。
- 有効座標は既存`createGoogleMapsUrl()`へ渡し、新しいバックエンドフィールドやAPIキーを追加しない。座標欠損・不正時は既存の無効ボタンと説明を表示する。
- 通常実ルームではモック注記を表示しない。`demo=1`の既存モック結果・プレビューは維持する。

## エラー処理と境界条件

- セッション欠落: 「作成・参加したタブを開いてください」とホーム導線を表示し、トークンをURLへ要求しない。
- 候補0件・6件以上、重複ID、不正source、不正座標: `INVALID_RESPONSE`として表示し、投票させない。
- 別room・別参加者応答: `INVALID_RESPONSE`として停止する。
- 候補取得済みでも投票状態が前段階: 状態確認案内を表示し、投票を送らない。
- 提出済みの投票画面直接アクセス: 待機または結果へ移動し、回答UIを表示しない。
- 未提出の待機・結果画面直接アクセス: 投票画面へ戻す。
- 決定済み結果の再取得: 同じ保存済み結果を表示し、演出やMaps URL生成以外の副作用を繰り返さない。
- エラー本文、ログ、URL、画面にBearerトークン、現在地検索条件、他参加者のchoiceを表示しない。

## 受け入れ条件

1. ホストが候補未準備時に検索を1回開始し、メンバーは保存済み同一候補を取得できる。
2. 1〜5件のAPI候補を順番どおり表示し、全候補への回答を1回のPUTで提出できる。
3. 部分回答、封印回答、再読み込み、送信失敗、応答消失から異内容を送らず復元・再確認できる。
4. 参加者ごとの提出状態が待機画面へ反映され、最後の提出後に全参加者が同じ決定結果へ進む。
5. 単独最多、同数ランダム、全員skipのいずれもAPIの保存済み結果だけを表示する。
6. 結果画面に決定店舗、ジャンル、マッチ率、店舗情報が表示され、有効座標でGoogle Mapsを開ける。
7. 座標欠損時はMaps操作を無効化し、店舗名や住所から座標を推測しない。
8. 401、403、404、409、422、500、502、503、504、不正応答、一時オフラインで適切な停止・保持・再試行が行われる。
9. 画面直接アクセス、再読み込み、非表示復帰、同じニックネーム、Strict Modeで二重検索・二重提出・誤遷移が起きない。
10. 開発デモ、既存店舗カード、待機演出、結果表示、Google Maps URL単体テストが回帰しない。

## 検証方法

- パーサー、候補検証、状態遷移、下書き、回答封印、Maps入力変換をテーブル駆動テストで確認する。
- APIクライアントをfetch stubで検証し、Bearer、method、body、AbortSignal、エラーコード、応答照会付き再試行を確認する。
- hook/entryをStrict Mode相当、非表示、online、focus、unmount、古いversion、通信失敗で検証する。
- Docker Compose内でfrontend lint、typecheck、全フロントテスト、buildを実行する。
- 検証専用ルームを新規作成し、実APIで2人以上、候補検索、候補一致、1人提出待機、全員提出、決定結果、同一再送を確認する。既存ルームやDBを削除・初期化しない。
- 320/375/390/430/700/1024px、横向き、短い画面、文字200%、reduced-motionで既存レイアウトと操作を確認する。
- OpenAPI・バックエンド・DB・マイグレーション・環境ファイルに差分がないことをGitで確認する。

## 未決定事項

None。ホストが候補検索を開始し、メンバーは候補GETをポーリングすること、全候補の一括提出、結果GETを根拠とする遷移、既存フロントでのMaps URL生成はユーザー承認済み。

## Progress

- 完了: 最新mainから`feature/restaurant-voting-api-integration`を作成。
- 完了: 店舗検索・投票API、既存3画面、ジャンル投票API連携、セッション保存、Google Maps URL生成を照合。
- 完了: 結果画面だけの接続では実フローに到達できない差異を確認し、検索・投票・待機・結果を1機能として接続する方針をユーザーが承認。
- 完了: API、状態遷移、検索担当、ポーリング、下書き、再送、結果変換、Maps責務、エラー、検証方法を定義。
- 完了: 候補・投票応答の実行時検証、Bearer付きAPIクライアント、ホスト検索・メンバー待機、2秒ポーリング、非表示・online・focus・unmount処理を実装。
- 完了: 候補集合付き下書き、部分回答復元、全件封印、一括PUT、保存結果GET照会、同一内容再試行、提出後下書き削除を実装。
- 完了: 実roomの投票・待機・結果Entry、ジャンル結果から店舗検索への導線、実参加者表示、決定店舗・マッチ率・既存Maps URL表示を実装。既存`demo=1`を維持。
- 検証: 新規単体6件、既存フロントエンド66件、ジャンルAPI単体14件に成功。実API指定なしの既存ジャンル結合3件はskipとして区別。
- 検証: 検証専用ルームで候補検索、2人の同一候補、1/2待機、全員提出、決定結果、Maps URL、同一再送非変更を実APIで確認。既存ジャンル実API結合3件も現在地必須入力へ更新して成功。
- 検証: Docker Compose内のlint、typecheck、production buildに成功。build中の外部取得で一時的な`socket hang up`再試行があったが最終成功。
- 未検証: ブラウザー画面は利用可能なブラウザーsurfaceがなかったため、実UIの画面遷移、レスポンシブ、文字200%、実機Mapsアプリ引継ぎを未検証。
- 残作業: 上記画面検証後のStatus `Verified`化、コミット。
- ブロッカー: ブラウザー操作環境なし。実装・自動検証上のブロッカーはなし。
- 関連Issue・PR・コミット: 本変更コミット。

## Self-Review

- Score: 97/100
- Review date: 2026-11-04
- Reasons for deductions: 実機でのGoogle Mapsアプリ引継ぎと公開環境の複数端末検証は別途必要（3点）。
- Revisions made: 結果画面単独では到達不能なため候補準備・投票提出・待機を同一範囲に追加し、ホストとメンバーの検索責務、下書き集合一致、応答消失時のGET照会、状態別の直接アクセスを明文化。
