# ジャンル投票画面・UIプロトタイプ

- Status: Verified
- Last updated: 2026-10-29
- Related issue: None
- Related specifications: ../components/common-ui.md, ../themes/design-system.md, genre-vote-waiting.md
- Implementation files: frontend/src/app/genre-vote/, frontend/src/features/genre-vote/, frontend/public/genres/, frontend/public/genre-vote/

## 目的と対象範囲

### 待機画面への接続（2026-10-29）

今回のユーザー指示により、`/genre-vote`では16件の投票退場完了後に`/genre-vote-waiting`へreplace遷移する。接続・再読込・モックの契約は[待機画面仕様](genre-vote-waiting.md)を正とする。追加依頼により旧完了表示の疑似集計/投票記録/再試行/完了後undoは撤去し、onCompleteを必須にする。投票中のundoは維持する。本節は後述の「待機遷移は対象外」「完了表示の集計」を今回のプロトタイプ接続に限り更新する。投票内容は転送/永続化せず、既存のアンマウントでの初期化を維持する。

- Progress：接続と旧完了画面撤去を実装・検証済み。Docker lint/typecheck/build、既存7件と待機4件、左右スワイプ/ボタン/投票中undo/16件後の直接遷移・タッチ/縦スクロールを確認。詳細は待機画面の最終検証結果を参照。既存スワイプと投票/undoのhookは変更していない。

2026-10-28のユーザーの実装依頼を承認根拠とし、指定16ジャンルを左右スワイプ・ボタンで選べる表示プロトタイプを実装する。今回指定された方向・進捗・確定条件を採用し、技術的な初期値を以下に記録する。共通UIの責務や既存Propsは変更しない。

## 対象外

API/DB/Go/Docker変更、投票の永続化・同期・集計・勝者決定・正式な待機画面遷移、他担当画面、外部写真取得、Service Worker・オフラインキャッシュ。投票結果はこのタブのメモリだけに保持し、再読込・アンマウントでリセットする。

## UI改善・戻るの実装契約（2026-10-28）

今回のユーザー指示で、従来の「戻すなし」「ルーム番号なし」と説明文を変更する。本節を該当部分の現行仕様とする。既存の未コミット変更を引き継ぎ、以下の画面固有ファイルと本書・READMEだけを変更する。共通UI・保存方式・API・PWA設定・写真データ・通常スワイプの判定/動きは維持する。

### 表示・配置・Props

- 「直感で、今日の『食べたい』を選ぼう。」と「UIプロトタイプ · 再読み込みで投票はリセットされます」をDOMから削除し、それぞれの余白も撤去する。完了表示の説明とリセットの注意は維持する。
- PageContainerのclassNameから、この画面のmainのpaddingだけを0にする。StepProgressを全幅の通常フローに置き、その下のタイトル・カード周辺・案内・下部操作の余白を画面専用CSSで管理する。レイアウト調整に負のマージンを使わない。カードの重ね/ドラッグに必要な局所的絶対配置は維持する。
- 上部進捗の下からタイトルまで24px、タイトルからカードまで20px、カード下から左右案内まで20px、操作案内の下からボタンまで16pxを目安にする。カードの前後には16pxのクリップ用内余白を通常フローで確保する。本文左右はmax(22px,safe-area)、下端はmax(20px,safe-area)。
- GenreVoteScreenにroomId?:stringを追加し、AppHeaderの既存roomNumberへ渡す。page.tsxから名前付きのPROTOTYPE_ROOM_ID="2481"を渡し、API未接続の仮データとコードに明記する。表示部品自身に仮値を内蔵しない。長いIDは共通ヘッダーの折返しを利用し、この画面のclassNameでチップを右寄せする。欠落時は従来のチップなし。
- 操作列はCSS Gridで左右:中央:左右=1:0.7:1、gap8px、各列は縮小可能とし、中央の最小幅48pxを確保する。順序は見送り/戻る/食べたい。左右の円はclamp(56px,16vw,64px)で幅/高さを変え、主要操作の記号26px・ラベル12pxを維持する。
- 中央は既存Buttonのghostを再利用し、幅は中央列全体、最小高64px、Undo2の22pxアイコンと11pxの「戻る」を縦に配置する。無効時28%・有効時は補助文字色。主要操作より控えめにしつつ、最小44px以上のタップ領域とフォーカス表示を保つ。

