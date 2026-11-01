# ジャンル投票・待機・結果の実API連携

- Status: Implemented
- Last updated: 2026-11-01
- Related issue: None
- Related specifications: genre-vote.md, genre-vote-waiting.md, genre-result.md, frontend-ui-integration.md, ../services/genre-voting.md, ../models/genre-votes.md
- Implementation files: frontend/src/features/genre-voting-api/, frontend/src/features/room/room-api.ts, frontend/src/features/room/room-genre-entry.tsx, frontend/src/features/genre-vote/{genre-vote-screen.tsx,use-genre-vote.ts}, frontend/src/features/genre-result/{result-data.ts,genre-result-screen.tsx}, frontend/src/app/{genre-vote,genre-vote-waiting,genre-result}/page.tsx

## 目的・承認・範囲

今回の明示的な実API接続依頼を承認根拠とする。既存R5/R6を利用し、複数参加者の16回答を一括提出し、全員に同じサーバー決定結果を表示する。既存の写真/スワイプ/戻る/暗転/待機/結果演出と固定ヘッダー/下部領域を再利用する。

## 前提・調査・差異

- PR18はマージ済み。GitHub main/ローカルmain/HEADは6d88938。既に希望ブランチfeature/genre-voting-api-integration、作業ツリーはクリーン。切替/コミット/プッシュ/PR作成は行わない。
- docs/api/openapi.yaml、services/genre-voting.md、Gin Handler/Service/Repository/Domainを照合。R5はPUT、R6はGET、Bearer認証とdataエンベロープ、固定16ID/like|skip、同内容200/異内容409が一致する。
- サービス仕様のR5説明用JSONはtotal=3に対してparticipantsが2件だが、実装は一覧件数との一致を検証する。フロントは実装/スキーマに従い、不整合な応答は成功扱いにしない。API仕様書は変更しない。
- 従来frontend-ui-integration.mdの実ルームS07〜09未接続表示だけを本仕様へ更新する。店舗機能の未接続と開発demoの制限は維持する。
- Context7のReact公式useEffect資料で、AbortControllerだけでなくcleanup後の応答無視・Strict Modeの再実行対策を確認した。

## 対象外

バックエンド/DB/マイグレーション/API仕様/Docker/環境変数/PWA/README/依存関係の変更、独自集計/抽選/全順位の生成、店舗API接続、トークンのURL化。実APIテストはローカル開発環境に新規作成した検証ルームだけを使い、既存データを初期化/削除しない。

## API・データ・状態遷移

- R5: PUT /api/v1/rooms/{UUID}/genre-votes、body={votes:[{genreId,choice}×16]}。1スワイプごとには送信しない。既存roomセッションのBearerを使用する。
- R6: GET /api/v1/rooms/{UUID}/genre-voting、cache:no-store。room/currentParticipantId/submitted/submittedAt/submittedParticipantCount/totalParticipantCount/participants[{id,nickname,role,submitted}]/resultを明示型と実行時検証で受け取る。
- resultはnullまたは{genreId,likeCount,decisionMethod,decidedAt}。methodはmost_likes/random_tie/random_all_skipped。本人・ルーム一致、ID/人数/提出状態/結果とroom状態の整合性を検証し、未知IDをラーメン等で補完しない。
- 既存URLへroom=UUIDを引き継ぐ。genre_votingで本人未提出→S07、本人提出済みで結果なし→S08、後続状態restaurant_searching/restaurant_voting/decidedでresultあり→S09。lobbyは既存ルーム待機へ戻す。別画面への直接アクセス/再読み込みもR6を基準に正規化する。
- roomとdemoの併記では実ルームを優先し、不正roomでもデモへフォールバックしない。既存の開発環境demo=1/詳細プレビューは従来どおり動作し、本番では利用不可。

## S07・保存・再試行・再読み込み

