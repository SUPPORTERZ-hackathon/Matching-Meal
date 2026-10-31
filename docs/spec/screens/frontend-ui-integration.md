# フロントエンド全画面のUI・導線統合

- Status: Implemented
- Last updated: 2026-10-31
- Related issue: None
- Related specifications: room-waiting-invite.md, room-join-screen.md, room-create-screen.md, home-screen.md, qr-scan-screen.md, genre-vote.md, genre-vote-waiting.md, genre-result.md, restaurant-vote.md, restaurant-vote-waiting.md, restaurant-result.md, ../components/common-ui.md, ../themes/design-system.md
- Implementation files: frontend/src/components/common/, frontend/src/app/globals.css, frontend/src/app/{room-join,genre-vote,genre-vote-waiting,genre-result,restaurant-vote,restaurant-vote-waiting,restaurant-result,ui-preview}/, frontend/src/features/{ui-flow,home-preview,room-create,room,qr-scan,genre-vote,genre-vote-waiting,genre-result,restaurant-vote,restaurant-vote-waiting,restaurant-result}/

## 目的・範囲・承認

今回の明示的なUI統合依頼を承認根拠とする。S01〜S12のヘッダー、指定6画面の固定下部領域、参加フォームと開発用モック導線を統合する。既存の実APIはルーム作成/参加/状態取得/開始までとし、投票保存APIの接続は追加しない。未接続の機能は通常フローで準備中と表示し、既存の投票UI/演出は明示的な開発用フローで維持する。

## 前提・調査結果・差異

- PR16はGitHub上でマージ済み。開始ブランチは既にfeature/frontend-ui-integration、HEAD/main/origin/mainと公開mainはいずれもb844f9c。作業ツリーはクリーン。ブランチ切替や再作成は不要で、コミット/プッシュ/PRは行わない。
- 参加フォームは実API版features/room/room-join-screen.tsxと、固定2481/ゆうき/渋谷・API未接続のfeatures/room-join/に重複。後者の参照はapp/room-join/page.tsxのみ。前者の外観/バリデーション/保存/連打防止/エラー/再訪復元を正とする。作成者のnickname欄は削除しない。
- 旧room-join仕様の固定ルームと未接続操作は今回の統合で廃止する。/room-joinは削除せず、単一のjoinCodeクエリが有効なら既存/j/{joinCode}へ正規化してredirectし、欠損/不正時は同じ参加部品の無効招待表示にする。
- ホームだけmain内に独自AppLogoヘッダーがある。共通AppHeaderをPageContainerのheaderへ移し、通常画面と同じcompactロゴ/サイズ/区切り線/位置に揃える。作成/QRの戻る付き中央配置はFigmaの既存例外として維持する。
- 共通BottomActionは既定の通常フローを維持し、固定用の薄いFixedBottomActionを追加する。画面別の3つのResizeObserver/高さ変数/固定CSSをこの部品へ集約する。影響はS02/S03/S05/S06/S09/S12とそれらのプレビュー。共通ButtonのAPI/デザインは変更しない。
- Context7のMDN position/VisualViewport、Next.js redirect/searchParamsを参照。stickyの祖先に新しいスクロール領域を作らない。画面固有の画像・紙吹雪・カード内clipは維持する。

## 対象外

backend/DB/マイグレーション/API仕様/Docker/環境変数/PWA/READMEの変更、新規依存、投票保存・同期・集計・実店舗検索、QRデコーダー導入、正式な終了処理。/の開発接続確認ページと既存manifestのURLは維持する。

## 共通レイアウト

- AppHeaderは既存Propsを維持しsticky?:booleanを追加（既定true）。header自身と既存境界線をposition:sticky/top:0/z-indexで一体化し、背景は既存paper色で不透明にして本文の透けを防ぐ。通常フローに高さを確保するため上のダミー余白は追加しない。ui-preview内の埋込見本だけsticky=false。
- 既存の最大430px、左右22px、セーフエリア、通常ページスクロールを維持。高さ500px以下ではFigma用の最低44px上部余白だけを実safe-area値へ縮め、短い画面に不要な空白を作らない。ロゴ/ボタン文字自体を小さくして収めない。
- FixedBottomActionは固定領域と同じ実測高の通常フローspacerを返す。共通BottomActionの16px/22px/下safe-area余白を使用し、古い画面別の下部予約を除去して二重余白を防ぐ。最大幅430px・中央配置・既存の淡い背景。本文末尾が固定領域より上までスクロールできること。
- ResizeObserverとrAFで高さ/フォント変化を追従し、VisualViewportのresize/scrollとwindow resizeで可視領域下端との差を補正する。ズーム中は独自のキーボード補正をしない。フォーカス中の入力がstickyヘッダーや固定領域に重なる場合は通常スクロールで露出させる。イベント/rAF/observerはアンマウント時に解除する。
- S06はp要素の非操作待機表示・既存Pulseを維持。S03開始権限・disabled・API・開始検知は維持。S09の発表演出は維持し、S12は静的なまま。
- ホームの絶対配置/nowrapボタン文字は通常フローの中央ラベルへ変更し、200%文字で折り返す。画像の左カフェ/中央ラーメン/右寿司は変更しない。