### 戻る動作・状態・境界条件

- `undoGenreVote(votes)`を投票状態の純粋関数に追加し、配列を変更せずslice(0,-1)で末尾1件を除く。空配列は同じ配列を返す。投票数と現在カードは引き続き配列長から導出する。
- 戻るはidle/completeかつ投票1件以上のときだけ受け付ける。idle → undoing（200msの控えめなフェード/縮小）→ 末尾削除 → undo-entering（既存の240ms登場を基にした短い逆向き移動）→ idle。完了表示からは削除してundo-enteringへ進む。
- 先頭・ドラッグ中・復帰/退場/登場/戻る演出中は戻るを無効にする。最初にrefの状態をロックし、連打・投票との同時操作・完了イベント/タイマーの重複で複数件を消さない。既存の完了イベントとduration+80msのフォールバックを再利用する。
- 取り消したジャンルのlike/skipは残らず、異なる選択で再投票できる。戻るを繰り返せば先頭まで戻せる。完了表示にも「直前の投票に戻る」という補助ボタンを置き、同じundo処理を使う。
- reduced-motionでは戻る演出も移動/待ち時間を省く。戻したジャンルをaria-liveで通知する。キーボード操作では戻るへフォーカスを復元し、先頭に戻って戻るが無効になる場合は見送りへ移す。

### 検証と承認

Figma画像07と390pxの変更前後、320/430pxの画像を比較する。指定6幅で3操作の順序・領域/文字の非重複・長いルームID・通常スクロール・横スクロールなしを確認する。like/skipの取り消し、再投票、連続戻る、先頭無効、演出中の連打、完了からの戻る、軽減設定・キーボードを検証する。既存スワイプ・16件完了・写真fixture・PWA・接続確認を回帰確認し、Dockerのlint/typecheck/buildとロジックテストを実行する。

今回の仕様を変更するユーザー指示を承認根拠とする。未決定事項なし。実装開始前自己レビュー96/100（一意性29、状態20、型15、外観14、再利用10、検証8）。実機の操作感と実インストールは今回も別途確認とする。

## 前提条件・参照資料・ブランチ

- 指定のFigma画像07、figma-app.tsx.txt、figma-index.css、監査/実装メモ、既存テーマ/共通UIと実コードを確認した。
- 現在のfeature/genre-voteを使用。feature/common-uiが祖先で、開始時のGit変更なし。共通UIのPRレビュー待ちは本画面の実装を妨げない。
- Context7でNext.jsのmanifest/Viewport/ImageとMDNのPointer Events・pointer captureを確認。新しい依存なし。
- Docker Composeでfrontend/backend/dbを起動し、frontendの検証コマンドを使用する。

## URL・アクセス条件・画面構成

URLは`/genre-vote`。認証やルーム参加条件は設けないプロトタイプ専用URL。今回のUI改善では仮のルーム番号を表示する。

PageContainerとAppHeaderを再利用し、本文にStepProgress(currentStep="genre")、見出し「今日は何食べたい？」、件数/バー、カード、左右操作案内、BottomAction内の既存Buttonによる見送り/戻る/食べたい操作を配置する。ロゴや進捗に画面遷移を追加しない。通常ページスクロールで下部まで到達可能とし、固定フッターや内部スクロールを作らない。

表示幅は共通UIの最大430px・本文左右22px・safe-area・既存フォント/色を継承。画面固有のCSSはCSS Modulesへ隔離する。共通UIコード・globals.css・root layoutは変更しない。デスクトップでも同じ幅、タッチ/マウス両対応。

## データ・型・画像

`features/genre-vote/genres.ts`にreadonlyな`Genre`（id:string、name:string、imagePath?:string）と順序付き一覧を置く。IDは日本語名から生成しない固定slug。指定順はラーメン、寿司・海鮮、焼肉、ステーキ・ハンバーグ、カレー、そば・うどん、定食・食堂、イタリアン、中華料理、韓国料理、アジア料理、ハンバーガー、お好み焼き・たこ焼き、鍋・しゃぶしゃぶ、居酒屋料理、カフェ。

