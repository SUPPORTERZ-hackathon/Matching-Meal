# ジャンル投票結果画面・UIプロトタイプ

- Status: Verified
- Last updated: 2026-10-31
- Related issue: None
- Related specifications: genre-vote.md, genre-vote-waiting.md, ../themes/design-system.md, ../components/common-ui.md, ../services/room-lifecycle.md
- Implementation files: frontend/src/app/genre-result/, frontend/src/app/ui-preview/genre-result/, frontend/src/features/genre-result/, frontend/src/features/genre-vote-waiting/genre-vote-waiting-preview.tsx, frontend/src/features/genre-vote-waiting/genre-vote-waiting-screen.tsx, frontend/package.json

## 目的・範囲・承認

### 写真と発表演出の同期（2026-10-31）

主仕様は[genre-card-motion.md](../components/genre-card-motion.md)。今回の明示依頼を承認根拠とし、写真の準備完了とpop/図形の開始を同期する。準備待ちは写真領域だけ最大700ms、超過は既存代替表示で演出を継続し、その再生中の遅い写真の途中参加を防ぐ。既存850/1600msの演出、軌道/ハート/配置/CTA/遷移は維持。後段の「マウントで即開始」は本契約へ更新。Progress：実装・検証済み、自己レビュー96点。準備完了の最初の描画で写真がloaded/opacity1、写真と図形の開始時刻一致、取得遅延/404のfallbackと再生中の写真非途中参加、ハート残存/図形消去/再描画で再生しないこと/軽減設定/指定幅を確認。Docker lint/型検査/40テスト/build成功。詳細は主仕様。

### 16ジャンル写真の参照更新（2026-10-31）

画像の主仕様は[genre-photos.md](../components/genre-photos.md)。今回の明示的な依頼に基づき、ResultArtworkのローカル画像パス判定を共通のgetGenreImagePathへ置き換え、GENRESの`/images/genres/`写真をホーム・投票と共用する。旧`/genres/`プレビュー画像も互換読み込みする。結果データ・画像領域・登場演出・ハート・装飾・固定ボタンは変更しない。Progress：ramen/cafe/sushi-seafoodの共通写真の読み込み、旧プレビューの画像失敗/代替表示、登場後のハート残存/図形消去を確認済み。Docker lint/型検査/38テスト/build成功。仕様の自己レビュー97/100、未決定事項なし。

### 店舗投票プロトタイプへの接続（2026-10-30）

今回の店舗画面実装依頼により、通常ルートをGenreResultPrototypeで包み、既存onFindShopsから`/restaurant-vote?genre=固定ID`へ遷移する。画面の結果型・料理画像/ハート/装飾・固定CTAは変更しない。コールバック接続時の注記だけ「選択したジャンルを引き継ぎます」に更新する。未接続時の準備中表示と、既存開発プレビューのID確認を維持。後段の店舗画面未実装という記録は過去の状態。主仕様は[restaurant-vote.md](restaurant-vote.md)。進捗：接続/ジャンルID受け渡し、既存16ジャンル投票/戻る/待機/共通UIのブラウザー回帰、Dockerの24テスト・lint・型検査・buildを確認済み。

2026-10-30のユーザーの実装依頼を承認根拠とする。Figma画像09に近い結果発表、丸い料理画像の一度きりの弾力ある登場、放射状の図形、スクロール中も表示される店舗選定ボタン、開発用プレビューと待機からのモック接続を実装する。本仕様の技術的補足は今回の明示要件の範囲に限る。

## 対象外

投票集計/同票処理/勝者決定の業務ルール、API/DB/Go/Docker/依存追加、実参加者との同期、正式な店舗選定画面、外部写真取得、PWA manifest/scope/Service Worker/キャッシュの変更。他画面のUIや待機の演出を作り直さない。

## ハート追加・PWA調査の現行契約（2026-10-30）

最新のユーザー指示を承認根拠とし、本節を前回の「赤い丸いハート飾りも撤去」の判断より優先する。今回は紙吹雪の図形を消去し、画像に付くハートは常設の装飾として残す。自己レビュー97/100、未決定事項なし。

### 修正前・期待する表示と変更範囲