## URL・状態・遷移

- 実フロー：/home-preview→/room-create→/room-waiting?room=UUID。招待は現在のオリジン/j/実joinCodeで、QR/コピーと一致。参加後も同じ待機URLへ進み、sessionStorageの復元を維持する。コード/トークン/UUIDの役割を混同しない。
- /j/{joinCode}を参加フォームの唯一の実装とする。QRは標準カメラで同じURLを開く。S04は別画面として維持し、既存の仮の許可/拒否切替を正式な読取成功として扱わない。準備中と標準カメラ/招待URL利用を明示する。新しい参加用ニックネームフォームを作らない。
- 作成/QRの戻るは既存ホームへ確実に戻し、履歴の有無に依存して存在しない外部ページへ戻らない。
- ホスト開始API成功とゲスト検知の遷移先は既存/genre-vote?room=UUIDを維持。ルーム確認後、投票保存の未接続を正直に表示して停止する。実ルームの後ろに固定2481/2of3/モック勝者を接続しない。開始済み待機へ戻って即リダイレクトするループを避け、ホームへの導線を用意する。
- 開発用モックはNODE_ENV=developmentかつ単一demo=1の場合だけ既存の通常URLへ供給する。roomクエリとdemoが同時なら実ルームを優先し、モックへ切り替えない。本番のdemo=1はnotFound。query欠損/重複/不正ではモックを補完しない。
- /ui-previewに開発環境限定の入口を追加。既存データのみで/genre-vote?demo=1→/genre-vote-waiting?demo=1→明示的な全員完了操作→/genre-result?demo=1→/restaurant-vote?genre=ID&demo=1→/restaurant-vote-waiting?genre=ID&demo=1→明示的な結果操作→/restaurant-result?genre=ID&restaurant=ID&demo=1を接続する。
- デモはモック/未保存の注記を全画面で維持し、時間だけで人数や結果を増やさない。ジャンルID/店舗IDは既存定義で検証し、未指定ジャンルをラーメンで補完しない。通常の結果/店舗URLは未接続・欠損を表示し、架空の結果を正式データとして表示しない。
- 既存の詳細プレビューは維持し、外側へ置かれていた操作領域は可能な範囲でPageContainer内へ入れてヘッダーのsticky範囲を維持する。店舗候補・投票結果を新規に複製/生成する処理を追加しない。

## エラー・アクセシビリティ

参加の401/404/409/503/通信失敗/保存失敗/連打・再訪を既存と同じように扱う。無効招待でフォームを複製したり、偽の参加成功にしない。固定領域はfocus orderを変えず、操作対象は既存Button/Linkのみ。通常の縦スクロール、文字拡大・長文の折り返し、reduced-motion、QR dialogのトップレイヤーと閉じる/Escapeを維持する。

## 受け入れ条件・検証

1. 単一の参加フォーム、旧URLの正規化/不正表示、ニックネーム制限12文字、API参加成功/復元/人数更新/ホスト開始/ゲスト検知をローカル実APIで確認。
2. 通常フローでモック結果が供給されず、実ルームUUIDが維持される。開発デモの各リンクが有効でgenre/restaurant/demoが残る。本番のモック入口は利用不可。ゲスト待機は非操作。
3. S01〜S12の390px画像と320/375/390/430/768/1024px、844×390、390×320、200%文字、長文/20参加者/QR拡大を確認。document横はみ出しなし、ヘッダーの上端/境界線と指定6固定領域の下端がスクロール前後で維持され、本文末尾へ到達可能。
4. VisualViewport補正をブラウザーで確認し、実機キーボード/ノッチの未検証は区別する。既存のスワイプ/写真/戻る/Pulse/紙吹雪/結果演出とreduced-motionを回帰確認する。
5. Docker Composeでlint→typecheck→build、既存と必要なフロントテスト。Git差分で禁止領域/README無変更、既存変更保護、コミット等なしを確認。

