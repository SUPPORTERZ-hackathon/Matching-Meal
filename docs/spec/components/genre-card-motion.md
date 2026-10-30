# ジャンル写真の連続表示・結果発表の同期

- Status: Verified
- Last updated: 2026-10-31
- Related issue: None
- Related specifications: genre-photos.md, ../screens/genre-vote.md, ../screens/genre-result.md, ../themes/design-system.md
- Implementation files: frontend/src/features/genre-vote/use-next-card-shade.ts, frontend/src/features/genre-vote/genres.ts, frontend/src/features/genre-vote/deck-presentation.ts, frontend/src/features/genre-vote/deck-presentation.test.mjs, frontend/src/features/genre-vote/genre-artwork.tsx, frontend/src/features/genre-vote/genre-vote-screen.tsx, frontend/src/features/genre-vote/genre-vote.module.css, frontend/src/features/genre-result/result-reveal.tsx, frontend/src/features/genre-result/result-artwork.tsx, frontend/src/features/genre-result/reveal-config.ts, frontend/src/features/genre-result/genre-result-screen.tsx, frontend/src/features/genre-result/genre-result.module.css

## 目的・範囲・承認

今回の具体的なユーザー依頼を承認根拠とする。投票の現在/次の2写真を連続表示し、結果の写真と図形を同期開始し、指定16件のアピール文を登録する。投票/画面遷移の業務処理は維持する。

### 明るくなり始める距離の調整・現行契約（2026-10-31）

今回の明示依頼を承認根拠とする。従来の明度はdirectionOpacity=clamp(abs(dx)/(カード幅×.25),0,1)を流用しており、カード幅25%で暗さ0%になっていた。これは投票判定/方向ラベルには正しいが、背面の明度用には早すぎる。本節を従来の明度式/45%調整の履歴より優先する。

- スワイプ移動はpointerのclientX−開始clientXを既存rAF経由でmotion.xに保持。投票は従来どおり幅25%以上で指を離した時に確定。確定後は280ms/cubic-bezier(.3,.05,.65,.6)でwindow.innerWidth+カード幅+32pxへ移動する。この判定/目標/時間/投票hookは変更しない。
- 明度開始距離は独立した表示定数brightenStartWidthRatio=.25。終了距離は固定の幅.9等を使わず、カードの実幅/実高、カード中心とswipeWindowのクリップ境界、transform行列から得た実際の回転角（既存の上限12度）から、回転したカード全体が可視領域外へ出る距離を左右別に求め、1pxの余裕を加える。390pxの通常カードは幅346px・高さ約415px、開始86.5px、12度回転した可視領域外は約408px。ボタン退場中は回転角に合わせて終了位置も再計算する。従来の最終目標768pxは完全退場後の余分な移動も含むため、その地点まで暗いまま待たない。
- t=clamp((abs(実描画の横移動)−幅×.25)/(終了距離−幅×.25),0,1)、opacity=.45×(1−t²)。25%以下は45%を厳密に維持。左右同式。0幅/不正入力は45%としてNaNを表示しない。scale/下位置は従来のdirectionOpacityをそのまま使い、変更しない。
- 表示専用useNextCardShadeを追加。draggingは既存motionの更新後にuseLayoutEffectで描画位置を取得し、exiting/returningはCSS transformの実描画値をDOMMatrixReadOnlyのm41でrAF追跡する。opacityだけを専用ref経由で更新し、Reactの毎フレームstate更新/投票状態変更をしない。CSS opacityの独立した時間補間は外し、カード実位置との二重補間やボタン操作時の先行を防ぐ。
- 前面が見切れる時点で0%になり、その後も0%を維持して同一Imageが前面へ昇格する。中断/キャンセルは前面の実位置が戻るのに合わせて45%へ戻る。reduced-motionの退場は既存の即時非表示に合わせて0%へ切り替える。rAF/resize監視はフェーズ変更/ジャンル変更/アンマウントで解除する。
- Context7でReactのuseLayoutEffectによる描画前測定、MDNのDOMMatrixReadOnly/getComputedStyleを確認。先読み/2枚/画像/文/結果アニメ/共通UI/依存/バックエンド等は変更しない。開始時の未コミットファイルをSHA256で保護する。
- 対象はdeck-presentation.ts、既存の同テスト、use-next-card-shade.ts（新規）、genre-vote-screen.tsx、genre-vote.module.css、本仕様の6ファイル。自己レビュー96/100、未決定事項なし。
- 検証：0/10/25/50/75%のカード幅移動、左右、終了距離、0幅/不正入力、ボタンの280ms退場中の各フレームで実位置とopacityの式の一致/単調変化、DOM保持、中断/キャンセル/戻る/連打/キーボード/タッチ相当/全16件、指定幅/390pxの6画像、Docker lint/typecheck/全テスト/build。
- Progress：実装・検証完了。Docker Composeの最終lint/typecheck/buildと全43テスト成功（追加3件、既存Nodeモジュール警告のみ）。Edgeで320/375/390/430/768/1024pxの25%移動まで45%を維持し、横スクロールなし。390pxで0/10/25%移動のopacity .45、50%で.413384、75%で.312378を実測し、左右一致。実回転角に応じた終了距離を使い、スワイプ退場18フレーム/ボタン退場18フレームの実描画位置・可視矩形と明度式の一致、単調変化と0%到達を確認した。画像DOM/loaded/opacity1を維持して昇格し、ちらつきなし。未確定の中断/閾値を超えたEscapeキャンセルは投票せず45%へ復帰。左右のボタン/戻る/進捗も正常。
- Progress：320pxで全16ジャンルの文字200%表示・16件後の待機、タッチ相当の小移動/左右/縦操作、次画像404時の投票、reduced-motion、ホーム/ジャンル待機/結果/店舗投票/待機/店舗結果プレビューを回帰確認。開始時の対象外37ファイル（16JPEGを含む）はSHA256一致。投票hook/swipe-config/vote-state、結果アニメーション、禁止領域に今回の変更なし。git diff --check成功、ステージ追加/コミット/プッシュ/PRなし。
- 検証記録：Git対象外にgenre-delayed-shade-results.json、genre-delayed-shade-edges-results.json、genre-delayed-shade-preservation.json、390pxのgenre-delayed-shade-0/10/25/50/75/after-390.pngと文字200%画像を保存して目視確認。実機スマートフォン/iOS Safari/OS文字設定/支援技術は未検証。実装範囲内の残作業・ブロッカーなし。