初期は全件imagePathなし。画像未設定は正常状態。`public/genres/`へ画像を保存し、例`imagePath: "/genres/ramen.webp"`を設定するだけで表示する。ローカルの同一オリジンパスのみを対象とする。Next Imageのfill・sizes・object-fit:coverを使い、読み込み中・取得失敗も同じプレースホルダーに戻す。レイアウトやカード高を変えない。外部画像設定やremotePatternsは追加しない。

投票は`GenreVote={genreId:string, choice:"like"|"skip"}`のreadonly配列。現在のカードは配列長から導出し、件数を重複状態として保持しない。次の期待IDと一致する投票だけ受理し、同じIDを二重に記録しない純粋関数を分離する。後日のAPI変換はこの型付き記録を境界に検討できるが、送信関数は今回追加しない。

## 見た目・配置・Props

- カードは元資料の角丸28px・積み重なった背面・下端のジャンル名と白文字を基準にする。比率5:6、最大高さ432px。全画像/プレースホルダーで同じ領域。長い名前は折り返す。
- プレースホルダーは淡い赤/暖色のグラデーション、既存Lucideの料理アイコン、暗い下部グラデーションとジャンル名。写真のような架空素材・「おすすめ」の業務ラベルは生成しない。
- 320pxでは見出しを「今日は何」「食べたい？」のまとまりで折り返し、ジャンル名の中黒区切りも料理名の途中で分断しない。プレースホルダーに余分な説明を重ねず、長いジャンル名の領域を確保する。
- 右は赤系のハート付き「食べたい」、左は濃い本文色系の×付き「見送り」。カード上部へ白い背景・枠で重ね、カードと一緒に傾く。静止時はopacity=0。方向変更はその場で切替、透明度はmin(abs(dx)/(カード幅×0.25),1)。読み上げは確定時だけ通知する。
- 本文見出し22px、ジャンル名34px（長文折返し）、件数補足と案内12px。操作のサイズ/3列配置は今回のUI改善契約を参照する。既存ButtonのvariantとclassNameだけで画面固有の見た目を指定する。
- `GenreVoteScreen({genres:readonly Genre[], roomId?:string})`をClient Component、page.tsxをServer Componentとする。カードの`GenreArtwork({genre:Genre})`を分離し、画像有無/失敗状態だけを持つ。共通の投票処理は画面専用hookへ分離し、汎用スワイプ部品を新造しない。

## 進捗・状態と状態遷移

件数は「現在のカード n / N」と「投票済み m件」を区別し、初期n=1/m=0、最後のカードn=N/m=N-1、完了n=N/m=N。バー/読み上げのprogressbarは投票済みm/Nを使用する。StepProgressは最後までgenreのままで、投票数からshop/resultへ変更しない。

通常投票はidle → dragging → returning/ exiting → entering → idle、最後はexiting → complete。戻るはundoing/undo-enteringを使う（今回のUI改善契約を参照）。pending/vertical方向の判定はgestureのrefで保持し、業務状態に含めない。指を離す前に投票は記録しない。アニメーション中は3操作と新しいドラッグを無効にする。投票の記録とカード更新は退場完了後に一度だけ行う。

全件完了時はチェック・「ジャンルの投票が完了しました」・「プロトタイプ」の明示、like/skip件数、任意に開くローカルの投票記録、再試行ボタンを同URL内で表示する。再試行は全投票を破棄して先頭へ戻す。正式な待機画面には移動しない。空配列は投票ボタンなしの空状態とし、クラッシュさせない。

## Pointer Events・判定条件・スクロール