- 既存GenreVoteScreen/hookへ互換の初期回答・変更通知・完了時回答の受け渡しだけ追加し、スワイプ/確定/undo/暗転の計算と時間は変更しない。
- 回答はroom+participantごとのsessionStorage下書きへ保存する。部分回答は同じ順序の有効なprefixだけ復元する。R6で提出済みなら下書きを破棄し、編集画面を出さない。途中回答の永続化APIは追加しない。
- 16件確定後は回答を封印し、メモリと可能ならsessionStorageに保持して一括送信する。保存中はボタン/再送のrefロックで二重送信を防ぐ。Strict Modeで追加PUTを発生させない。
- 成功はsubmitted=trueの応答を検証してS08へ移動し、S08はR6で結果を判定する。保存失敗は16回答を保持して再試行UIを表示し、編集/変更提出は許可しない。
- 応答消失・409等ではR6で保存状況を確認する。再試行前もR6を取得し、すでにsubmittedなら再PUTせず正しい画面へ進む。未提出/投票中が確認できた場合だけ同じ16票を再送する。
- 認証/権限/期限切れ/不正レスポンスは自動再送しない。エラーと再確認/ホーム導線を示し、トークンを勝手に消去/URLへ追加しない。ストレージ不能でもメモリの回答を維持し、再読み込み復元不可を通知する。
- 封印後の再読み込みはまずR6を取得し、未提出なら同じ回答を明示的に再送できる。下書きが壊れていれば推測せず再投票する。

## S08・ポーリング・エラー

- R6の実参加者submittedを既存WaitingParticipantへ変換する。人数/アバター/残人数/バーは同じ入力に連動するが、結果遷移はフロントの人数計算では決めない。
- 既存ROOM_CONFIG.pollInterval（2秒）を使用し、前回通信完了後に次回を予約して重複GETを防ぐ。非表示中は停止し、表示/online/focusで再確認。離脱時はtimer/listener/fetchを解除し、cleanup後の応答を無視する。
- 一時通信失敗では最後に取得した表示を保持し、古い情報とエラー/再試行を通知する。401/403/404/不正応答はポーリングを止める。古いversionで表示を巻き戻さない。確定結果の取得後は不要な取得を停止する。

## S09・表示

上位3位の表示受け口と同票順位の共有方式の依頼案は[genre-result-rankings.md](genre-result-rankings.md)で追加する。R6の現契約/パーサー/アダプターは未変更で、実ルームはrankings=[]のまま。下記の順位未提供という実API上の制約は継続する。

既存16定義から写真/名称を表示し、結果演出/ハートと下部操作を維持する。実結果の投票結果カードは決定ジャンルのlikeCount/参加人数と決定方法を日本語で表示する。順位データを生成せず、全順位がAPI未提供である点は本仕様と完了報告へ記録する。利用者画面へAPI内部事情を表示しない。既存モックのrankings表示は互換維持する。店舗API未接続のため実結果のCTAから架空店舗へは進めず、準備中の案内を維持する。再取得で同じ結果の演出を繰り返さない。

## 受け入れ条件・検証方法

1. 異なる参加者セッションで作成/参加/開始/16票PUT/1of2待機/全員完了/同一結果を実APIで確認する。全skip・同数の決定はサーバーの返却値だけに従う。
2. 下書き/封印/再読み込み、保存失敗・応答消失・401/403/404/409/503、二重送信・同一再送・異内容拒否・直接アクセスを検証する。
3. パーサー/URL・画面選択/下書き/通信・再送処理の意味のあるフロントテストを追加する。既存テストとDocker lint/typecheck/buildを実行する。
4. 320/375/390/430/768/1024px、短い画面・横向き・文字200%、既存デモ/写真/スワイプ/演出/reduced-motionを確認する。実機/公開URLの未検証は区別する。
5. Git差分で禁止領域無変更を確認する。

## 未決定事項

今回の接続に必要な未決定事項なし。全順位を表示するにはサーバーから全ジャンルのgenreId/likeCountと順位の契約が必要で、別作業として担当者へ報告する。

## Progress