- 現状のResultRevealは料理画像だけをpopImageに置き、Figma09/figma-index.cssのresult-image span相当のハートが欠落している。
- popImage内でResultArtworkと同じ階層にspanを追加し、既存lucide-reactのHeart SVGを白塗りで表示する。絵文字/操作/お気に入り状態は追加しない。
- Figmaの直径45px・白枠4px・right:0/bottom:4pxを基準にする。写真の内容幅196px（外形210px−左右の7px枠）に対しバッジ幅23%で約45px、狭幅では写真に比例して縮める。背景はprimary、白枠/白いハートはcard/primary-foreground。専用の追加影は参考CSSにないため設けない。
- 白いHeart SVGはバッジ内幅/高さ64%、strokeWidth=0。spanはaria-hidden、pointer-events:none、SVGはfocusable=false。非操作要素のためtabIndex/イベント/役割を付けない。
- 既存850msのpopImageの子に含めることで、写真と同じ座標系でscale(.2)/1.15/.94/1に追従させる。図形レイヤーの外に置き、図形DOMを削除した後もハートは残す。
- 変更はresult-reveal.tsx、結果専用CSS、本仕様の3ファイルだけ。PWA関連ソース/ページmetadata、共通UI、結果データ/写真処理、固定CTA、待機/投票/バックエンド/DB/Dockerは変更しない。開始時の未コミット変更を保護し、対象外の24ファイルのハッシュを保存して照合する。

### PWA調査の範囲

- manifestの内容/配信/参照をソースとlocalhostの実レスポンスで確認する。scopeの前方一致、start_url、display、アイコン、viewport、appleWebApp、Service Workerの実装/登録を確認する。PWAインストールや端末設定の変更はしない。
- Context7のMDN scope、Next.jsのPWA/manifest公式ドキュメント、Lucide公式のSVG fill/strokeWidthを参照する。
- 修正が必要な場合は原因/案を本書と最終報告へ記録する。manifest、PWA設定、関連ソースは変更しない。インストール済みPWAの実機遷移を検証したと扱わない。

### 受け入れ条件・検証・Progress

1. Figma09と390px画像を比較し、赤円/白枠/白ハート、右下の位置/写真との比率を確認する。
2. 50/442/646/850msの画像とハートの相対位置/比率を確認し、図形消去後もハートが1個残ることを確認する。レイアウト/演出定数/CTAは維持する。
3. 320/375/390/430/699/700/1024px、横844×390、低い390×320、文字200%、写真未登録/成功/失敗でハートと写真が正常。横スクロールなし、固定CTA/既存画面の回帰を確認する。
4. Docker lint/typecheck/既存15テスト/build、git diff --check、24ファイルのハッシュ一致。低影響の装飾はブラウザー検証を用い、実装をなぞる単体テストは追加しない。

- 完了：資料/実コードの照合、PWAの初期調査、Context7確認、契約と自己レビュー。
- 承認：今回の具体的な追加指示。97/100（一意性30/30、状態20/20、型15/15、外観14/15、再利用10/10、検証8/10）。
- 完了：ハート追加、PWAレスポンス/各画面参照の調査、Docker/ブラウザー検証、24ファイルのハッシュ照合と結果記録。今回の受け入れ条件を確認しVerifiedへ更新。
- 残作業：今回の実装対象内の残作業なし。PWAの修正案は未適用、実機のインストール/standalone遷移は調査のみの範囲外。
- ブロッカー：なし。未実施の実機インストール/standalone遷移を結果と区別する。

### PWA整合性の調査結果（設定変更なし）

現行の供給元は`frontend/src/features/genre-vote/pwa-manifest.ts`、配信ルートは`frontend/src/app/genre-vote/manifest.webmanifest/route.ts`。localhostの実レスポンスは200・application/manifest+jsonで、以下を確認した。

| 項目 | 現在値 |
| --- | --- |
| manifest URL | `/genre-vote/manifest.webmanifest` |
| id / start_url / scope | いずれも`/genre-vote` |
| name / short_name | メシマッチ・ジャンル投票プロトタイプ / メシマッチ |
| display / lang | standalone / ja |
| theme_color / background_color | #ED3B33 / #FFFDFA |
| アイコン | PNG 192×192・512×512、purpose=any。両URLの200と実ファイル寸法を確認 |