- primary pointerの左ボタンのみ受け付け、pointer IDで追跡する。カードでpointer captureし、場外リリースも受け取る。画像のネイティブdragと選択を抑止する。
- touch-action:pan-y pinch-zoom。移動10px未満は未判定。abs(dx)>abs(dy)×1.2で横ロック、abs(dy)>abs(dx)×1.2で縦扱い、それ以外は未判定を続ける。縦はpreventDefaultせず、ブラウザーのスクロールへ委ねる。
- 横ロック時だけ指に追従。dxはそのまま、yはdy×0.18を±22pxへ制限、回転はdx/カード幅×12度を±12度へ制限。requestAnimationFrameで描画をまとめる。
- 横ロック済みでリリース時abs(dx)>=カード幅×0.25、かつabs(dx)>=abs(dy)×1.2なら確定。右=like、左=skip。速度判定は入れず、距離と方向で再現可能にする。値は名前付き定数に集約。
- 未達・pointercancel・lostpointercapture・Escape・ウィンドウのフォーカス喪失では復帰。投票・進捗は変更しない。縦操作や2本目のpointerから誤投票させない。
- 退場時のxは方向×(viewport幅+カード幅+余裕32px)。横はみ出しはカード周辺の局所的なoverflow:clipで防ぎ、body全体の横隠蔽や縦スクロール停止はしない。

## アニメーション・エラー・境界条件

復帰300ms、退場280ms、登場240ms。CSS transition/keyframesと控えめなcubic-bezierを使う。ドラッグ中はtransitionなし、影だけ深くする。退場のtransform transitionend・登場のanimationendで次へ進め、イベント消失時は同じduration+80msのタイマーで収束する。完了処理はrefの状態確認で一度だけ実行する。タイマー・rAF・イベントはアンマウントで解放する。

prefers-reduced-motionはCSSとmatchMediaで検出。回転/登場移動/待ち時間を除き、スワイプ方向と結果を保って即時切替する。設定の実行中変更も追従する。投票中の回転は抑制する。

画像失敗は通常のプレースホルダーへ戻し、投票を妨げない。画像の各状態で同じジャンル名と操作を維持する。業務エラーや通信リトライは発生しない。背景タブではタイマーが遅延する可能性があるが、二重記録を起こさず復帰時に収束する。

## アクセシビリティ

見送り/食べたいを既存ButtonとしてTab/Enter/Spaceで操作でき、ジャンルを含む読み上げ名を付ける。キーボード投票では、次のカードの登場後に同じ選択ボタンへフォーカスを戻す（待機中に利用者が他の要素へ移動した場合は奪わない）。ドラッグ領域をボタン/タブと偽らない。操作説明をaria-describedbyで関連付ける。確定後のカード名/完了はaria-live=politeで通知し、移動中の大量通知を避ける。完了時は見出しへ、再試行時は次の操作へフォーカスを移す。色だけで方向を表現しない。

## PWA対応方針

既存はviewport-fit=cover、フォント、safe-areaのみ。manifest・アイコン・theme-color・standalone・Service Workerはない。今回`/genre-vote/manifest.webmanifest`と画面専用の192/512px PNG・180px Appleアイコンを用意し、start_url/scope/idを/genre-voteに限定する。Next.jsのmanifest規約はappルート用のため、この画面専用manifestは型付きデータと明示的な静的Route Handlerで配信する。Content-Typeはapplication/manifest+json。page.tsxのmetadata/viewportだけにmanifest・Apple設定・テーマ色を追加し、他ページの設定は変えない。アイコンは既存ロゴを参考にしたローカルSVGから生成する。

Service WorkerはAPI/他画面のキャッシュに影響するため追加しない。オフライン動作は対象外。manifest/アイコン/viewportを検証し、実機HTTPSでのインストール確認とは区別して報告する。

## Figma・既存仕様との相違

Figmaは3件・外部写真・「戻す」・どちらの選択も同じindex更新・待機へ直接移動。本実装は指定16件・画像なし正常・選択を記録・同URLのプロトタイプ完了とし、今回「戻る」で記録を取り消す動作を追加する。元資料には実際のスワイプ処理がなく、既存プロトタイプで追加済み。Room #2481は今回明示した仮データとして表示する。「おすすめ」は使わず、写真の代わりに既存プレースホルダーを維持する。Figmaの固定高と内部スクロールに対して、カードは流動的な寸法、ページスクロールを使う。共通UIは未変更で使用する。