### 背面の初期暗さ45%への調整・前回の履歴（2026-10-31）

今回の明示指示を承認根拠とし、DECK_PRESENTATION.shadeOpacityのみ.30から.45へ変更する。既存の式opacity=.45×(1−進捗)により0/25/50/75/100%で45/33.75/22.5/11.25/0%とする。左右/ボタンとも同じ値を使い、中断時は既存300msで45%へ戻る。先読み/2枚/サイズ/イベント/投票/結果演出は変更しない。変更対象は表示定数・既存テストの期待値・本仕様の3ファイル。未コミット変更を保持し、他ファイルの開始時SHA256を記録する。自己レビュー96/100、未決定事項なし。検証はDocker lint/typecheck/全テスト/build、ブラウザーで指定進捗/左右/中断/ボタン/DOM保持/スマートフォン幅と390pxの3状態を確認する。

Progress：実装・検証完了。Docker Composeのlint/typecheck/全40テスト/build成功（既存Nodeモジュール警告のみ、失敗なし）。Edgeで左右の0/25/50/75/100%の実測opacityが.45/.3375/.225/.1125/0と一致。中断後の45%/投票0件、ボタン操作の45%から0%への単調な補間、見送り/食べたい/戻る/進捗を確認。同一Imageの昇格/loaded/opacity1/余分なshadeなしを確認し、ちらつきを防ぐ既存構成を維持。320/375/390/430/768/1024px、844×390、390×320で画像2枚・横スクロールなし。開始時42ファイルのうち今回対象外39ファイル（写真16枚を含む）はSHA256一致。Git対象外へgenre-shade45-results.jsonと390pxのgenre-shade45-before/half/after-390.pngを保存し、目視確認。実機スマートフォンの体感は未検証。コミット/プッシュ/PRなし。

## 対象外

バックエンド/DB/API/API仕様/Docker/環境変数/PWA/共通UI/店舗画面/画面12の静的表示、写真加工、依存追加、投票判定/記録/undo/二重投票防止/既存進捗/投票後の遷移、コミット/プッシュ/PR作成。

## 前提・調査・差異

