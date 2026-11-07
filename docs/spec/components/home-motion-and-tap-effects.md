# ホーム演出と共通タップエフェクト

- Status: Implemented
- Last updated: 2026-11-07
- Related issue: None
- Related specifications: ../screens/home-screen.md, genre-photos.md, ../themes/design-system.md, common-ui.md
- Implementation files: frontend/src/features/home-preview/, frontend/src/components/common/tap-particles.tsx, frontend/src/components/common/tap-particles.css, frontend/src/app/layout.tsx

## 目的と範囲

`/home-preview`の初回表示を短いブランド演出で印象づけ、既存料理写真を5枚の立体カルーセルへ発展させる。全画面の通常のポインタータップへ控えめな共通パーティクルを加える。既存ロゴ、コピー、ルーム作成・QR読取導線は維持する。

## 対象外

投票、認証、ルーム作成・参加の業務処理、API、DB、PWA、既存画像の変更、新規依存、他画面のレイアウト・アニメーション変更は対象外。

## 前提・現行仕様との差異

- 現行ホームは`/home-preview`、`/`は接続確認画面。前者のみブランド演出を付ける。
- `genre-photos.md`の固定3枚・新規アニメーションなしは写真導入当時の契約。今回の明示依頼で初期中央ラーメン・左カフェ・右寿司を保ちつつ、焼肉・イタリアンを奥側に追加し循環表示へ変更する。16ジャンル定義と画像パスはそのまま使う。
- ホーム写真カードは現行では操作機能がない。スワイプはカルーセルの任意操作を追加し、ルームボタンのクリック・遷移は維持する。
- `home-preview.css`の既存スタイル方式を継続し、共通UIの見た目や`globals.css`は変更しない。

## 表示と状態遷移

### 初回起動

- 同じタブの`sessionStorage`キーで再生済みを判定する。保存不能でも同一ページ内では繰り返さない。サーバー出力は常に通常のホームで、ブラウザー環境の判定はマウント後に行いhydration mismatchを防ぐ。
- 未再生かつモーション許可時だけ約1.1秒のオーバーレイを表示する。背景は既存のクリーム色、中央に既存`AppLogo`を再利用し、フェード・控えめなスケールと小さなハート/光の静的要素を短時間だけ動かす。背後の料理・見出し・操作は約1.35秒まで順に現れる。ホーム本文は準備済みのままにし空白画面を出さない。
- スキップ操作またはタイマー終了でオーバーレイを取り外す。戻り時、再読み込み時は同一タブで再生しない。reduced-motionでは即時に通常ホームを表示する。

### 料理カルーセル

- 5枚はID`cafe, ramen, sushi-seafood, yakiniku, italian`から既存`GENRES`を検索し、初期の中央ramen、左cafe、右sushi-seafood、奥側2枚を描画する。欠損写真は既存`HomeFoodPhoto`の代替表示。
- 楕円状の固定5スロットに対し、中央1倍、左右約0.82倍、奥約0.58倍、左右約±10度、奥行きと透明度を変える。写真自体は裏返さない。約4秒ごとに1件進め、移動は約0.72秒のtransform/opacity遷移とする。
- 横スワイプは40px以上かつ縦移動より明確に大きい場合だけ切り替える。縦スクロール・タップは切り替えない。手動操作後は10秒間自動送りを休止する。タブ非表示、画面外、reduced-motion時は自動送りを停止する。アンマウント時はタイマー・監視を解除する。
- 最大幅430pxの既存本文内に5枚を収め、320pxでも横スクロールやボタンとの重なりを起こさない。中心のジャンル名とハートを表示する。意味のある読み上げは中央画像のみとする。

### 共通タップパーティクル

- root layoutにClient Componentを1つ置く。通常のポインタータップ完了位置にハート・丸・四芒星を5個、`data-tap-particles="accent"`の操作は8個描画する。ブランド赤、ピンク、橙、淡い金色を使用。寿命は約0.55秒、transformとopacityだけで放射状に消す。
- pointerdown/up間の移動10px以上、押下時間500ms超、直近180ms内のスクロール、ドラッグ、テキスト入力中、無効操作、修飾キー、キーボード操作、`data-tap-particles="off"`領域では発生しない。
- 粒子レイヤーは`pointer-events:none`。90msの連続発生抑制と最大6バーストの上限を設ける。終了・経路変更・アンマウントで要素とタイマーを消す。reduced-motionでは生成しない。

## 入出力・異常系

入力は既存Genre ID/画像、sessionStorage、matchMedia、visibility/IntersectionObserver、PointerEvent。保存するのは起動演出再生済みフラグのみ。写真失敗・sessionStorage無効・IntersectionObserver非対応でもホームとボタンを表示する。粒子はAPIや個人情報へアクセスしない。

## 受け入れ条件と検証方法

1. 初回演出、スキップ、同一タブでの戻り・再読み込み、reduced-motionを確認。
2. 初期5枚のID・左右中央、4秒の自動移動、手動スワイプと縦スクロールの区別、非表示/画面外停止を確認。
3. 通常/強調タップの粒子数・位置・削除、スクロール/入力/disabled/reduced-motionで非生成、連打上限を確認。
4. 320/375/390/430/768/1024px、横向き・短い高さでカードと本文/ボタンの非重複、横スクロールなしを確認。
5. Docker Composeでlint、typecheck、既存テスト、本番build、`git diff --check`を実施。実機で未確認の項目は区別する。

## 未決定事項

なし。速度・配置・粒子数は上記値で実装し、ブラウザー表示に基づいて微調整する。

## Progress

- 完了: ブランチ/作業ツリー、mainと公開PR、ホーム/共通UI/写真/デザイントークン、既存テストを確認。開始時のHEADとGitHub上のmainは`11e6842`で一致し、公開中のPRは0件（直近の#30・#31・#32はマージ済み）。Context7のReact公式資料でEffectのイベント・タイマー解放方法を確認。5枚カルーセル、初回起動、共通タップ粒子、操作抑止と後片付けを実装。写真・ブランドトークンを再利用し新規依存なし。
- 検証: Docker Composeのtypecheck・本番buildは成功。全156テスト中150件成功、6件スキップ、失敗0件。変更箇所のESLintは成功。全体lintは未変更の`genre-vote/use-genre-vote-sound.ts`の2エラーと`genre-result/genre-result-screen.tsx`の1警告で失敗。Git差分に両ファイルの変更なし。
- ブラウザー: 320px・390pxのスクリーンショットで写真、コピー、ボタンの非重複と横スクロールなしを確認。375/430/1024pxでも寸法を取得したが、768pxはブラウザーの幅指定が反映されず未確認。横ドラッグで次の料理へ切り替わり、縦ドラッグでは切り替わらない。通常タップで5粒が発生して終了後にDOMから消え、ルーム作成へ遷移・ホームへ戻ると起動演出と粒子が残らない。Consoleのerrorは0件。実機描画は未確認。
- 残作業: 初回オーバーレイの短い再生・スキップを実ブラウザーで直接捕捉する確認、768px表示、iPhone Safari・Android Chrome・インストール済みPWAで体感速度とreduced-motionを確認。全体lintの既存エラーは別変更で解消する。これらが残るためStatusは`Verified`にしない。
- 関連Issue・PR・コミット: なし。

## Self-Review

- Score: 95/100
- Review date: 2026-11-07
- Reasons for deductions: 実機ごとのモーションの体感とOSのタップ挙動はブラウザー実装後の確認が必要。
- Revisions made: 初期3枚の並び、再生時間、停止・解放条件、発生抑止条件を明確化。