旧テーマ仕様の「PWA/投票対象外」は共通UI実装時のスコープであり、今回の画面固有実装を禁じるものではない。READMEの接続確認のみ/今後PWAとの説明は今回のプロトタイプ範囲へ更新する。READMEのmain/feat手順とAGENTSのdev/feature手順の不一致は今回Git操作の対象外として残す。

## 受け入れ条件・検証方法

1. 指定16件の順序/ID重複なし、画像未設定・有効画像・404/不正画像時の表示を確認する。画像は検証時のみローカルfixture/リクエスト置換を使い、外部から取得しない。
2. 右/左のドラッグ中ラベル・方向切替・透明度・回転上限、リリースまで未確定、25%境界、未達復帰、キャンセル・縦操作・非primaryを確認。
3. ボタンとスワイプで同じ選択結果、アニメーション中の二重操作抑止、退場後の次カード、全16件完了と再試行を確認。
4. 320/375/390/430/768/1024px、短い画面/横向きで横スクロール・内部スクロール・下部見切れなし。実際のタッチイベントで縦スクロールを検証する。実機の操作感・safe-areaは別途未検証として報告する。
5. Tab/Enter/Space・focus・読み上げ属性・reduced-motionを検証。既存/と/ui-previewと/api/healthに回帰なし。
6. manifest/アイコン/テーマ色/viewport、他ページにmanifest/SWが追加されないことを確認する。
7. Docker Composeでfrontendのlint/typecheck/buildとロジックのNode標準テストを実行する。Go test/vetはGo/API/DB変更なしのため対象外。

## 実装ファイル一覧

| 区分 | リポジトリ相対パス |
| --- | --- |
| 画面 | frontend/src/app/genre-vote/page.tsx |
| manifest配信 | frontend/src/app/genre-vote/manifest.webmanifest/route.ts |
| ジャンルデータ・型 | frontend/src/features/genre-vote/genres.ts |
| 投票データ・順序/重複防止 | frontend/src/features/genre-vote/vote-state.ts |
| ジェスチャー・動きの定数/純粋関数 | frontend/src/features/genre-vote/swipe-config.ts |
| 操作と状態遷移 | frontend/src/features/genre-vote/use-genre-vote.ts |
| 画面UI・完了・フォーカス | frontend/src/features/genre-vote/genre-vote-screen.tsx |
| 写真/プレースホルダー | frontend/src/features/genre-vote/genre-artwork.tsx |
| 画面専用スタイル | frontend/src/features/genre-vote/genre-vote.module.css |
| PWAのURL/色定数 | frontend/src/features/genre-vote/prototype-config.ts |
| 型付きmanifest | frontend/src/features/genre-vote/pwa-manifest.ts |
| ロジックテスト | frontend/src/features/genre-vote/genre-vote.test.mjs |
| 写真追加手順 | frontend/public/genres/README.md |
| アイコン原本 | frontend/public/genre-vote/icons/source.svg |
| アイコン | frontend/public/genre-vote/icons/icon-192.png, icon-512.png, apple-180.png |
| 仕様 | docs/spec/screens/genre-vote.md |
| 更新 | frontend/package.json（テストコマンドのみ）, README.md |

新規18ファイル・既存2ファイル更新。共通UI・既存Button・globals.css・root layout・ui-preview・接続確認画面・Next設定・lockfile・API/Go/DB/Dockerは差分なし。

## UI改善・戻るの検証結果（2026-10-28）

今回変更したファイルは以下の10件。新規ファイルなし。前回からある未コミット変更を保持し、共通UI/既存Button・globals.css・root layout・他画面・保存方式・API/Go/DB/Docker・PWA設定・依存関係は変更していない。

