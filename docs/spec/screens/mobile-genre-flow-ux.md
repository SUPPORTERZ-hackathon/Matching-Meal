# スマートフォンのジャンル投票・結果待機UX

- Status: Implemented
- Last updated: 2026-11-07
- Related issue: None
- Related specifications: genre-vote.md, genre-result.md, room-create-screen.md, room-join-screen.md, genre-voting-api-integration.md, ../services/restaurant-search.md
- Implementation files: frontend/src/features/genre-vote/genre-vote.module.css, frontend/src/features/room-create/room-create.module.css, frontend/src/features/genre-result/, frontend/src/features/genre-voting-api/genre-voting-entry.tsx

## 目的と範囲

実機で確認された3件をフロントエンドだけで改善する。S-07のカード上の意図しない縦スクロール、ルーム作成の文字入力時の自動拡大、S-09で参加者にも表示されるホスト専用の店舗検索操作を対象とする。共通ヘッダー、既存投票判定・保存・集計・演出・API契約は変更しない。

## 対象外

バックエンド、DB、Docker、環境変数、PWA、結果ランキング、店舗候補生成条件、投票ロジック、前ブランチのヘッダー余白変更は対象外。実機のOS設定変更も行わない。

## 前提と再現条件

- `.genreCard` は現在 `touch-action: pan-y pinch-zoom` で、カード上の単指縦パンをブラウザーへ許可している。Pointer Eventsの縦軸は既存の `detectAxis` により非投票となる。
- ルーム作成のニックネームと駅検索は共通 `.field input[type="text"]` で14px。参加フォームは親の16pxを継承し、QRの招待URL入力は1rem（16px）。viewportは拡大禁止を指定していない。
- 実ルームのS-09はR6の確定結果を表示するが、結果取得ポーリングは確定後に停止する。R3 `GET /api/v1/rooms/{roomId}` は参加者にも許可され、`restaurant_searching`、`restaurant_voting`、`decided`を返す。ホストがR7検索に成功し候補保存をコミットした後に `restaurant_voting` となる。R3はホストの検索失敗理由を共有しない。

## 期待動作と状態遷移

### S-07カード

カードだけ `touch-action: pinch-zoom` とする。単指の横・斜め・縦パンはページをスクロールさせず、既存Pointer Eventsへ渡す。縦軸だけでは投票を確定しない。ピンチズームとカード外の縦スクロールは維持する。中断時の復帰、2枚の画像、暗転、戻る、ボタン、16件完了を変更しない。

### 文字入力

ルーム作成の2つの文字入力の計算済みfont-sizeを16px以上にする。既存の52px高、余白、駅候補の選択とキーボード操作は維持する。参加フォームとQR URL入力は16px以上であることを再確認する。viewportの最大倍率・手動拡大可否は変更しない。

### S-09参加者待機

実セッションの `participant.role` が `host` なら既存の固定下部CTAと操作をそのまま表示する。`member` なら同じ固定下部領域へ非操作の状態表示を置き、店舗検索POSTを呼ばない。基本文言は「ホストが店舗を探しています」「お店の投票開始までお待ちください」。開発用demoとプレビューは既存CTAを維持する。

参加者のS-09表示中のみR3を既存2秒間隔で再取得する。`restaurant_searching` では待機、`restaurant_voting` では `/restaurant-vote?room=UUID`、`decided` では `/restaurant-result?room=UUID` へ1回だけreplace遷移する。後続画面で候補・投票結果を既存APIから取得する。R3の一時的通信失敗時は最後の状態とエラーを表示して再取得し、認証・無効ルームなどの終端エラーは案内する。検索中にホストがR7で失敗してもR3には理由がないため、参加者は検索中表示を維持する。候補準備前には遷移しない。

## 入出力・エラー・境界条件

- 入力: 既存Pointer Events、文字入力、R6から復元した参加セッション、R3のルーム状態。セッショントークンは既存APIクライアントでBearerに送り、URLには載せない。
- 出力: 既存16票とルーム遷移先。参加者用の下部表示はボタン・リンク・タブフォーカス・クリック処理を持たず、`role="status"`で読み上げる。
- 320/375/390/430px、短い画面、長い文言でも横スクロールや固定領域の重なりを起こさない。結果写真・ランキング・発表演出は維持する。
- ルーム情報を失った場合、R3が失敗した場合、`expired` の場合は勝手に店舗画面へ移動しない。

## 受け入れ条件と検証方法

1. CSSとブラウザー操作でカード上の単指縦パンを止め、縦操作では投票数が増えず、左右操作とボタン・戻るが維持されることを確認する。カード外の通常スクロールとピンチズーム指定も確認する。
2. すべての文字入力欄の計算済みfont-sizeが16px以上で、駅候補・固定ボタン・文字の見切れに影響がないことを確認する。iPhone Safariの自動拡大は実機で別途確認する。
3. host/member/demoの結果下部表示を分けて確認する。R3の検索中、候補準備完了、決定済み、一時通信失敗、終端エラーで表示と遷移をテストし、ゲストから店舗検索POSTを発行しない。
4. 指定幅の表示、Docker Composeでlint・typecheck・既存および追加テスト・build、`git diff --check`を確認する。隔離DBがなければ実API書き込み検証は行わず未検証と記録する。

## 未決定事項

なし。R3には検索失敗理由が含まれないため、参加者にホスト側のR7失敗を表示する機能は今回のAPI契約では実現できず、残課題として報告する。

## Progress

- 完了: 作業開始時のGit作業ツリーはクリーンで、現ブランチとmainは同じHEAD。前ブランチの変更は取り込まず、関連仕様・実コード・R3/R7状態遷移を確認した。
- 完了: ジャンルカードだけ単指パンによるブラウザースクロールを禁止し、ピンチズーム指定を維持した。ルーム作成のニックネーム・駅検索入力を16pxにした。実ルームの参加者にはS-09の非操作待機表示とR3監視を追加し、`restaurant_voting`と`decided`のときだけ既存復帰URLへ遷移する。ホストとdemoのCTAは維持した。
- 検証: Docker Composeでlint、typecheck、149件のテスト（143成功、6スキップ）、build成功。`git diff --check`成功。ブラウザーで320/375/390/430pxの文字入力16px、カードの縦ドラッグ非投票・横ドラッグ投票・取り消し・カード外スクロール・横はみ出しなしを確認した。QR URL入力と招待フォームも16pxを確認した。
- 残作業: 実機のタッチ・ピンチズーム、iPhone Safariのフォーカス時拡大、キーボード表示、独立したホスト/参加者による実APIの遷移を確認する。R3にはホストの店舗検索失敗理由が含まれず、参加者へ詳細を共有するには別途API契約の検討が必要。
- ブロッカー: 実機iPhone/Androidと隔離された実APIルームは未提供。既存データに書き込む結合テストは実施しない。
- 関連Issue・PR・コミット: なし。

## Self-Review

- Score: 96/100
- Review date: 2026-11-07
- Reasons for deductions: iPhone Safariの自動拡大と実機ピンチズームは環境依存であり実機確認が必要。
- Revisions made: R3で観測できる状態とホスト検索失敗の観測不可を区別し、候補保存後だけ遷移する条件を明記した。