## 未決定事項

今回のUI統合に必要な未決定事項なし。投票API接続・店舗API・PWA・アプリ内カメラ読取は別作業として未接続を明示する。

## Progress

- 完了：最新GitHub PR/main・作業ツリーと2つの参加フォーム/既存固定実装/全ルート/共通UI/Figmaを調査。
- 完了：Context7一次資料確認、今回の明示依頼を仕様へ反映。共通化の影響範囲をユーザーへ事前報告。
- 完了：共通stickyヘッダー、6画面のFixedBottomAction、旧参加フォーム整理、通常/開発用モックの分離、既存プレビュー内の導線を実装。再開後は実装コードを変更せず、既存差分を保持した。
- 完了：Docker Composeで最終lint/TypeScript型検査/フロントエンド53テスト/本番buildが成功（2026-10-31）。テストには既存51件と開発用境界2件を含む。既存のMODULE_TYPELESS_PACKAGE_JSON警告は残るが失敗なし。
- 完了：git diff --check成功。開始時からHEAD/main/origin/mainはb844f9c、52追跡差分+5新規=57ファイル。禁止領域・README・API仕様・既存API通信/セッション/投票hook・演出本体・依存パッケージは差分なし。
- 完了（前回の保存記録）：実APIで作成/別ブラウザー参加/コピー/QR拡大/再読み込み・招待再訪の復元/ホスト一覧更新/20人表示/開始API/ゲスト開始検知を確認。実ルームUUIDを維持し、開始後に保存未接続の表示で停止した。招待URLにトークンは含めない。実機QR読み取りや公開URL経由の検証とは区別する。
- 完了（前回の保存記録）：12画面×9条件=108レイアウトを確認。320/375/390/430/768/1024px、844×390横向き、390×320短画面、390pxで全要素の計算済み文字サイズ200%を使用。ヘッダー・境界線のstickyと指定6画面の固定領域/本文末尾への到達を確認。S04に5条件の横はみ出しを発見してnowrap/二重左右余白/拡大を修正し、S04の9条件を個別再検証してすべて横はみ出しなし。元の失敗記録は削除していない。
- 完了（前回の保存記録）：16ジャンルのスワイプ/ボタン/中断/戻る/進捗から4店舗のボタン投票、明示的な待機→結果までデモ導線を確認。genre/restaurant/demoの引継ぎ、通常URLとroom併記時のモック遮断、モック時の投票API書き込みなしを確認。
- 完了（前回の追加記録）：タッチ相当の左スワイプ、マウスの右スワイプ、キーボード投票、長い店舗情報の文字200%、紙吹雪のDOM消去、結果ハート維持/図形消去、S12の静的表示、ゲストPulseと軽減設定を確認。VisualViewportの高さを300px縮める相当条件で固定領域下端544px/可視下端544px・入力露出を確認した（OSキーボードの実機検証ではない）。
- 完了（前回の本番検証）：本番モードで6プレビューと6つのdemo入口は404、通常のホーム/未接続画面は200。Docker設定・公開ポート・環境変数ファイルは変更せず、一時検証サーバーは終了した。
- 完了（再開後の通常ブラウザー操作）：待機プレビューの1/3と残り2人/アバター連動、3/3でも明示操作前は待機に留まること、店舗待機の1/3とイタリアン選択の継承、明示操作による店舗結果への遷移を確認。390pxのS12でスクロール後のheaderTop=0/境界線あり/footerBottom=844/viewportHeight=844/横はみ出しなし/本文末尾到達も再確認。
- 検証記録の扱い：前回の追加スクリプトは、プレビューの一時404と人数反映直後のassert失敗を記録して中断したため、一括成功とは扱わない。人数・イタリアン結果遷移は今回の画面操作で再確認した。拒否された追加Playwrightコマンドは再実行せず、別のコマンドへの置換も行っていない。
- 未検証：実機iOS/Androidのキーボード・ノッチ・PWA/標準カメラによるQR読み取り・別端末/公開URL接続。中断した追加シナリオのうち、待機/結果演出すべてのreduced-motion動作確認と軽減設定下の連続投票は未完了（既存の軽減CSS/実装は無変更）。モック以降の正式APIは対象外で未接続。全受け入れ条件を検証済みとしないためStatusはImplementedに留める。
- Blockers: 追加Playwrightコマンドは前回自動承認レビューの利用上限で実行不可となった。安全性による却下ではなくレビュー処理自体の失敗。今回は再試行や回避を行わず、許可されたDocker既存チェックと通常画面操作で最終確認した。
- 今回のコミット・プッシュ・PR：なし。