| ファイル | 変更 |
| --- | --- |
| frontend/src/features/genre-vote/genre-vote-screen.tsx | 指定文言削除、Room Props、3操作、戻る後の通知/フォーカス、完了からの戻る |
| frontend/src/features/genre-vote/genre-vote.module.css | 通常フローの余白、3列Grid、流動サイズ、戻る演出 |
| frontend/src/features/genre-vote/use-genre-vote.ts | undoing/undo-enteringと二重操作防止、直前取り消し |
| frontend/src/features/genre-vote/vote-state.ts | 配列を変えないundoGenreVote |
| frontend/src/features/genre-vote/swipe-config.ts | 戻る退場200msの定数 |
| frontend/src/features/genre-vote/prototype-config.ts | 仮データと明記したルームID |
| frontend/src/app/genre-vote/page.tsx | 仮ルームIDを表示部品へ渡す |
| frontend/src/features/genre-vote/genre-vote.test.mjs | 取り消し/不変性/再投票/完了後のテスト追加 |
| docs/spec/screens/genre-vote.md | 今回の契約と検証記録 |
| README.md | 戻ると仮ルームの説明 |

| 検証項目 | 結果 |
| --- | --- |
| 指定2文とその余白の削除 | DOMに対象文なし。390pxのカード上端337.1875px→298px（約39px上へ）、主要ボタン上端836.875px→789.6875px（約47px上へ）。タイトル/進捗とカードの間を20px確保 |
| Figmaと390/320/430pxの画像比較 | ロゴ/右のRoomチップ、赤系・角丸・背面カード、左右の円/中央の補助操作を照合。画像はプレースホルダーのまま。Figmaの「戻す」に対し依頼どおり「戻る」。流動的なカード高とページスクロールを維持 |
| 3操作の幅・配置 | 指定6幅で見送り/戻る/食べたいの順、上端揃え、非重複。円は320pxで56px、375pxで60px、390pxで約62.4px、430/768/1024pxで64px。中央は幅約67.4〜95.9px・高さ64px。全操作44px以上 |
| レイアウト | 通常フローの負のマージン0（読み上げ専用sr-onlyを除外）。横スクロール/内部スクロールなし。safe-areaの既存対応を維持し、下部操作へ通常スクロールで到達 |
| Room #2481・長文 | 既存AppHeaderのroomNumberを使用。指定6幅でロゴとの非重複。長いIDを既存チップ要素へ代入し、折返し・右寄せ・横はみ出しなしを確認。実APIは未接続 |
| 戻る・再投票 | like/skipの取り消し、Ramen→Sushi→戻る→Ramen、進捗1→0、別のchoiceでの再投票を確認。完了記録16件の重複なし |
| 連打・演出中 | 同一イベント内の戻る連打/食べたい併用でも取り消し1件だけ。undoing中は3操作が無効 |
| 完了後・連続戻る | 16件完了→Cafeの取り消しで15件→再投票で16件。連続で先頭まで戻り、先頭では戻るが無効 |
| キーボード・軽減設定 | 戻るをSpaceで操作し、先頭では見送りへフォーカスを復元。取り消し読み上げ文を確認。reduced-motionでも投票/戻るが正常 |
| 既存機能の回帰 | 16件の順序、左右スワイプ/文字/濃淡/回転/退場、ボタン、タッチ縦スクロールと横投票、完了/再試行、PWA/既存画面/ヘルス確認が成功 |
| 写真追加/失敗 | サーバーに一時設定が反映されたことを待ってから、ローカルPNGのリクエスト置換と404を検証。寸法不変・両状態で投票成功。データは元の画像未設定へ復元済み |
| Docker検証 | frontend lint/typecheck/build成功、ロジック7件成功。buildに/genre-voteと専用manifestの静的生成を確認。git diff --check成功 |

比較PNG・JSON・実行スクリプトはCodexのvisualizations領域へ保存し、Gitには追加しない。今回はMicrosoft Edge/Chromiumとタッチエミュレーションで検証。実機iOS/Android・Safari・実際のsafe-area/読み上げ/実インストールは未検証。Go test/vetは対象コード変更なしのため未実施。テストのNode module形式警告は前回同様で、実行失敗なし。

## 前回の検証結果（UI改善前・2026-10-28）

Microsoft Edge/Chromiumのヘッドレスブラウザ、モバイル・タッチのエミュレーションを使用。タッチはCDPのネイティブtouchStart/Move/EndからPointer Eventsを発生させた。検証コード/JSON/PNGはCodexのvisualizations作業領域に保存し、Gitには追加しない。

