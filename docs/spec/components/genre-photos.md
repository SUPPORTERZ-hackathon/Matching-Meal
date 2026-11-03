# ジャンル料理写真とホーム写真配置

- Status: Implemented
- Last updated: 2026-10-31
- Related issue: None
- Related specifications: ../screens/home-screen.md, ../screens/genre-vote.md, ../screens/genre-result.md, ../themes/design-system.md
- Implementation files: frontend/src/features/genre-vote/genres.ts, frontend/src/features/genre-vote/genre-image.ts, frontend/src/features/genre-vote/genre-artwork.tsx, frontend/src/features/genre-result/result-artwork.tsx, frontend/src/features/home-preview/, frontend/public/images/genres/README.md

## 目的・範囲・承認

ユーザーの16ジャンル写真追加指示を承認根拠とする。IDに対応する画像URLを一元管理し、既存ジャンル投票・ホーム・ジャンル結果の画像領域で共有する。画面URLや投票処理を変えない表示部品の主仕様を本書に置く。ホームの写真は左カフェ/中央ラーメン/右寿司・海鮮で固定。

## 対象外

画像生成/加工/リネーム/移動、バックエンド/DB/API/API仕様/Docker/環境変数/PWA/manifest/Service Worker/共通UI本体、投票・集計・待機遷移ロジック、ホームのコピー/ロゴ/ボタン/ルーム作成遷移/参加処理、新規依存、新規アニメーション、コミット/プッシュ/PR作成。

## 前提条件・資料・差異

- 開始ブランチfeature/genre-and-home-images。未追跡の`frontend/public/images/genres/`に指定16JPEGが既にある。画像のSHA256/サイズを作業前に記録し、ファイル自体を変更しない。
- 開始HEAD818e0cf。fetchしたmainはc7da9e8、店舗結果PR #13がマージ済み。mainに画像パスとの競合はなく、作業ブランチをfast-forward。未コミット画像は保持する。
- 既存ホームURLは/home-preview。/は接続確認なので変更しない。画像01/07/09、ホーム/投票/結果/共通UI/テーマ仕様と該当コードを参照。
- 旧ホーム仕様は左右を画面外へ一部出すが、今回は「3枚を画面内に収める」が優先。100vw・左右-24px配置を、PageContainer内の流動Gridに置換する。home-preview.css先頭のhtml/body全体のoverflow-x:hiddenで隠す方針は使わず、写真の矩形を実際に収める。
- ホームはCSS Moduleではなく既存home-preview.cssを使うため、既存の命名/分離を継続する。共通globalsを編集しない。
- 旧ホーム仕様は遷移対象外だが、実装はルーム作成へrouter.push('/room-create')が接続済み。既存コードの動作を維持。QR参加ボタンは現在ハンドラーなしのプレビューで、今回も処理を追加しない。
- 旧画像管理は/genres/だけを受け付ける。今回/images/genres/を正規保存先に追加し、従来/genres/も読み取り可能として既存プレビューとの互換性を維持する。
- Context7でNext Image fill/sizes/親position/object-fit/onLoadを確認。既存Next ImageとuseStateによるフォールバックを踏襲する。

## データ・入力・一元管理

既存Genre型(id/name/imagePath?)と16件の順序/ID/日本語名をそのまま使い、genres.ts各レコードに次のimagePathを追加する。ファイル名を配列インデックスや表示名から生成しない。

| ID | ファイル名（/images/genres/） |
| --- | --- |
| ramen | 01-ramen.jpg |
| sushi-seafood | 02-sushi-seafood.jpg |
| yakiniku | 03-yakiniku.jpg |
| steak-hamburg | 04-steak-hamburg.jpg |
| curry | 05-curry.jpg |
| soba-udon | 06-soba-udon.jpg |
| teishoku | 07-teishoku.jpg |
| italian | 08-italian.jpg |
| chinese | 09-chinese.jpg |
| korean | 10-korean.jpg |
| asian | 11-asian.jpg |
| hamburger | 12-burger.jpg |
| okonomiyaki-takoyaki | 13-okonomiyaki-takoyaki.jpg |
| nabe-shabushabu | 14-nabe-shabu.jpg |
| izakaya | 15-izakaya.jpg |
| cafe | 16-cafe.jpg |

`getGenreImagePath(genre?:Genre)`は上記新prefixと既存/genres/のローカル絶対パスを許可し、未設定/外部URL/ディレクトリ逸脱はundefinedとして扱う。投票/結果/ホームの入口で共通利用。

## ホーム部品・Props・表示

