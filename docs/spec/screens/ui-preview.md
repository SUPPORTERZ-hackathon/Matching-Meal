# 共通UI確認画面

- Status: Verified
- Last updated: 2026-10-28
- Related issue: None
- Related specifications: ../components/common-ui.md, ../themes/design-system.md
- Implementation files: frontend/src/app/ui-preview/page.tsx, frontend/src/app/ui-preview/button-showcase.tsx

## 目的と対象範囲

ユーザーの今回の依頼に基づき、共通UIを単独で確認できる/ui-previewを実装する。部品の表示契約はcomponents、寸法と色はthemesを参照し、重複定義しない。

## 対象外

API/DB、実際のルーム参加/投票、業務上の画面遷移、既存トップの変更、PWAインストール。

## 前提条件・URL・アクセス条件

Docker Composeのfrontendが起動している。認証条件なし。既定はhttp://localhost:3000/ui-preview。ポートを変更した環境ではそのポートを使う。今回の実装開始指示を承認根拠とする。

## レイアウト・表示・データ

PageContainerにAppHeader（サンプルルーム2481）、本文、BottomActionを配置する。本文に見出し、通常/compactロゴ、ルームなし/centeredヘッダー、現在段階4種類、Button、カード、参加者を順に一覧表示。カードは通常/読み込み/空/エラーの表示見本。アバターは3色、3状態、長い日本語/英数字、空名を含む。ヘッダー長文例も含む。データはローカル定数のみ、サンプルであることを明示する。

## 期待する振る舞い・状態と状態遷移

Buttonの見本では通常ボタンで押下回数を加算し、別操作でloadingを切り替える。状態はページ内Client ComponentのuseStateだけに保持し、再読込で初期化。初期値は押下0回・loading=false。disabledと固定loadingの例も表示する。旧variantと全size、asChildのリンク/無効/読み込みを再現し、後二者は遷移を抑制する。下部ボタンはページ先頭へのアンカーのみ。外部サービスへのアクセスは行わない。

## 入力・出力・エラーと境界条件

URL引数・フォーム・外部応答なし。データ待機や再取得は発生しない。カードのエラー/読み込み/空は常時静的な表示サンプルで、実際のAPI状態と誤解しない表示にする。長文の折り返しとBottomActionの長い注記を含める。

## 操作・レスポンシブ・ナビゲーション

共通UIの指定幅と通常ページスクロールを使用する。デスクトップも最大幅を維持する。StepProgressとロゴは操作対象にしない。戻る見本と下部のアンカーはロゴ見本へスクロールする。キーボードのTab/Enter/Spaceとfocus-visibleを確認できる。

## 受け入れ条件・検証方法

1. 全要素と状態が表示され、ブラウザからAPI/DBリクエストが発生しない。
2. ボタンの押下・loading切替・disabled/asChildの操作抑止、旧variant/sizeが機能する。
3. テーマ指定幅と200%文字で横スクロール・重なりなし。長文を読める。
4. Docker Composeのlint/typecheck/buildが成功する。
5. 既存/は接続成功を表示し、再確認が動作、/api/healthは正常。

## 未決定事項

なし。表示用サンプルは製品仕様の確定値ではない。

## 進捗

- 完了: 今回の指定に沿った画面構成と検証方法の確定。
- 完了: 共通部品一覧、4段階、Button新旧variant/size、操作見本、カード4状態、アバター全状態、下部アンカーを実装。プレビューからの/apiリクエスト0件・ブラウザ例外0件。
- 検証: 指定幅7種類、横向き、文字200%で横スクロールと重なりなし。Enter/Space・タッチ・hover・focus-visible・disabled/loading・asChild操作抑止を確認。既存接続画面と/api/health正常。Dockerのlint/typecheck/buildは最終ソースで成功。
- 表示修正: 文字200%で発見したロゴ/グリッドの横はみ出しを修正。ロゴマーク等の寸法をem比にし、通常寸法を保って拡大に対応。
- 残作業: 今回の受け入れ条件はすべて確認済み。
- 未検証: 実機のsafe-area/キーボード、iOS Safari、スクリーンリーダー。ブラウザ検証はMicrosoft Edgeとモバイル/タッチのエミュレーション。
- ブロッカー: なし。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 96/100
- Review date: 2026-10-28
- Reasons for deductions: 一意性29/30、状態20/20、データ15/15、配置14/15、再利用10/10、検証8/10。実機検証を残す。
- Revisions made: 今回のURL・データ・表示状態・操作・検証対象を明文化し、実装とブラウザ/Dockerの結果を記録。表示修正と実機の検証範囲を明示。