## 画面ごとの確認結果

「確認」は上記の保存済みブラウザー検証を含む。S07〜S12の操作は開発デモであり、正式な投票APIの完成を意味しない。

| 画面 | URL/役割 | ヘッダー/境界線 | 固定下部領域 | 操作・遷移の状態 |
| --- | --- | --- | --- | --- |
| S01 | /home-preview | 確認 | 対象外 | 作成/QRへの導線を確認 |
| S02 | /room-create | 確認 | 確認 | 実API作成・必須入力・名前欄維持 |
| S03 | /room-waiting?room=UUID（host） | 確認 | 確認 | QR/コピー/20人/実API開始を確認 |
| S04 | /qr-scan | 修正後確認 | 対象外 | 仮カメラ許可を廃止。標準カメラ/共有URLを案内 |
| S05 | /j/{joinCode} | 確認 | 確認 | 単一フォーム・12文字制限・実参加/復元を確認 |
| S06 | 同じroom-waiting（guest） | 確認 | 確認 | 非操作待機/Pulse/開始検知を確認 |
| S07 | /genre-vote | 確認 | 対象外 | 実ルームは保存未接続表示。明示demoで16件操作 |
| S08 | /genre-vote-waiting | 確認 | 対象外 | 通常は未接続。demoの人数表示/明示結果遷移を確認 |
| S09 | /genre-result | 確認 | 確認 | 通常は未接続。demoで既存発表演出/店舗への導線 |
| S10 | /restaurant-vote | 確認 | 対象外 | 通常は未接続。demoで4候補のボタン投票 |
| S11 | /restaurant-vote-waiting | 確認 | 対象外 | 通常は未接続。demoで人数/明示結果操作 |
| S12 | /restaurant-result | 確認 | 確認 | 正式結果なしは空表示。demoは静的結果/座標なし無効マップ |

## 差分・旧仕様との相違

- 旧room-join-screen.mdの/room-join固定ルーム情報・ローカル参加は廃止し、app/room-join/page.tsxから実API版へ一本化した。旧features/room-joinのTSX/CSSだけを削除。画面02の名前欄は維持。
- common-ui.md/design-system.mdの従来ヘッダー/通常フローの記録は、共通stickyと任意の固定部品を示す現行節から本仕様を参照する。BottomActionの通常フロー自体は維持。
- qr-scan-screen.mdの仮カメラ許可切替は、アプリ内読取の未実装を正しく示す表示へ変更。ホーム独自ヘッダーとnowrap配置は共通部品/折り返しへ変更した。
- 従来genre/restaurant各画面仕様の通常URLでのモック供給は、明示的な開発デモ限定へ更新し、通常URLの未接続状態と区別した。これらは今回の明示依頼に基づく変更で、業務集計ルールの追加ではない。

## PR前の確認事項

1. ユーザーが/home-previewと/ui-previewのデモを最終確認する。UI統合と正式なAPI接続が別作業であることをレビュー時に明示する。
2. 実機・公開オリジンでQR/参加/キーボード/safe-areaを確認し、未完了のreduced-motion回帰を確認する。
3. 次作業で既存のジャンル投票保存/状態/結果APIを接続する。店舗候補/店舗投票/集計はバックエンド担当と契約を確認してから接続する。
4. 依頼どおり今回はGitへのコミット・プッシュ・PR作成を実施しない。mainの更新が必要になった場合はユーザーの判断で改めて差分を確認する。

## 変更ファイル一覧（57ファイル）

新規5、既存変更50、旧フォーム削除2。スクリーンショット/検証スクリプトはリポジトリ外のQA保存先にあり、以下のGit差分へ含めない。