- `getHomeFeaturedGenres(genres)`は固定のposition(left/center/right)とgenreId(cafe/ramen/sushi-seafood)でfindし、Genreを返す。入力配列の並び順に依存しない。不足データを別ジャンルで補完しない。
- `HomeFoodPhoto({ genre?:Genre })`は画像のloaded/failedだけを管理するClient Component。未設定/読み込み中/失敗時は既存カードの背景とジャンル名を表示。role=imgとジャンルを含む読み上げ名を付け、内部Imageはalt空で重複読み上げを避ける。
- 既存3カードの中身だけを差し替え、中央のハートは同じ位置/寸法を維持。カードと写真の境界は既存白枠・角丸・影を使う。
- heroは幅100%・既存PageContainer内。Gridの左右:中央:右=1:1.85:1、gap6px・左右padding12pxを基準。hero高clamp(180px,62vw,250px)。mainは幅100%・比率.85、sideは幅100%・比率.72。main回転2度、左右±14度の既存静的傾きを維持し、回転後の矩形もページ内へ収める。画像はfill/object-fit:cover/object-position:center、サイズは先に確保する。
- 中央は面積を大きく、左右は中心の料理が分かる切り抜き。カードは操作対象にせず、画像drag/pointerは無効。写真がロゴ/コピー/ボタンを覆わず、既存のクリック/フォーカスを妨げない。
- ホームのロゴ/コピー/ボタン/余白/ルーム作成先・QRの未接続状態は維持し、必要な写真エリアだけレイアウト調整。新しい演出は付けない。

## 投票・結果の画像と状態遷移

- GenreArtworkの既存5:6・最大432px/暗いグラデーション/ジャンル名/方向文字/スワイプは維持。共通path判定のみ差し替え、既存onLoad/onError/loaded/failedを利用する。
- ジャンル結果のResultArtworkも同じGenre.imagePathと判定関数を参照するだけ。結果の画像登場/ハート/紙吹雪/レイアウト/固定ボタンを変更しない。
- 状態は未設定→placeholder、URLあり→loading→loadedまたはfailed。失敗時は画像を外して背景を残す。読み込み前後でカードサイズは不変。写真エラーを投票エラーにしない。
- ファイル配置後は再読み込みして再取得。画像変更時はpropsのpathを含むkeyでホーム画像状態を初期化する。自動リトライ・API通信・状態永続化を追加しない。

## 利用例・エラー・アクセシビリティ

`GENRES.find(genre => genre.id === 'cafe')`のimagePathは`/images/genres/16-cafe.jpg`。ホームはこのレコードを共有し、投票順が変わっても同じURLを表示する。画像なし/破損/404でも代替表示とボタン操作を維持。画像はドラッグできず、タッチ/マウス/キーボードの既存操作は画面側に残す。

## 受け入れ条件・検証

1. 指定16ID/名前/順序とURLを単体検証。ホームの順序は左cafe/中央ramen/右sushi-seafood、配列を反転しても同じ対応。
2. 既に配置済みの実JPEG16件を/public経由で取得し、投票を進めるごとに対応画像が読み込まれる。最終待機、左右スワイプ、undo、連打防止、画像失敗でも投票できることを確認する。
3. ホーム3画像の成功/読み込み中/失敗（ブラウザー応答差し替え）でカード寸法不変。対応するGenre名のフォールバック、中央が大きい、左→右の配置、角度込みでページ内、ロゴ/コピー/ボタンと非重複。
4. 320/375/390/430/768/1024px・844×390・390×320・文字200%。横スクロール/内部スクロールなし、通常縦スクロールで操作到達、ルーム作成は既存/room-createへ、QRボタンはクリック/Enterしても既存の未接続状態を維持。
5. /genre-resultと開発結果プレビューで別Genreも同じ写真を使い、登場演出・ハート・図形の消去を維持。画像失敗時も崩れない。
6. Docker Composeのlint/typecheck/全フロントエンドテスト/build。typecheckとbuildは生成型の競合を防ぐため順次実施。390px画像保存とFigma比較。
7. 16JPEGのSHA256/サイズが開始時と同じ、禁止領域/既存投票ロジック/演出設定無変更をgit diffで確認。画像のGit追加/コミット/プッシュ/PRは行わない。

## 未決定事項

今回必要な未決定事項なし。写真の最終的な好みのトリミングや実機/支援技術確認はユーザーの最終レビュー対象。実業務/QR参加/PWAは対象外のまま。

## Progress