- 完了：Git/PR18/最新main/既存UI/API仕様/実装/状態遷移/16IDを照合。
- 完了：R5/R6のBearer認証、型/実行時パーサー、ルーム/本人照合、端末内下書き/封印、同一内容だけの一括提出とR6照会付き再試行を実装。
- 完了：R6を根拠とするS07/S08/S09/lobbyへの正規化、待機の2秒ポーリング/非表示停止/離脱cleanup/応答逆転防止、実参加者表示、実結果の写真/名称/票数/決定方法表示を実装。順位は生成せず、既存demoの順位表は維持。
- 完了：Docker Composeで最終lint・typecheck・build成功。フロントエンド70テスト（既存53、新規単体14、ローカル実API結合3）がすべて成功、skip/failなし。既存MODULE_TYPELESS_PACKAGE_JSON警告のみ。Node24.22.2のregisterHooksをテスト限定で使用し、Next.jsのimport形式/tsconfig/依存パッケージは変更していない（Context7経由のNode公式module.mdで確認）。
- 完了：実API結合テストで検証専用ルームだけを新規作成。2人の提出前/1of2待機/全員完了/同一結果、同一PUT再送でversion/submittedAt/result不変、変更PUTの409 VOTE_ALREADY_SUBMITTED、無認証401、同時提出、同票抽選/全skip抽選の同一確定値を確認。既存ルームの編集/DB初期化/データ削除は実施していない。
- 完了：ブラウザーの独立した2タブの参加者セッションで、ホスト作成→招待参加→開始→各16回答→実際の1/2待機→両者のイタリアン/2票/most_likes表示を確認。検証ルームのバックエンドログにはPUTが2件だけで、1カードごとの送信なし。独立ブラウザーでの確認とは区別する。
- 完了：途中3件で再読み込み後4件目/進捗3に復元。提出済みのS07直接アクセスはS08へ、未提出のS09直接アクセスはS07へ、確定後のS08直接アクセスと再読み込みは同じS09へ復帰。URLはroom UUIDだけを引き継ぎ、トークンを含めない。
- 完了：通信断/503/401/403/404/409、応答消失後の保存照会、同内容の明示再試行、不正応答/別ルーム/別参加者、AbortSignal、ストレージ不能時のメモリ保持を新規単体テストで確認。実ブラウザーのオフライン切替による送信失敗画面と連打操作の再現は未検証（UI refロックと既存投票ロックは実装済み）。
- 完了：S09実結果は320/375/390/430/768/1024px、844×390、390×320で横はみ出しなし、スクロール後のheaderTop=0、固定領域下端=可視高、本文末尾への到達を確認。途中のリサイズ/スクロール描画中の値では判定せず、描画後の再測定結果をgenre-api-layouts.jsonへ保存した。
- 完了：同じ表示部品を使うS07/S08は開発demoで上記の幅/横向き/短画面を確認し、S07は390/430pxを個別再確認。demoの16投票→待機→明示操作でモック結果、既存順位表/写真/演出が動作。roomとdemo併記時も実ルーム優先で、参加情報がないタブへモック結果を表示しない。
- 完了：既存のスワイプ判定/暗転計算/写真定義/待機と結果のアニメーション本体/共通UI/PWAは無変更。投票hookの変更は初期回答の復元と完了/変更通知だけ。実結果のカードは票数と日本語の決定方法だけを表示し、API内部事情の文章は利用者向けUIへ追加しない。
- 未検証：独立した別ブラウザー/実機/公開URL。接続ブラウザーはIABのみで、Chrome用ブラウザー制御は利用不可。今回の複数人UI確認は独立タブの別セッション。文字200%・OSの軽減設定切替・実タッチのAPIフローは今回再検証していない。既存の文字拡大対応/軽減CSS/Pointer処理は維持している。
- 対象外：店舗候補検索/投票への正式接続と全順位表。実結果の店舗ボタンは既存の準備中案内のままで、架空店舗へ遷移しない。バックエンドからの全16ジャンルの票数・順位/同順位の契約追加は担当者へ確認する。
- Git確認：作業開始時のクリーン状態から26ファイルを変更/追加。git diff --check成功。バックエンド/DB/Docker/環境変数/API仕様/PWA/README/依存関係/他画面に差分なし。共有履歴/既存PRへの変更なし。
- StatusはImplemented。実装と主要検証は完了したが、上記未検証までVerifiedと扱わない。
- Blockers: 実装上なし。別ブラウザー/実機の環境確認は残る。
- コミット/プッシュ/PR作成：なし。