| 項目 | 結果 |
| --- | --- |
| 全16ジャンル・順序・安定ID | ユニットとブラウザで成功。390px/320pxで全16件を確認 |
| 画像なし | 全件で正常。画像リクエストを発生させない |
| 画像パス追加 | データを一時設定し、ローカルPNGをリクエスト置換して表示/onLoad/投票を確認。元データへ復元済み |
| 画像取得失敗 | 存在しない画像の404でプレースホルダーへ復帰。寸法不変・投票成功・ブラウザ例外なし |
| 右/左スワイプ | like/skipを別々に記録。リリース前は投票数不変 |
| ラベル・透明度・方向切替 | 346pxカードで右20pxは0.231、右60pxは0.694、左50pxへ変更後は見送り0.578/食べたい0 |
| 判定境界 | 276/331/346/386px幅の25%直前/一致/左右/縦優勢をユニットで成功 |
| 復帰・キャンセル | 小移動・Escape・pointercancel・capture喪失・非primaryで投票が増えない |
| 退場・次カード | transitionend時のカード左端750px > viewport390pxを確認し、退場後に次のカードと進捗を更新 |
| 回転・場外リリース | 1000pxの場外ドラッグでも回転12度以内、横スクロールなし、投票成功 |
| アニメーションイベント欠落 | transitionendを抑止し、フォールバックタイマーで次へ収束することを確認 |
| ボタンと二重操作 | 同じ確定処理。連続click/反対ボタンclickでも1件だけ記録 |
| 進捗・全件完了・再試行 | 初期0件、全16件・各choice一致、同URLの完了、見出しフォーカス、再試行0件と先頭/操作フォーカス復帰を確認 |
| 縦スクロール | ネイティブタッチでscrollY=185px、投票0件。続く横タッチで1件投票 |
| 表示幅・下部操作 | 320/375/390/430/768/1024pxと844×390で横スクロールなし・内部スクロールなし。全ボタンへページスクロールで到達可能 |
| 長い名前 | 320pxで料理名をまとまりで折り返し、カード寸法は全件331.1875pxで一定 |
| キーボード | Enter/Space・フォーカス表示・読み上げ属性・完了後フォーカスを確認。修正後は再フォーカスせずEnter→Spaceの連続投票に成功 |
| アニメーション軽減 | 回転0・transition/keyframes軽減、実行中の設定変更後も投票可能 |
| PWA向け設定 | manifestは200、display=standalone、start_url/scope/id、192/512アイコン200、Appleアイコン参照、theme-colorとviewport-fit=coverを確認 |
| 既存への影響 | /と/ui-previewは正常でmanifest追加なし。/の接続成功と/api/healthの200/status=ok/database=okを確認 |
| API・例外 | プロトタイプから/apiへのリクエスト0件、ブラウザ例外0件 |

Docker Composeで以下を実施した。

- `docker compose exec frontend npm run lint`: 成功、警告なし。
- `docker compose exec frontend npm run typecheck`: 成功。
- `docker compose exec frontend npm run build`: 最終ソースで成功。/genre-voteと/genre-vote/manifest.webmanifestの静的生成を確認。
- `docker compose exec frontend npm run test:genre-vote`: 5件成功。NodeのMODULE_TYPELESS_PACKAGE_JSON警告は残るが、テスト失敗なし。既存package.json全体のmodule設定を変えないため維持する。
- `git diff --check`: 成功。
- Go test/vet・DB検証: 対象変更なしのため未実施。既存API/DB結合はヘルスチェックで確認。

実機iOS/Androidの操作感・実際のsafe-area/ソフトウェアキーボード・iOS Safari・スクリーンリーダー・HTTPSでの実インストールは未検証。PWA設定済みとインストール実証済みを区別する。Service Workerとオフライン動作は未実装。

## 未決定事項

今回のプロトタイプ実装に必要な未決定事項なし。本番のルーム/参加者との接続、正式URL・認証、永続化、集計・待機画面の遷移条件・本番PWAキャッシュ方針は今回確定しない。

