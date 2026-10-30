# 店舗投票完了・待機画面

- Status: Verified
- Last updated: 2026-10-30
- Related issue: None
- Related specifications: restaurant-vote.md, genre-vote-waiting.md, ../components/common-ui.md, ../themes/design-system.md
- Implementation files: frontend/src/app/restaurant-vote-waiting/, frontend/src/app/ui-preview/restaurant-vote-waiting/, frontend/src/features/restaurant-vote-waiting/, frontend/src/features/genre-vote-waiting/genre-vote-waiting-screen.tsx

## 目的・範囲・承認

今回のユーザー実装指示に基づき画像11の待機画面を実装する。データ・投票・ルーティング・共通制約は[主仕様](restaurant-vote.md)を参照。対象外はAPI/保存/同期/集計/店舗結果/PWA設定変更。

## 前提・URL・表示階層

既存のジャンル待機画面と画像11は、現在ステップ以外ほぼ同じ。`/restaurant-vote-waiting?genre=固定ID`で直接表示できる。投票配列はメモリのみで待機へ引き継がない。再読み込み/直接アクセスは独立した2/3人のモック表示に戻り、実際の参加者の状態と扱わない。

AppHeader(仮2481) → StepProgress(shop) → 既存VoteCompletionMark → 投票完了！ → みんなの投票を待っています → 全員が投票すると、自動で結果が表示されます。 → 白い人数カード/残り/進捗バー/参加者アバター。配置・寸法・CSSはジャンル待機の現行値をそのまま使用する。

## コンポーネント再利用・入力・状態

- 既存GenreVoteWaitingScreenに任意Props `currentStep?: MealStep="genre"` と `voteSubject?: "ジャンル" | "店舗"="ジャンル"` を追加。店舗ラッパーはshop/店舗を指定。見出しIDと読み上げ名のみ投票対象に合わせる。既存の呼び出しは同じ描画/挙動。
- participants/roomIdを既存と同じ型で親から渡す。summary関数/ParticipantAvatar/表示CSS/演出はそのまま再利用。参加者状態が変わった時だけ人数/残り/バー/アバター/aria-liveが更新され、時間だけでは変化しない。
- 初期YU/MI完了・KE待機。人数は固定表示せず配列から計算。0人は情報なし、全員完了時は「全員完了」と結果の受信待ち表示。結果ページ未実装のため存在しないURLへ遷移しない。将来の完了通知/結果遷移は親アダプターで接続する。
- `/ui-preview/restaurant-vote-waiting`はdevelopment限定。1/3、2/3、3/3、個別切替、参加者なし、多数/長文を試せる。通常画面に開発操作なし。

## アニメーション・レスポンシブ・エラー

VoteCompletionMarkとCSS/設定は変更しない。紙吹雪は赤/黄/水色/ピンク/オレンジ、丸/四角/長方形、約2600ms、終了イベント＋猶予タイマーでDOM除去、1マウント1回。参加者の再描画で再生しない。ピンク円は.8〜1.05・2800ms ease-in-out、中央赤円は安定。reduced-motionでは紙吹雪DOM除去/円停止。

最大430px・左右22px・safe-area・通常ページスクロール・参加者折り返しは既存通り。装飾aria-hidden、人数と参加者状態は色以外にも記号/読み上げ、進捗role/aria-liveを維持。情報なしに架空の人数を補完しない。

## 受け入れ条件・検証

1. 店舗4件終了後に表示、StepProgressの現在がshop、既存と同じヘッダー/ルーム/完了/参加者表示。
2. 1/3・2/3・3/3・0人・多数でsummary/バー/アバターが連動し、結果未実装時に遷移しない。
3. 演出は既存と同じ設定で1回、終了後DOMなし、データ再描画で再生せず、reduced-motion時もメッセージを確認可能。
4. 主仕様の7幅/横向き/低い画面/文字200%、横スクロールなし。画像11と390pxのスクリーンショット比較。ジャンル待機の見た目/挙動は回帰確認。
5. 主仕様のDocker frontend lint/typecheck/tests/buildと変更範囲確認に合格。

## 未決定事項

今回の表示に必要な未決定事項なし。正式な投票保存/本人識別/同期/結果集計/店舗結果画面/自動遷移は対象外として保留。

## Progress

- 完了：画像11と既存ジャンル待機の差分確認、再利用Propsの事前説明、仕様自己レビュー。
- 完了：ラッパー/ルート/開発用プレビュー。7幅/横向き/低い画面/文字200%・人数1/3/2/3/3/3・個別切替/0人/12人/長ルームをブラウザー確認。
- 演出：16図形/5色を確認、2600ms終了後DOM除去、再描画で0要素のまま。円の.8/1.05倍とチェック/文字の位置不変、reduced-motionで円停止/紙吹雪なしを確認。
- 回帰：ジャンル投票16件/undo/スワイプと既定genreの待機、共通UI、ジャンル結果接続を確認。詳細ログ・画像・Docker lint/typecheck/24テスト/build/本番200・404の結果は主仕様の検証記録を参照。
- 残作業：対象内なし。iOS/Android実機・支援技術・実同期/集計/結果遷移は対象外として未検証/未実装。
- Blockers: None
- 関連PR/コミット：今回なし。

## Self-Review

- Score: 97/100
- Review date: 2026-10-30
- Reasons for deductions: 実機/支援技術はブラウザーエミュレーションと区別が必要（3点）。
- Revisions made: 既定Propsを維持して再利用、独立モック/再読み込み/結果未実装と演出1回の契約を明記。