| 画面 | scopeに含まれるか | 実DOMのmanifest参照 | 状況 |
| --- | --- | --- | --- |
| `/genre-vote` | 含む | `/genre-vote/manifest.webmanifest` | start_urlと一致、形式上の不整合なし |
| `/genre-vote-waiting` | 含む | 同上 | URLの前方一致で含まれる。ディレクトリ配下だからではない |
| `/genre-result` | 含まない | なし | アプリ全体としてのscope/manifest参照が未整備 |
| 店舗選定画面 | URL未定なので判定不可 | 実装なし | 現設定では`/genre-vote`で始まらない別ルートを追加しても対象にならない |

scopeはパスのディレクトリ区切りではなく前方一致で判定するため、`/genre-vote-waiting`は現在含まれる。scope外のページへ進むとURLバーなどが表示される場合があり、実挙動はブラウザー/OSに依存する。したがって結果画面まで常に同じアプリ表示を維持できる設定とは評価しない。[MDN scope](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope)を根拠に判定した。

`start_url`はscope内にあり有効。ただし起動先はプロトタイプ投票画面で、再起動は投票のメモリ状態を復元せず初期表示になる。正式ホーム/ルーム復帰の入口としての選定は未決定。現在の`/`は開発接続確認画面なので、無条件に`start_url:"/"`へ変える提案はしない。

各ページにviewport-fit=cover、同じtheme-color、Appleアイコン参照がある。投票/待機のソースにはappleWebApp指定があり、実DOMではmobile-web-app-capable=yes・apple-mobile-web-app-titleを確認した。結果にはこの指定/タグがない。旧apple-mobile-web-app-capableというタグ名だけで判定せず、生成されたタグを区別して記録した。これも全画面のPWA metadataを共通化する際の確認対象となる。

