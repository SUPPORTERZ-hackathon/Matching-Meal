# 文字入力中の固定下部操作領域

- Status: Implemented
- Last updated: 2026-11-07
- Related issue: None
- Related specifications: common-ui.md, ../screens/room-create-screen.md, ../screens/room-join-screen.md
- Implementation files: frontend/src/components/common/fixed-bottom-action.tsx, frontend/src/components/common/keyboard-visibility.ts, frontend/src/features/room-create/room-create-screen.tsx, frontend/src/features/room-create/station-search.tsx, frontend/src/features/room/room-fixed-action.tsx, frontend/src/features/room/room-join-screen.tsx

## 目的と範囲

ルーム作成と参加フォームで、ソフトウェアキーボードの表示中に固定送信領域が入力領域を狭める問題を解消する。共通`FixedBottomAction`へ任意の`hideOnKeyboard`を追加し、指定した2画面だけ有効にする。通常時の固定表示、送信・エラー・入力状態を維持する。

## 対象外

ほかの固定下部領域、投票・API・DB、PWA、viewportの拡大設定、キーボードの強制表示・非表示、フォーム入力状態の変更は対象外。

## 前提と再現条件

現状は`visualViewport`の縮小分を下部オフセットとして使い、キーボード上へ固定領域を移動する。文字入力へのフォーカスだけではソフトウェアキーボード表示を確定できない。ブラウザーによってキーボードがVisual Viewportだけ、またはlayout viewportも縮小する。

## 期待動作・状態遷移

- `hideOnKeyboard`の既定値は`false`。既存画面の挙動は変えない。
- `true`で、入力欄にフォーカスし、粗いポインターが使われ、拡大率が通常で、フォーカス前の表示可能高さから120px以上かつ18%以上縮小した場合だけキーボード表示と扱う。小さなアドレスバー変化やPCの通常入力では隠さない。
- 表示中→キーボード表示中では固定領域と対応する本文末尾のスペーサーを同時に隠し、入力・候補を見られる高さを増やす。DOMとフォーム状態は保持する。
- 入力からフォーカスが外れても、表示可能高さがまだ縮小中なら隠した状態を維持する。キーボードを閉じて高さが回復したら、固定領域とスペーサーを再表示し高さを再測定する。フォーカスが残ったままでも復帰する。
- フォーカス中の入力はVisual Viewportの可視範囲内へ既存のスクロール補正で収める。候補リストはキーボードに隠れない範囲までスクロールできるようにする。
- ページ離脱時はイベント・Observer・インライン変数を片付ける。ピンチズームは有効のままにする。

## 入出力・エラー・境界条件

入力は`visualViewport.height/scale/offsetTop`、`window.innerHeight/innerWidth`、入力フォーカス、粗いポインター判定。Visual Viewportがない場合は`innerHeight`を代用する。寸法不足・通常拡大時は従来の固定領域を表示する。キーボード表示による一時的な寸法変化では送信状態・入力・駅候補・検索範囲を初期化しない。縦横回転による幅変更では基準高さを更新する。

## 受け入れ条件と検証方法

1. ルーム作成のニックネーム・駅検索、参加者のニックネームで、キーボード相当のViewport縮小時に固定操作とスペーサーが消え、回復後に戻る。
2. フォーカスのみ、PCの細い画面、ピンチズーム、アドレスバー程度の変化では消えない。
3. 入力欄と駅候補が可視範囲内で操作でき、入力・選択・送信中・エラー状態が維持される。
4. 320/375/390/430pxと通常PCで表示を確認し、ほかの`FixedBottomAction`利用画面にオプションを適用しない。
5. Docker Composeでlint、typecheck、テスト、build、`git diff --check`を実施する。実機のiOS Safari・Android Chrome・PWAで未検証の項目は明記する。

## 未決定事項

なし。縮小判定の技術的閾値は、アドレスバーによる小変化とキーボードによる大きな変化を区別する暫定値として今回の実装で検証する。

## Progress

- 完了: 現ブランチの作業ツリーがクリーンであること、関連仕様・共通固定領域・2フォームを確認。対象2フォームだけで`hideOnKeyboard`を有効化し、キーボード判定、固定領域とスペーサーの同時切替、駅候補の表示可能高さ調整を実装。
- 検証: Docker Composeのlint・typecheck・buildは成功。既存テスト151件のうち145件成功・6件スキップ・失敗0件。キーボード判定の自動テストで入力フォーカス、Viewport縮小、PC、非対象画面、ピンチズーム、閉じた後の再表示を確認。PCブラウザーで320/375/390/430pxのルーム作成・参加フォームを表示し、横スクロールなし、入力と駅候補選択、固定ボタン表示を確認。`git diff --check`成功。
- 残作業: iOS Safari・Android Chrome・インストール済みPWAでソフトウェアキーボードの実表示、候補タップ、閉じた後の復帰を確認する。実機未確認のためStatusは`Verified`にしない。
- 関連Issue・PR・コミット: なし。

## Self-Review

- Score: 94/100
- Review date: 2026-11-07
- Reasons for deductions: ソフトウェアキーボードの寸法変化はOS・ブラウザー依存であり実機確認が必要。
- Revisions made: フォーカスのみで隠さず、Visual Viewportとlayout viewportの両方の縮小を扱い、利用画面を限定した。