- `docs/spec/components/common-ui.md`
- `docs/spec/screens/frontend-ui-integration.md`
- `docs/spec/screens/genre-result.md`
- `docs/spec/screens/genre-vote-waiting.md`
- `docs/spec/screens/genre-vote.md`
- `docs/spec/screens/home-screen.md`
- `docs/spec/screens/qr-scan-screen.md`
- `docs/spec/screens/restaurant-result.md`
- `docs/spec/screens/restaurant-vote-waiting.md`
- `docs/spec/screens/restaurant-vote.md`
- `docs/spec/screens/room-create-screen.md`
- `docs/spec/screens/room-join-screen.md`
- `docs/spec/screens/room-waiting-invite.md`
- `docs/spec/screens/ui-preview.md`
- `docs/spec/themes/design-system.md`
- `frontend/src/app/genre-result/page.tsx`
- `frontend/src/app/genre-vote-waiting/page.tsx`
- `frontend/src/app/genre-vote/page.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/app/restaurant-result/page.tsx`
- `frontend/src/app/restaurant-vote-waiting/page.tsx`
- `frontend/src/app/restaurant-vote/page.tsx`
- `frontend/src/app/room-join/page.tsx`
- `frontend/src/app/ui-preview/page.tsx`
- `frontend/src/components/common/app-header.tsx`
- `frontend/src/components/common/fixed-bottom-action.tsx`
- `frontend/src/features/genre-result/genre-result-prototype.tsx`
- `frontend/src/features/genre-result/genre-result.module.css`
- `frontend/src/features/genre-result/result-bottom-action.tsx`
- `frontend/src/features/genre-vote-waiting/genre-vote-waiting-preview.tsx`
- `frontend/src/features/genre-vote-waiting/genre-vote-waiting-screen.tsx`
- `frontend/src/features/genre-vote/genre-vote-prototype.tsx`
- `frontend/src/features/genre-vote/genre-vote-screen.tsx`
- `frontend/src/features/home-preview/home-preview-screen.tsx`
- `frontend/src/features/home-preview/home-preview.css`
- `frontend/src/features/qr-scan/qr-scan-screen.tsx`
- `frontend/src/features/qr-scan/qr-scan.module.css`
- `frontend/src/features/restaurant-result/restaurant-result-preview.tsx`
- `frontend/src/features/restaurant-result/restaurant-result.module.css`
- `frontend/src/features/restaurant-result/result-map-action.tsx`
- `frontend/src/features/restaurant-vote-waiting/restaurant-vote-waiting-preview.tsx`
- `frontend/src/features/restaurant-vote-waiting/restaurant-vote-waiting-screen.tsx`
- `frontend/src/features/restaurant-vote/prototype-data.ts`
- `frontend/src/features/restaurant-vote/restaurant-vote-preview.tsx`
- `frontend/src/features/restaurant-vote/restaurant-vote-prototype.tsx`
- `frontend/src/features/restaurant-vote/restaurant-vote-screen.tsx`
- `frontend/src/features/restaurant-vote/restaurant-vote.test.mjs`
- `frontend/src/features/room-create/room-create-screen.tsx`
- `frontend/src/features/room-create/room-create.module.css`
- `frontend/src/features/room-join/room-join-screen.tsx`
- `frontend/src/features/room-join/room-join.module.css`
- `frontend/src/features/room/room-fixed-action.tsx`
- `frontend/src/features/room/room-genre-entry.tsx`
- `frontend/src/features/room/room-waiting.module.css`
- `frontend/src/features/ui-flow/development-demo.test.mjs`
- `frontend/src/features/ui-flow/development-demo.ts`
- `frontend/src/features/ui-flow/flow-message.tsx`

## 保存した確認画像・検証記録

保存先（絶対パス）：C:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/

- S01-390.png〜S12-390.png（各画面390px）、S03-qr-dialog-390.png、S07-swipe-10-390.png/S07-swipe-mid-390.png、S08-confetti-390.png/S11-confetti-390.png。
- ui-integration-qa.json：32操作確認、108レイアウトと元のS04問題を含む記録。
- ui-integration-extra.json：S04修正後9条件等の成功記録と追加検証の中断記録。
- ui-integration-final-browser.json：前回の追加検証の部分成功/失敗を保持。後から成功に書き換えていない。今回の通常ブラウザーでの再確認結果は上記Progressを参照する。

## Self-Review

- Score: 96/100
- Review date: 2026-10-31
- Reasons for deductions: 実機キーボード/OS/セーフエリアの最終確認はブラウザー検証と別に必要（4点）。
- Revisions made: 旧フォームの整理先、通常/開発デモの境界、未接続停止、固定領域実測・sticky範囲・検証条件を明示した。