- 開始ブランチfeature/genre-and-home-images、HEAD/mainともc7da9e8。写真追加17ファイルとユーザーJPEG16件が未コミットでmain未マージ。開始時ファイルのSHA256/差分をGit対象外へ記録し、同じHEADからfeature/genre-vote-animation-improvementsを作成。変更を削除/退避しない。
- 関連仕様、既存カード/フック/写真/結果演出、配置済み画像とFigma07/09を参照。現行カードは色付きの背面だけで次の写真がなく、通常enterでopacity0に戻る。現行結果はCSS演出が先行し、写真はonLoad後にopacity1になるため途中参加する。
- ユーザーが指す「食べたいなら右へ」の実コードはGenreArtworkの「食べたい気分なら、右へ。」。同じ箇所を指定文へ置換する。カード外の操作案内は維持する。
- 旧仕様の「色付き背面」「写真外枠だけの即時演出」を本契約で更新する。旧履歴は残し、現行の入口を明示する。
- Context7のNext Image公式文書（onLoad、loading、decoding）とReact公式のkeyによる状態保持を確認。背面→前面でも同じキー/要素/画像部品を保持する。

## 投票カード・Props・データ

- 既存Genreに任意のreadonly appeal:stringを追加。既存ID/名前/imagePath/順序は維持。GENRESに依頼表どおり16文を設定する。任意フィールドにして既存のテスト/プレビューのGenre互換を保ち、未設定時は文を省略する。別ジャンルの文で補完しない。
- GenreArtwork({genre,current=true})。Imageは現在/次ともloading=eager、同じsizes/fillを使う。currentだけh2のid=genre-card-title、背面には同じidを付けない。読み込み/失敗の既存stateを保持し、写真失敗でも既存代替表示と名前/appealを維持する。
- 既存articleの親内に[次,現在]をgenre.idのkeyで描画し、最大2写真に制限。次を昇格するときにImage/GenreArtworkをアンマウントしない。各カードは同じ5:6/max432px領域・角丸28pxで、前面は既存pointerHandlers/ref/方向ラベル/アニメーション終了通知を持つ。
- 背面はaria-hidden/inert/pointer-events:none。投票対象のdata-genre-idと読み上げ見出しは前面だけ。次のデータがなければ描画しない。既存の暖色の積み重なり飾りは維持。
- 背面は初期scale .96/下8px/黒overlay .45。拡縮は既存labelOpacityでscale=.96+.04×進捗、下位置=8×(1−進捗)を維持。黒opacityは本書先頭の現行契約に従って実移動距離から独立計算する。
- draggingは指の移動量へ即時追従。exitingは既存280ms、returningは既存300ms。拡縮は既存のCSS補間、明度は本書先頭の現行契約に従い実位置に同期する。ボタンも既存vote()→exitingなので同じ表示になる。
- 昇格後のenteringはopacity0/追加スケールへ戻さず、通常表示を保つCSSの待機アニメーション（既存240ms、既存終了コールバック/ロックを維持）にする。undoing/undo-enteringの既存演出は維持。フック/判定/票配列は変更しない。
- 背面のtransform終了イベントが昇格後に届いてもenteringのロックを早く解除しないよう、前面のtransitionendはexiting/returningでだけ完了通知する。
- appealは既存12px・行高1.6、通常は1行。overflow-wrap:anywhere、200%では折返し、必要時はカードのmin-heightを本文の文字寸法に応じて確保する。名前・文を切り取らず、通常縦スクロールを維持。
- 通常サイズはstageの空の::beforeを同じGrid領域に置き、5:6/最大432pxの最低寸法を確保する。前面の本文が大きい場合はGridの内容高を優先し、カードだけが親からはみ出してクリップされる構成を避ける。背面は同じ領域に絶対配置し、本文の高さ計算や操作に参加しない。

## 結果写真の準備・開始・状態遷移