## 検証コマンド

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run typecheck
docker compose exec -T frontend npm run build
docker compose exec -T -e GENRE_VOTING_API_BASE=http://localhost:3000 frontend node --experimental-strip-types --test src/features/genre-vote/*.test.mjs src/features/genre-vote-waiting/*.test.mjs src/features/genre-result/*.test.mjs src/features/restaurant-vote/*.test.mjs src/features/restaurant-result/*.test.mjs src/features/room/*.test.mjs src/features/ui-flow/*.test.mjs src/features/genre-voting-api/*.test.mjs
git diff --check
```

GENRE_VOTING_API_BASEは上記テストプロセスだけに設定し、環境変数ファイル/Compose設定は変更しない。未指定なら実API3テストはskipし、単体テストだけを実行する。今回の記録は明示指定して70件すべてを実行した結果。

## 変更ファイル一覧（26ファイル）

- `docs/spec/screens/frontend-ui-integration.md`
- `docs/spec/screens/genre-result.md`
- `docs/spec/screens/genre-vote-waiting.md`
- `docs/spec/screens/genre-vote.md`
- `docs/spec/screens/genre-voting-api-integration.md`
- `frontend/src/app/genre-result/page.tsx`
- `frontend/src/app/genre-vote-waiting/page.tsx`
- `frontend/src/app/genre-vote/page.tsx`
- `frontend/src/features/genre-result/genre-result-screen.tsx`
- `frontend/src/features/genre-result/result-data.ts`
- `frontend/src/features/genre-vote/genre-vote-screen.tsx`
- `frontend/src/features/genre-vote/use-genre-vote.ts`
- `frontend/src/features/genre-voting-api/genre-api.module.css`
- `frontend/src/features/genre-voting-api/genre-api.test.mjs`
- `frontend/src/features/genre-voting-api/genre-draft.ts`
- `frontend/src/features/genre-voting-api/genre-voting-api.ts`
- `frontend/src/features/genre-voting-api/genre-voting-data.ts`
- `frontend/src/features/genre-voting-api/genre-voting-entry.tsx`
- `frontend/src/features/genre-voting-api/genre-voting.integration.test.mjs`
- `frontend/src/features/genre-voting-api/genre-voting.test.mjs`
- `frontend/src/features/genre-voting-api/room-genre-vote.tsx`
- `frontend/src/features/genre-voting-api/test-fixtures.mjs`
- `frontend/src/features/genre-voting-api/test-runtime.mjs`
- `frontend/src/features/genre-voting-api/use-genre-voting.ts`
- `frontend/src/features/room/room-api.ts`
- `frontend/src/features/room/room-genre-entry.tsx`

## 画面確認・保存記録

- 実フローの入口：http://localhost:3000/home-preview 。作成・参加したタブのsessionStorageを使用する。閉じた別タブへトークンをコピーして復元する機能は追加しない。
- 開発デモ：http://localhost:3000/genre-vote?demo=1 。APIへ投票を送らない。
- 保存先：C:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/
- genre-api-waiting-desktop.jpg：実APIで1/2人が提出した待機状態。
- genre-api-result-390.jpg：390pxのCSS viewportを指定して取得した実API結果の確認時画像。取得後、票数カード内のAPI事情を説明する一文だけを削除した。写真/ジャンル/票数/決定方法/固定ボタンは同じ。
- genre-api-layouts.json：S09実結果の描画後8条件の配置確認。リポジトリ外に保存しGit差分へ含めない。

## Self-Review

- Score: 96/100
- Review date: 2026-11-01
- Reasons for deductions: 実機/公開URLでの最終確認とバックエンド全順位提供は別作業（4点）。
- Revisions made: 不明な保存結果のR6照会、封印と下書き、Strict Mode二重送信、ポーリング終了/復元、実結果とモックの表示境界を明記。