- 完了：関連仕様/コード/Figma/配置済み画像16件/最新mainを確認。画像ハッシュをGit対象外の作業領域へ保存。最新main c7da9e8へ安全に追従。
- 完了：URL登録/共通判定/ホーム写真とレスポンシブ配置/結果の参照を実装。画像配置手順をpublic/images/genres/README.mdへ記載し、従来public/genres/README.mdから案内。
- 完了：Docker Composeでlint・typecheck・38テスト・本番build成功。追加3テストは指定IDと写真の対応、投票順変更からの独立、旧パス互換/未設定/不正パスを確認。Nodeの既存MODULE_TYPELESS_PACKAGE_JSON警告のみ（失敗0）。buildとtypecheckは生成型が競合しない順序で実行した。
- 完了：Edgeで16JPEGの200/image/jpeg、16カードの画像URL/順序/読み込み、16件後の待機遷移を実測。微小移動の復帰、両方向の方向ラベルとマウスドラッグ、戻る/再投票、同一イベント内の3連打防止、Enter/Spaceとフォーカス保持、CDPのタッチ相当の左右投票/縦操作で投票しないことを確認。reduced-motionでも投票可。JS例外/追加API要求0。
- 完了：320/375/390/430/768/1024px、横844×390、低い390×320。横スクロール/内部スクロールなし、最大幅430px。ホームの3枚は順序/中央の大きさ/回転後の境界/ロゴ・本文・ボタンとの非重複を実測した。
- 完了：ブラウザーで画像応答を遅延/404に置換（実ファイルは無変更）。ホームのloading→failedでも寸法不変・ジャンル名の代替表示、投票写真失敗でも次へ進めることを確認。結果プレビューのcafe/sushi-seafoodが共通写真を読み込み、旧/genres/の失敗例も既存代替表示へ戻る。結果ハートは残り、図形DOMは終了後消える。
- 完了：/genre-vote-waiting、/genre-result、/restaurant-vote?genre=italian、/restaurant-vote-waiting?genre=italian、/ui-preview、/ui-preview/restaurant-resultの200/表示回帰。ホームの作成ボタンは/room-createへ、QRは既存未接続のまま。
- 完了：16JPEGのSHA256/サイズが全件開始時と一致。Git差分に禁止領域・共通UI・globals.css・投票hook/状態管理・既存演出・依存ファイルの変更なし。
- 完了：READMEの旧「画面は未実装」という導入を既存プロトタイプの状況に合わせ、料理写真の配置手順へのリンクと実際のホームURLを追加した。
- 検証記録：Git対象外の作業領域にgenre-home-photos-verification.json、genre-home-photo-edges.json、genre-home-actual-text200.jsonを保存。390pxのhome-photos-390-settled.png、genre-vote-photos-390.png、loading/failed・320/430pxも保存した。写真が落ち着いた正常画像とFigma01/07を比較し、白枠/角丸/影/傾き/中央の強調を維持。Figmaの左右のはみ出しは、今回指示どおり画面内へ変更した。
- 既存の課題：文字200%はrootのrem拡大だけでなく、描画文字を2倍にして320/390pxでも再確認した。写真/縦スクロール/横幅は維持。ただし320pxの既存ホーム作成ボタンは絶対配置・white-space:nowrapのラベルが枠から約8px出て、矢印と重なる。home-preview-screen.tsxの既存ボタンの制約であり、今回ボタン変更禁止のため維持。これを含む画面全体の200%合格とはせずStatusはImplementedに留める。
- 残作業：上記の既存ボタンの200%文字対応は別途の承認範囲。実機スマートフォン/OS文字拡大/スクリーンリーダー/写真切り抜きの好みは未検証（ブラウザーのタッチ相当操作と区別）。今回の写真表示コードの残作業なし。
- Blockers: None
- 関連PR/コミット：今回作成なし。

### 作成・変更ファイル一覧

- frontend/src/features/genre-vote/genres.ts（16件のimagePath）
- frontend/src/features/genre-vote/genre-image.ts（共通パス判定・新規）
- frontend/src/features/genre-vote/genre-artwork.tsx（共通パス判定の利用）
- frontend/src/features/genre-vote/genre-vote.test.mjs（新prefix互換の検証）
- frontend/src/features/genre-vote/genre-images.test.mjs（画像対応テスト・新規）
- frontend/src/features/genre-result/result-artwork.tsx（共通写真の参照のみ）
- frontend/src/features/home-preview/home-food-data.ts（固定位置からのID検索・新規）
- frontend/src/features/home-preview/home-food-photo.tsx（写真/読み込み/失敗表示・新規）
- frontend/src/features/home-preview/home-preview-screen.tsx（既存3カードに写真を表示）
- frontend/src/features/home-preview/home-preview.css（写真エリアの流動Gridと写真スタイル）
- frontend/public/images/genres/README.md（配置手順・新規）
- frontend/public/genres/README.md（正規保存先への案内）
- README.md（配置手順の案内と実装状況の記述整合）
- docs/spec/components/genre-photos.md（主仕様・新規）
- docs/spec/screens/home-screen.md（写真表示契約と結果）
- docs/spec/screens/genre-vote.md（写真参照契約と結果）
- docs/spec/screens/genre-result.md（共通写真参照と結果）

指定の16JPEGは作業開始時から存在したユーザー配置の未追跡ファイル。追加生成/加工/移動せず、Gitのステージにも追加しない。

## Self-Review

- Score: 97/100
- Review date: 2026-10-31
- Reasons for deductions: 実機のトリミングの好み/OSの文字拡大/支援技術は最終確認が必要（3点）。
- Revisions made: 旧ホームのはみ出し方針を明示更新、ID対応と順序非依存、実画像の保護、URL互換と失敗状態を規定。