- ResultArtworkへonReady(state:photo|fallback)、showPhoto:booleanを追加。写真1枚をeager/fetchPriority=high/decoding=syncで取得し、Next ImageのonLoadで表示準備を通知（内部decode完了後のコールバック）。onErrorはfallbackを通知。既存写真/代替表示の寸法は維持する。
- ResultRevealはpreparing→photoまたはfallbackの一方向の準備状態を持つ。pathなしは初期fallback。写真が準備できた同じReact更新でImageを表示し、既存850msのpopと1600msの図形を開始する。準備中は写真領域を初期scale(.2)/opacity0で予約し、本文/固定CTAを停止しない。
- 最大準備待ちは意味のある定数imageReadyTimeout=700ms。超過した場合はfallbackで同じ演出を継続。その再生中には遅い写真を突然出さないようfallbackを固定し、次の明示的な再生/再読み込みで再取得する。写真だけ後から現れることを防ぐ。
- 写真/ハートの外枠と図形の開始属性を共通にする。既存pop keyframes/図形の軌道/色/時間/レイアウトは変更しない。図形のcleanupタイマーも準備完了を起点にし、アニメーション終了または既存猶予でDOM除去。準備タイマー/cleanupタイマー/イベントはアンマウント時に解除する。
- keyはgenre.id/画像path/既存replayKey。明示したジャンル・画像・再生操作では準備からやり直し、同一データの再描画では再生しない。
- reduced-motionではpop/図形を停止し、写真領域は静的に表示する。背面の拡縮/補間を停止し、投票は既存の即時進行で正常完了する。

## エラー・端・操作

画像欠損/404/読み込み遅延/キャッシュ済み、最後の1件、全16件、左右方向反転、閾値未満/キャンセル、undo/再投票、連打、キーボード、縦スクロール、reduced-motionを扱う。画像取得失敗を投票エラーにしない。結果画像待ちでもヘッダー/本文/CTAは利用できる。必要なネットワーク要求はローカル写真のみでAPI通信を追加しない。

## 受け入れ条件・検証方法

1. 16文が指定IDに一致、既存ID/名前/path/順序不変。拡縮の従来進捗を維持。明度の25%開始境界/その先の曲線/実形状からの終了距離/左右対称・非対称/0幅・不正値を単体検証。
2. ブラウザーで次画像の事前ロードと同じDOM/loaded状態の昇格、最大2Image、最後は1枚を検証。左右スワイプ/中断/方向ラベル/ボタン/連打/undo/全16件後の待機を確認。
3. 背面のaria-hidden/inert/非操作/見出しIDの一意性、前面の読み上げ名/キーボードを確認。
4. 結果はキャッシュなし/遅延/失敗/未登録で準備→再生、写真のloadedと演出開始の同一フレーム、700ms後のfallbackと遅い写真の非途中参加、ハート残存/図形消去/同状態再描画で再生しないことを確認。
5. 320/375/390/430/768/1024px、横844×390、短い390×320、実描画文字200%、通常縦スクロール/横スクロールなし/appeal非欠け/ボタン操作。開始前/ドラッグ途中/昇格後と結果の開始/途中/終了を保存し比較。
6. Docker Compose lint/typecheck/全フロントテスト/build。typecheck後にbuildを行い生成型の競合を避ける。既存ホーム/ジャンル待機/店舗画面/静的店舗結果の回帰と、開始時の対象外ファイル/写真のハッシュ一致・Git差分を確認。

## 未決定事項

今回の実装に必要な未決定事項なし。実機スマートフォン/支援技術/OS文字設定はブラウザー相当確認と区別して記録する。

## Progress