Service Workerの実装/登録コードと配信ファイルは見つからず、新規のブラウザーコンテキストでも登録0。オフライン動作は保証されない。一方で、Service Workerがないことだけで「インストール不可」とは判定しない。manifestのname/icons/start_url/display等は現行の主要項目を満たし、HTTPSまたはlocalhost/loopbackでの提供と実ブラウザーの条件を確認する必要がある。スマートフォンのLAN IPへの通常HTTPはlocalhost例外ではない。インストールの成立や案内UIはブラウザー/OSでも異なる。[MDNインストール条件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[Next.js PWAガイド](https://nextjs.org/docs/app/guides/progressive-web-apps)を参照した。

今回の実行は通常のEdgeタブであり、display-mode:standalone=falseを確認しただけ。インストールやスマートフォンの設定変更は実施していない。実機のアプリ内遷移が成功したという検証結果にはしない。

### 推奨修正案（今回は未適用）

1. 本アプリ専用オリジンを前提に、現行manifestのURL/idを保ったまま`scope:"/"`へ広げる案が最小変更。共有オリジンなら正式な共通パスを先に設計する。単に`/genre-vote/`へ末尾スラッシュを追加するとstart_url/待機/結果が外れるため、全画面対応の解決策にはならない。
2. root layoutの共通metadataなどから同一manifestを参照し、結果と将来の店舗選定を含む全画面へ行き渡らせる。appleWebApp/アイコン等も同じ共通境界で整合させる。個別ページでの参照漏れを防ぐ。
3. start_urlは正式なホーム/参加・ルーム復帰導線の実装後に決める。現行のプロトタイプ用起動先は形式上有効なので、scope拡張と起動フロー変更を分けて検討する。
4. 固定のHTTPSオリジンで新規/既存インストール、起動、投票→待機→結果→店舗選定、再起動、iOS/Androidでの表示モードを検証する。
5. Service Worker/オフライン/キャッシュは別仕様で扱う。今回のscope/リンク整備案だけを理由に追加しない。

以上は調査と提案のみ。manifest、関連ページmetadata、PWA定数、root layout、Next設定、依存/キャッシュのコードは一切変更していない。`pwa-heart-task-audit.json`をCodexのvisualizations領域に保存した（Git対象外）。

### ハート追加の検証結果と変更ファイル

今回変更したのは`frontend/src/features/genre-result/result-reveal.tsx`、`frontend/src/features/genre-result/genre-result.module.css`、本仕様の3ファイル。前回の実装差分は保持し、追加の依存/実装ファイルは作成していない。

| 検証 | 結果 |
| --- | --- |
| Figma比較 | 390pxの通常表示で外形約45.08px、赤背景/白い4px枠/白塗りHeart SVG。写真右下の位置/比率を画像09と目視照合 |
| アニメーション追従 | 50/442/646/850msで画像に対する相対位置/幅/高さが一定。画像と同じ親で拡縮し、見出し/ジャンル名/カード/固定操作の位置と寸法は不変 |
| 終了後 | 図形i要素0、ハート1個。図形レイヤーの外にあり、終了処理で消えない。通常の再描画/CTA操作でも残る |
| 非操作/アクセシビリティ | aria-hidden=true、SVG focusable=false、tabIndexなし、操作要素なし、pointer-events:none。お気に入り/投票/送信の処理なし |
| 指定7幅 | 320/375/390/430/699/700/1024pxで右下配置、画像の矩形内、横スクロールなし。小さい写真ではバッジも比例して縮小 |
| 横向き/低い画面/文字200% | 844×390、390×320、320×568の文字200%でハート/画像が正常。通常縦スクロールを維持 |
| 画像の状態 | 写真未設定、読込失敗、ブラウザーでPNG fixtureを返した成功の全状態でハートを表示。成功/失敗で画像との相対配置は同じ |
| 軽減設定 | 写真はanimation:none、図形消去、ハートは静止した状態で1個を表示 |
| 固定CTA/既存画面 | 既存CTAのタッチ/Space/未接続案内、本文末尾の余白、共通UI/接続確認に成功。既存投票のタッチ/縦スクロール/undo/16件後の待機を回帰確認 |
| Docker | lint・typecheck・投票7+待機4+結果4=15テスト・build成功。初回typecheckは同時buildによる生成型更新と競合したため、build終了後に順番に再実行して成功。設定変更なし |
| 保護/差分 | PWA関連/共通UI/データ/固定CTA/待機/投票等24ファイルの前後ハッシュ一致、git diff --check成功。画面からAPI呼出し0、ブラウザー例外0 |

SVGによるハート形状はFigmaの文字♥と描画差があるが、円/枠/色/位置は参考寸法に合わせた。前回の「常設ハートも撤去」は今回の明示指示で置き換え、消去対象は放射状図形に限定した。Figmaの写真自体は未登録のため通常画面は既存プレースホルダーで確認した。

主な証跡は`genre-result-heart-verification.json`、`genre-result-heart-390.png`、`genre-result-heart-pop-390.png`、`genre-result-heart-still-390.png`、`genre-result-heart-text-200.png`。Codexのvisualizations領域に保存し、Gitへ含めない。実機iOS/Android・Safari・支援技術・実際のsafe-areaは未検証。

## 前提条件・資料・ブランチ

- AGENTS、README、画像09、Figma CSS/TSX、テーマ/共通UI/投票/待機仕様と対応コードを確認。結果画面の仕様/実装は未作成。
- feature/genre-resultを継続。git fetch origin main後のorigin/mainとHEADは同じ6e0367e。開始時の変更なし、待機実装もmainへマージ済み。ユーザー指定のmainベースを採用する。
- room-lifecycle/rooms-and-participants仕様では投票集計と店舗選定は対象外。既存appにも店舗選定画面がないため、集計ルールや次URLを新設しない。
- Context7でNext Imageのfill/sizes/onError、ReactのuseLayoutEffect、MDNのResizeObserver/cleanupを確認済み。
- 再利用：AppHeader、StepProgress、PageContainer、BottomAction、既存Button、genres.ts、既存フォント/色/カードトークン、待機演出のCONFETTI_COLORS（読み取りのみ）。

## URL・アクセス・画面階層

- `/genre-result`：API未接続の表示プロトタイプ。直アクセス可能。既存仮Room #2481、ラーメン決定、3人、ラーメン3/焼肉2/寿司・海鮮1票という明示したモックを使う。
- `/ui-preview/genre-result`：developmentのみ。productionはnotFound。16ジャンル選択、演出再生、写真失敗/データ参照、内訳なし/不明IDを確認できる。通常画面へ操作を出さない。
- 共通ヘッダー（ロゴ/roomId）、StepProgress(currentStep="genre")、中央の発表見出し、丸い画像/一時的図形、決定ジャンル名/説明、投票結果カード、固定CTAの順。
- h1「今日のごはんは…」、上に「みんなの気分がマッチ！」、ジャンル名のh2と「に決まりました！」、カードh2「投票結果」。サンプルの旨はカード付近に「サンプル結果・実際の集計ではありません」と可視表示する。

## 入力・出力・データ

- 表示用`GenreResultData`はreadonly decidedGenreId:string、participantCount:number、rankings:readonly {genreId:string,votes:number}[]。APIの応答型とは定めない。
- ジャンル名/写真は既存GENRESからIDで参照。IDと表示名を混同しない。表示部品へgenres:readonly Genre[]とresultを渡す。
- `resolveGenreResult`は決定IDと内訳IDの存在/一意性、参加人数と票数が非負整数・票数<=参加人数を検証し、表示用のgenreオブジェクトを返す。不明ID/不正値はnull。順位は渡された順を表示し、sort/勝者計算/同票処理はしない。決定IDを順位から推測しない。
- バー幅はparticipantCount>0ならvotes/participantCount*100、0なら0。内訳が空なら空状態を表示。決定IDが有効なら画像/見出しは表示できる。
- モック結果は専用ファイルに分離。開発用のジャンル切替は指定したIDを決定IDとするサンプルを作り、3/2/1票を付けるだけで投票集計とは扱わない。
- `GenreResultScreenProps`はresult、genres、roomId?:string、isPrototype?:boolean、replayKey?:number、onFindShops?:(genreId:string)=>void、children?:ReactNode。childrenは開発用操作の本文スロットで、通常画面は未指定。プレビューの末尾も固定CTAの実測余白で保護する。取得・永続化・集計は表示部品の責務外。

## 画像・表示状態・エラー

- 最大210px・親幅の70%以下、1:1の円、白い7px枠と既存の写真用影を基準とする。写真はNext Image fill/object-fit:cover、sizesを指定する。
- `/genres/`内のimagePathだけを使用。写真未設定/許可外パス/読み込み失敗は、暖色グラデーション/皿/食器アイコンの丸いプレースホルダーを正常表示する。外形・縦横比は変わらない。設定が変わった際の画像のloaded/failedはキーで初期化する。
- 今後はpublic/genres/に写真を置きGENRESのimagePathを設定するだけで反映。既存GenreArtworkは投票カードの文字/操作案内と一体なので再利用せず、結果専用の円形表示を作る（投票側は変更しない）。
- 不正な結果は「結果を表示できません」と説明を表示し、写真演出やジャンル未指定の操作を出さない。通信しないためloading/retryは今回不要。

## 登場演出・放射状装飾

- 料理画像の外枠だけに850msのCSS keyframes、scale(.20)→1.15（52%）→.94（76%）→1（100%）、opacity 0→1を基準にする。赤いジャンル名やカード/ボタンは動かさない。余白を写真外形より大きく取る。
- 画像と図形レイヤーは同じマウントで同時開始。図形16片、丸/四角/長方形、待機と同じ5色を使用。待機の軌道やCSSは変更せず、結果用に上下左右/斜めへ放射状の方向・距離・回転・遅延0〜120ms・時間を定数配列で管理する。
- 図形全体は1600ms、各片も遅延込み1600ms以内に消える。立ち上がりで中心から急速に拡大し、外周へ広がって透明化。一度のみ。写真は850ms以降scale1で静止。
- 写真と図形を囲む高さ260pxの局所ステージに展開。図形だけ絶対配置/クリップし、本文の通常フローを維持する。pointer-events:none/aria-hidden。
- 終了イベントまたは1600+100msタイマーで図形のDOMを除去。人数/写真ロード/CTA応答の再描画で再生し直さない。決定IDの変更、明示的なプレビューのreplay、再訪は新しい発表として1回再生。
- reduced-motionでは写真scale1・opacity1、図形非表示→クライアント起動後に除去。設定の途中変更で図形を除去、解除で復活しない。タイマー/リスナーをcleanupする。

## レイアウト・固定ボタン・アクセシビリティ

- 共通最大430px/左右22px、安全領域/700px切替を維持。mainの余白は画面専用に0とし、StepProgressの配置は既存投票/待機と同一。本文は上24px・左右max(22px,safe-area)。
- 発表見出し19px、決定名34px、説明13px、カードは共通meal-card白/枠/22px角丸/影/20px余白。順位と名前/票数は読みやすさのため参考の9/11pxから11/13pxを基準にする。長い名称は自然に折り返す。
- 本画面専用のfixedラッパーでBottomActionとButton primary/mealを再利用。bottom:0・中央・width100%/max430px、safe-areaを下/左右に適用。共通BottomAction自体のフローやPropsは変更しない。
- ResizeObserverで固定領域の実高を測り、画面ルートのCSS変数を更新し、本文末尾へその高さ+24pxを予約する。文字拡大/折返し/未実装案内の可変高も反映。SSR用に十分なフォールバック高も指定。page/bodyのスクロールは止めない。
- 画面高が足りない場合も通常ページスクロール。固定ボタンはフォーカス可、本文末尾/ランキングは最後までスクロールしてボタンより上へ表示できることを確認する。
- 準備中の店舗選定へ架空URLを作らない。ボタン直下に「店舗選定フローは準備中です」。押下時は選んだジャンルIDをコールバックへ渡せる設計とし、未接続時はgenre名を含むrole=statusを表示。偽の店舗検索結果は作らない。
- 見出し構造、読み上げ名、順位/票数、progressbarの人数/値、キーボード/フォーカスを維持。装飾は読み上げない。未実装案内と結果は演出軽減時にも読める。

## 待機画面との接続

- 通常待機の2/3人はそのまま。API結果や完了通知は捏造せず、自動で人数を増やさない。
- 待機開発プレビューだけに「全員完了から結果へ進む（モック）」を追加し、明示操作で全員完了と遷移要求をセットする。全員完了の入力を確認して既存Next routerで`/genre-result`へ進む。既存の1/3・2/3・3/3表示切替は自動遷移させず維持する。
- 待機の「結果画面は準備中」は今回の結果実装と矛盾するため、「投票結果の受信を待っています」に説明/aria-liveだけ修正。共通UI/人数管理/演出は維持。
- 受け渡すのはモック結果を表示する導線。投票内容は転送せず、実際の集計とは結び付けない。結果の再読込は初期モック、プレビューの状態はメモリだけ。
- 将来のAPI結果取得・正式な自動遷移は別仕様。決定IDを次へ渡す責務はonFindShopsに用意し、店舗画面のURLはここで決定しない。

## 参照資料と既存コードとの差

- Figma固定ラーメン/3票/名称「お寿司」は既存IDと名称（寿司・海鮮）に対応させる。実集計ルールには採用しない。
- Figmaの常設confettiは一度きりの演出へ変更。ハートは本書先頭の最新契約に従って常設の画像装飾として追加した。料理写真が未登録なので既定では円形プレースホルダーを表示する。
- 共通テーマはBottomAction通常フローだが、本画面は明示依頼のfixed配置を画面専用ラッパーで実装する。共通仕様は変更しない。
- READMEのmain/feat手順とAGENTSのdev/feature手順は既存の差。今回の明示指定通り最新mainからの既存ブランチを使用し、運用文書を変更しない。

## 受け入れ条件・検証

1. 390pxの完成画像をFigma09と比較。画像pop開始/最大/図形途中/終了を保存する。
2. 850msの拡縮率、1600msの放射/回転/透明化/図形0、再描画で再生なし、軽減設定と設定変更を確認する。
3. 16ジャンルの切替、写真未登録/成功/失敗、長名/不正ID/内訳なし/0票を確認。型/純粋関数をテストする。
4. 320/375/390/430/699/700/1024px、844×390、低い390×320、文字200%で横スクロールなし、固定CTAが表示され本文末尾を覆い隠さない。
5. 固定ボタンのEnter/Space/タッチ、未実装案内、ジャンルIDのコールバックを確認。スクロール時の固定位置と実高予約を測る。
6. 既存投票→待機、開発操作で全員完了→結果、待機演出/人数/共通UI/接続確認を回帰確認。通常画面にデバッグ操作なし、本番プレビュー404。
7. Docker lint/typecheck/既存テスト/新規結果テスト/build、git diff --check。API呼出しなし、共通/投票/待機演出/PWAの変更なしを確認。

## 未決定事項

今回の表示プロトタイプに必要な未決定事項なし。実集計/同票/結果購読/本人識別/店舗選定URL/本番PWAは対象外として未確定のまま残す。

## 作成・変更ファイル

### 作成（13ファイル）

- `frontend/src/app/genre-result/page.tsx`：既存ジャンル/モック結果を供給する通常ページ。
- `frontend/src/app/ui-preview/genre-result/page.tsx`：開発限定のプレビュー入口。
- `frontend/src/features/genre-result/genre-result-screen.tsx`：共通ヘッダー/進捗・見出し・投票内訳。
- `frontend/src/features/genre-result/genre-result.module.css`：結果固有の配置・演出・固定CTA。
- `frontend/src/features/genre-result/genre-result-preview.tsx`：16ジャンル・再生・画像失敗/境界条件の操作。
- `frontend/src/features/genre-result/result-data.ts`：表示型・ID参照・入力検証・割合。
- `frontend/src/features/genre-result/result-data.test.mjs`：入力/境界条件/集計しないことの4テスト。
- `frontend/src/features/genre-result/prototype-data.ts`：表示専用のモックと結果URL。
- `frontend/src/features/genre-result/result-artwork.tsx`：円形写真とフォールバック。
- `frontend/src/features/genre-result/result-reveal.tsx`：画像と図形の同期、終了/軽減設定/cleanup。
- `frontend/src/features/genre-result/reveal-config.ts`：850/1600ms、放射状16片の定数。既存5色を参照。
- `frontend/src/features/genre-result/result-bottom-action.tsx`：固定操作・可変高予約・次へのジャンルID出力。
- `docs/spec/screens/genre-result.md`：本仕様と検証記録。

### 変更（5ファイル）

- `frontend/src/features/genre-vote-waiting/genre-vote-waiting-preview.tsx`：開発用の全員完了→結果導線。
- `frontend/src/features/genre-vote-waiting/genre-vote-waiting-screen.tsx`：全員完了時の説明/読み上げ文だけ更新。
- `frontend/package.json`：test:genre-result script追加（依存/lockfileは変更なし）。
- `docs/spec/screens/genre-vote-waiting.md`：結果実装後の現行接続を記録。
- `README.md`：URL/モック/写真の追加方法/未実装と検証コマンド。

## 検証記録（2026-10-30）

| 検証 | 結果 |
| --- | --- |
| Docker lint/typecheck | 最終TSXで成功 |
| Dockerのテスト | 既存投票7件、待機人数4件、結果4件の計15件成功。既存と同じNodeのmodule形式警告のみ |
| 390pxの見た目 | Figma09と開始/最大/放射途中/終了画像を目視比較。円形210px/白枠/影、中央文字、白カード、赤CTAを再現。写真未登録/装飾撤去等の意図した差は上記参照 |
| 登場 | 50/442/646/850msの描画を取得。scaleは開始1未満、1.15/.94/1。見出し・ジャンル名・カード・CTAの位置/寸法は不変。850ms後は静止 |
| 放射 | 5色/3形状/16片、上下左右の全象限、pointer-events:none、1600msのCSS演出、自然終了後の図形DOM0を確認。通常操作で再描画しても同じインスタンスを維持し、再生成なし |
| 軽減設定 | 初期CSSで図形非表示→起動後除去、画像のanimation:none/opacity1/transform:noneを確認。途中のreduce変更でも除去し、解除後も再生成なし。画像の内容は読める |
| ジャンル/結果入力 | 16種の切替と名称/ID対応、内訳なし/0票/不明ID、順位/票数とバーを確認。渡された決定IDを勝手に計算し直さない |
| 写真 | 未登録プレースホルダー、ローカル失敗パスのフォールバック、ブラウザーでPNG fixtureを返した成功状態を確認。成功/失敗で円の寸法/比率は同じ。sourceデータを一時変更せず検証 |
| 指定7幅 | 320/375/390/430/699/700/1024pxで横スクロールなし、最大430px、ヘッダー/画像が範囲内。スクロール前後でCTAのviewport位置不変 |
| 横向き/低い高さ/200% | 844×390、390×320、320×568で文字200%。内部スクロールなし、通常縦スクロール可能、ボタンがviewport内。200%時は固定領域約244.4pxに対し245pxを予約し、本文末尾に24px以上の間隔を確保。320pxの長名「お好み焼き・たこ焼き」と文字200%、プレビュー末尾の操作/表示も確認 |
| CTA | タッチ/Spaceで操作、通常画面は準備中案内、架空URLへの遷移なし。開発用callbackに決定ID（例cafe）を渡せる。状態更新後も画像/図形を再生しない |
| 待機との接続 | 既存3/3切替は同じプレビューURLを維持。追加の明示操作で全員完了を設定し、結果/ラーメン表示へ到達 |
| 既存投票/待機 | タッチで縦スクロール145→268・誤投票0、右スワイプ/undo、16件後に待機と既存紙吹雪を確認。待機の既存演出/人数/軽減設定のブラウザー回帰検証も成功 |
| 既存共通UI/接続 | /ui-preview正常、/で接続成功、healthはstatus/database=ok |
| 本番の公開範囲 | 一時productionサーバーで結果/待機200、結果/待機の開発プレビュー404、開発操作なしを確認して一時サーバーを停止 |
| 保護・API | 共通UI/グローバル/投票/待機演出/PWAの17ファイルの前後ハッシュ一致。結果/プレビュー操作のAPIリクエスト0、ブラウザー例外0。Go/API/DB/Docker変更なし、Go test/vetは対象外 |

固定CTAの測定と画像/演出のクライアント起動には非同期のタイミングがある。検証はSSRのDOMの存在だけでなく、実高予約が反映されたことを待ってから判定した。プレビューのジャンル選択は明示したlabel/htmlForに修正し、厳密な読み上げ名で操作確認した。画像の影がステージで切れないよう、最後に図形レイヤーだけをクリップするCSSへ調整し、最大拡大時7幅/本文末尾とbuildを別途確認した。

最終CSSでも指定7幅で最大1.15倍の画像がviewport内、図形レイヤーのみclip・画像ステージはvisible、横スクロールなし、本文末尾が固定CTAより上であることを確認した。最終buildは全10ページの静的生成に成功。git diff --checkも成功。

ブラウザー検証スクリプト/JSON/PNGはCodexのvisualizations作業領域に保存し、Gitへ追加しない。主な記録は`genre-result-verification.json`、`genre-result-final-390.png`、`genre-result-pop-start-390.png`、`genre-result-pop-overshoot-390.png`、`genre-result-burst-390.png`、`genre-result-end-390.png`、`genre-result-text-200.png`。

実機iOS/Android・Safari・実際のsafe-area/キーボード・スクリーンリーダー・実機FPS・PWAのインストールは未検証。既存manifestのscopeは`/genre-vote`であり、新しい`/genre-result`を対象とするscope拡張は今回行っていない。viewport/フォント/テーマ/アイコンは再利用し、インストール済みアプリの遷移確認と区別する。

## Progress

- 完了：ブランチ/最新main確認、関連資料/実装/Figma照合、Context7、仕様と自己レビュー。
- 承認：今回の具体的な実装依頼。自己レビュー96/100で開始。
- 完了：結果/円形画像/850ms登場/1600ms放射/固定CTAと可変高予約/開発プレビュー/待機の開発用接続を実装。Docker lint/typecheckと新規4件のテストに成功。
- 完了：既存11件と新規4件、build、結果の演出/写真/固定領域/指定7幅/横向き/低い高さ/200%、待機接続、投票/待機/共通UIの回帰、production404を確認。新規ルートの初回404は設定を変えずfrontend再起動で解消。
- 完了：最後の画像の影のCSS調整後の最大拡大7幅/本文末尾/build、演出途中の軽減設定、長名320px/200%、前後ハッシュと差分確認を完了。受け入れ条件を確認しVerifiedへ更新。
- 残作業：今回の対象内の残作業なし。実機/支援技術/インストール/実集計/店舗選定は未実装・未検証として区別する。
- ブロッカー：なし。
- 関連Issue/PR/commit：None（今回作成/送信なし）。

## Self-Review

- Score: 97/100
- Review date: 2026-10-30
- Reasons for deductions: 一意性30/30、状態20/20、型15/15、配置14/15、再利用10/10、検証8/10。実機の操作感/支援技術の検証を残す。
- Revisions made: 最新依頼に従い画像装飾のハートを追加。PWAはコード/設定を変更せず整合性・推奨案だけを記録し、前後ハッシュと検証結果、実機/インストール等の未検証範囲を区別した。