## 進捗

- UI改善開始: 2026-10-28の今回指示を受け、説明文/余白・仮ルームID・3操作・直前取り消しの仕様を更新。Context7でReactの配列の非破壊更新とref/フォーカスを確認。自己レビュー96点で着手。
- UI改善の残作業: 画面/状態/テスト/READMEの更新、表示比較と回帰検証。以前の検証結果は修正前の記録として保持する。
- UI改善の一次検証: lint/typecheckとロジック7件、戻る/連打/再投票/完了後/キーボード/軽減設定、指定6幅と長いID、既存16件/スワイプ/タッチ/PWA/接続確認の回帰検証に成功。390pxのカード上端は337.1875px→298px。
- 表示比較の調整: 既存Buttonのtransition-allにより幅変更直後の円形ボタンがclampの中間値になることを確認。この画面の操作だけtransition-propertyを色/影/transformに限定し、幅/高さは即時にレイアウトへ反映する。指定幅の実寸と画像を再確認する。
- UI改善完了: 10ファイルを更新し、仕様のStatusをVerifiedへ戻す。指定6幅・長いID・比較画像・戻る全条件・7テスト・Docker最終build・既存機能の回帰を確認済み。今回の残作業/ブロッカーなし。実機未検証項目は上記を参照。

- 完了: 指定資料/実コード/ブランチ確認、Context7確認、技術初期値と今回対象の契約確定。
- 実装開始承認: 今回のユーザー指示に基づく。上記を自己レビュー95点で確定してから実装に着手。
- 完了: 16件のデータ、写真なし/失敗のカード、Pointer Events、方向ラベル、共通確定処理、動き/軽減設定、完了/再試行、画面専用PWA設定とテストを実装。
- 一次検証: 型検査成功、ロジック5テスト成功。lintのrefを含む戻り値オブジェクトの指摘を、描画値/DOM refの分割受取りで修正し成功。画面の本番buildも成功。
- 検証時の修正: 新規ディレクトリのdevルートが404となりfrontend再起動で再認識させる。ネストしたmanifest.tsはbuild対象にならなかったためContext7でroot限定を確認。期待する専用URLで200のmanifestを返す静的Route Handlerへ変更し、build/HTTPで検証する。
- 表示仕上げ: 320pxの長いジャンル名画像で装飾補足がカード見出しの間に入ることと、画面タイトル末尾だけの折返しを確認。装飾補足を除き、文節/料理名ごとの折返しへ修正して同幅で再確認する。
- キーボード再現: Enterで投票後、アニメーション中のdisabledによりactiveElementがbodyへ移り、次のSpaceが投票に使えない。期待は連続操作可能。キーボード操作元の選択を記憶し、idleになった時に同じボタンへフォーカスを戻してEnter→Spaceの連続投票を検証する。
- 最終検証: 上記のブラウザ・画像fixture・境界・連続キーボード・Docker検証に成功。画像の一時設定は全件未設定へ復元し、検証専用の写真はGitに追加していない。
- 残作業: 今回のプロトタイプ受け入れ条件は確認済み。実機・本番仕様・オフライン等は上記の未検証/対象外を参照。
- ブロッカー: なし。既存Composeでサービス起動済み。新規ルート認識のためfrontendを再起動した。manifestルート変更後のbuildはfrontend再起動と重なり中断したため、再起動完了後に最終buildを実行して成功を確認した。
- 関連Issue・PR・コミット: None。作業はfeature/genre-vote、共通UIのレビューを前提にする。

## Self-Review

- Score: 96/100
- Review date: 2026-10-28
- Reasons for deductions: 一意性29/30、状態20/20、型15/15、外観14/15、再利用10/10、検証8/10。実機インストール/操作感/支援技術は自動検証と区別する。
- Revisions made: 今回の依頼を反映して説明文/余白を撤去、仮ルーム表示・3列操作・直前投票の取り消しを実装。幅変更時の寸法遷移を調整し、比較画像と戻る/回帰/最終buildを確認。前回の記録を保持し、今回の結果を区別してVerifiedへ更新。