- 完了：関連資料・コード・Git/写真未コミット状況を確認、開始ファイル記録と安全な新ブランチ作成、Context7確認、仕様化と自己レビュー。
- 完了：2枚の連続表示/準備開始同期/16文を実装。画像URL/ID/名前/順序と既存useGenreVote/vote-state/swipe-configは無変更。
- 完了：Docker Composeのlint/typecheck/全40テスト（追加2件）/最終本番build成功。Nodeの既存MODULE_TYPELESS_PACKAGE_JSON警告のみ、失敗/スキップなし。生成型の競合を避けtypecheck後にbuildを実施。
- 初回30%時点の検証完了：Edgeで次画像の事前ロード、背面articleとImageのDOM同一性/loaded状態を維持した昇格、最大2写真と最終1写真、全16文の一致、16件後の既存待機遷移を確認。開始の黒30%、閾値半分で15%、閾値到達で0%、中断後30%を実測。両方向のマウス操作・方向文字・undo/再投票・3連打防止を確認。
- 完了：Enter/Spaceとフォーカス保持、タッチ相当の小移動中断/左右投票/縦スクロールで非投票を確認。背面のaria-hidden/inert/見出しID重複なし。昇格中に遅いtransform終了イベントを発生させてもentering/ボタンdisabledを維持することを確認。
- 完了：写真をブラウザーで遅延させ、準備中のpop/図形なし、準備完了後の最初の描画で写真loaded/opacity1、popStartとburstStartが同一の825.012msであることを記録（ページ起点の観測値、実装定数ではない）。850/1600msの既存演出・ハート残存/図形DOM消去・同状態の再描画で再生しないことを確認。
- 完了：700ms超の遅い応答と404ではfallbackへ進み、後続写真が再生途中/終了後に現れない。背面写真の404でも昇格・アピール文・投票が正常。開発結果プレビューの失敗画像から元の画像へ戻すと準備をやり直して写真を表示する。
- 完了：投票/結果それぞれ320/375/390/430/768/1024px、844×390、390×320と文字200%（18表示条件）で横スクロール/内部スクロールなし。さらに320pxで全16件の名前68px/文24pxを確認し、本文とカード/親/操作案内の境界内へ収まることを検証。通常の5:6/最大432pxは維持し、大文字時だけ自然に高さを確保する。reduced-motionの結果拡大と背面補間のCSS優先順位を修正し、停止/静的表示と投票継続を確認。
- 完了：ホーム、ジャンル待機/結果、店舗投票/待機、店舗結果プレビューの200/表示回帰。通常no-preferenceで店舗結果の実行中アニメーション0を確認し、画面12の静的表示を維持。
- 完了：開始時の対象外28ファイルがSHA256一致（うち16JPEG）。重複する5ファイルは今回の文/表示/仕様の更新だけ。禁止領域/共通UI/PWA/依存ファイル/店舗画面/既存投票フックの差分なし。git diff --check成功。コミット/プッシュ/PRはなし。
- 記録：Git対象外の作業領域にgenre-deck-result-motion-results.json、genre-motion-edges-results.json、genre-lock-static-regression.json、genre-animation-preservation-results.jsonを保存。390pxのgenre-deck-before/middle/after-390.png、genre-result-synced-start/pop/end-390.png、文字200%のgenre-deck-long-text200-320.pngを保存して目視確認。
- 残作業：今回の実装範囲内はなし。実機スマートフォン/iOS Safari/OSの文字設定/スクリーンリーダーは未検証。ブラウザーのCDPタッチ相当操作・文字拡大と区別する。前回から残るホーム作成ボタンの200%課題は今回も対象外。
- Blockers: None
- PR/コミット：今回作成なし。

### 今回作成・変更した14ファイル

- frontend/src/features/genre-vote/genres.ts：指定16文（既存ID/写真を保持）
- frontend/src/features/genre-vote/deck-presentation.ts：背面の表示定数・式（新規）
- frontend/src/features/genre-vote/deck-presentation.test.mjs：表示式・16文のテスト（新規）
- frontend/src/features/genre-vote/genre-artwork.tsx：eager読み込み・見出しID/アピール文
- frontend/src/features/genre-vote/genre-vote-screen.tsx：キー付き2枚表示・イベントのフェーズ確認
- frontend/src/features/genre-vote/genre-vote.module.css：背面表示・昇格・文字拡大時の内容高
- frontend/src/features/genre-result/result-artwork.tsx：写真の準備通知・取得優先度
- frontend/src/features/genre-result/result-reveal.tsx：準備/発表/タイマー管理
- frontend/src/features/genre-result/reveal-config.ts：準備待ち上限の定数
- frontend/src/features/genre-result/genre-result-screen.tsx：画像pathを含むキー
- frontend/src/features/genre-result/genre-result.module.css：準備完了からの既存演出・動き軽減
- docs/spec/components/genre-card-motion.md：本仕様（新規）
- docs/spec/screens/genre-vote.md：現行契約・検証への参照
- docs/spec/screens/genre-result.md：現行契約・検証への参照

写真追加の既存未コミット変更はこの一覧とは別に保持している。上記と重複するgenres.ts/両artwork/両画面仕様では先行実装を残して今回分を追加した。

## Self-Review

- Score: 96/100
- Review date: 2026-10-31
- Reasons for deductions: 実機の体感調整と支援技術の確認はブラウザー検証だけでは完結しない（4点）。
- Revisions made: 読み込み待ちの上限/遅延写真の非途中参加、DOM保持/背面の読み上げ抑制、既存フェーズとロックの維持を明示した。明度だけの25%開始距離、実際の回転とクリップ境界に基づく終了距離、退場中の実位置追跡とcleanupを追記した。
