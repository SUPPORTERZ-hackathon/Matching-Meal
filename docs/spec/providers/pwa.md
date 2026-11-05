# メシマッチ全体のPWAメタデータと起動設定

- Status: Implemented
- Last updated: 2026-11-06
- Related issue: None
- Related specifications: ../screens/genre-vote.md, ../screens/frontend-ui-integration.md, ../screens/frontend-location-and-flow.md, ../themes/design-system.md
- Implementation files: frontend/src/app/manifest.ts, frontend/src/app/layout.tsx, frontend/src/app/genre-vote/manifest.webmanifest/route.ts, frontend/src/app/{genre-vote,genre-vote-waiting,genre-result,room-create}/page.tsx, frontend/src/features/pwa/, frontend/src/features/genre-vote/prototype-config.ts, frontend/public/genre-vote/icons/

## 目的・範囲・承認

2026-11-06のPWA設定改善依頼を承認根拠とする。既存UI・API・ルート・認証を変更せず、ホームから最終結果まで同じアプリ用manifestを参照できるようにする。本仕様をPWAの主仕様とし、旧genre-vote仕様の画面限定PWA設定を置き換える。

## 前提と実コードによる調査

- fix/frontend-location-and-flow、HEAD 777ba37、作業ツリーはクリーン。既存コミットを保持し、ブランチを切り替えない。
- Next.js 16.4.3 App Router。`/`はAPI接続確認画面、実利用のホームは`/home-preview`。ホームやルーティングを移動しない。
- 旧manifestは`/genre-vote/manifest.webmanifest`、id/start_url/scopeは`/genre-vote`、display=standalone、名前はジャンル投票プロトタイプ。ジャンル投票/待機だけがmanifestを明示参照し、root layoutには共通参照がない。
- 192/512px PNGと180px Apple用PNGは存在するが四隅が透過。maskable専用画像とfaviconの共通指定はない。既存の赤地・白いMのSVGを再利用する。
- Service Worker、登録コード、Cache Storageの使用、PWAライブラリは存在しない。ルーム・投票APIは共通requestの`cache: no-store`とBearer認証を使用する。

## 対象外

バックエンド/DB/マイグレーション/Docker/環境変数/API仕様・接続先、投票・集計、UIレイアウト・CSS・アニメーション、認証・sessionStorage仕様、ホーム移動、依存追加、オフライン投票、Service Worker、push、background sync、公開・トンネル作成、コミット/プッシュ/PR。

## 入出力と初期化

全体用の設定値・画像パスを`features/pwa`で管理し、Next.js公式の`app/manifest.ts`から型付き`MetadataRoute.Manifest`を返す。クライアント側providerや新しい永続状態は作らない。

| 項目 | 値・方針 |
| --- | --- |
| canonical manifest | /manifest.webmanifest |
| name / short_name | メシマッチ |
| start_url | /home-preview（room・認証・demoクエリなし） |
| scope | / |
| display / lang | standalone / ja |
| id | /genre-vote。旧manifestの明示IDを維持し、同じoriginの既存アプリを別アプリ扱いにしないため。起動先や表示範囲を意味しない |
| theme_color / background_color | 既存の#ED3B33 / #FFFDFA |
| any icons | 既存/genre-vote/icons/icon-192.png、icon-512.png |
| maskable | 同フォルダのmaskable-512.png。全面赤地、白いMを中央80%直径の安全円内に保持 |
| Apple Touch Icon | 既存apple-180.pngを同じM・全面赤地・透過なしの180pxに更新 |
| favicon | 同じロゴのfavicon-32.pngを共通metadataで参照 |

- root layoutにApple Web App（capable/title/default status bar）、applicationName、アイコンとthemeColorを集約する。viewportのdevice-width/initialScale=1/viewportFit=coverを維持し、拡大禁止を追加しない。
- manifestのリンクはApp Routerのファイル規約が全ページへ自動出力するものを使用する。子ページのmanifest・icons・Apple設定・themeColorの重複/上書きを取り除く。画面固有title/description/robots/referrerは変更しない。
- 旧manifest URLは308でcanonicalへ転送し、別のmanifest本文を管理しない。既存インストールの更新時期・反映はブラウザー依存であり、実機未検証と区別する。
- アイコンの既存192/512pxとQRロゴ参照URLは維持する。maskableのSVG元も保存し、既存Docker内のsharp（Next.js既存依存）でPNG化する。新しいパッケージや外部画像サービスは使わない。

## 全12画面・状態と遷移

S01=/home-preview、S02=/room-create、S03・06=/room-waiting?room=UUID（roleで表示分岐）、S04=/qr-scan、S05=/j/[joinCode]（/room-joinは既存の別名入口）、S07=/genre-vote、S08=/genre-vote-waiting、S09=/genre-result、S10=/restaurant-vote、S11=/restaurant-vote-waiting、S12=/restaurant-result。すべて同じroot layoutとscopeに含む。開発用プレビューも同じlayoutを継承するが、開発専用の既存アクセス制御を変更しない。

scopeは認証やルート公開を制御するものではない。同一origin内の遷移をstandaloneの表示範囲に含めるだけで、外部Google Maps/店舗詳細の扱い、QR/招待のURL形式・トークン非掲載は維持する。OSから開いた招待URLが必ず既存PWAウィンドウへ入ることは保証しない。

PWAを閉じた後のコールド起動はホームを表示する。同じPWAコンテキストの再読み込みは既存のsessionStorage復元を使う。ブラウザーとインストールアプリ、別タブ・別端末間でセッションが共有される保証や、アプリ終了後の永続認証は追加しない。認証がなければ既存の参加情報不足表示に従う。

## Service Worker・キャッシュ・失敗状態

今回のインストール用設定にService Workerは不要なため追加しない。API/認証/投票/候補/結果のCache Storage・永続HTTPキャッシュやオフライン復元を追加せず、既存のno-store通信を変更しない。静的manifestとアイコンの通常配信は許容する。通信断では既存APIエラーを表示し、オフラインで投票できると案内しない。

アイコン欠損やmanifest不整合はテストで検出する。実機のインストール失敗を架空の成功で補わない。既に端末に登録済みの未知のService Workerは、今回未登録のものとして勝手に解除しない。

## 実行環境・レスポンシブ

- PCのlocalhost/loopbackは開発確認用の例外として使用可能。スマートフォンのlocalhostはその端末自身でありPCへ接続しない。
- LANのHTTP IPは通常secure contextではなく、インストール/位置情報/カメラ等に制約がある。現在のComposeは127.0.0.1公開のため、別端末からのLAN到達性も保証しない。設定変更しない。
- スマートフォン検証には端末から到達できる安定したHTTPS origin（承認済みの公開先やCloudflare Tunnel等）が必要。originが変わると別アプリ・別ストレージ扱いになり得る。トンネルは今回作成しない。
- Androidは対応ブラウザーのインストール/ホーム追加、iPhoneはSafari等の共有→ホーム画面追加→Webアプリとして開く機能を実機で確認する。表示名や導線はOS/ブラウザーの版に依存する。
- 既存のsafe-area、stickyヘッダー、固定下部領域、縦スクロールを維持し、320/375/390/430/768/1024pxを必要に応じて確認する。実機ノッチ・ホームインジケーター・キーボードは机上確認と区別する。

## 受け入れ条件と検証方法

1. Dockerのテストでmanifestのscope/start_url/display/id/アイコンを検証。PNGをdecodeして形式・寸法を確認し、maskableの不透明背景とMの安全円を確認する。
2. HTTPでcanonical manifestの200/Content-Type、旧URLの308→同じmanifest、全画像の200/形式/寸法、ホーム200を確認する。
3. 全12画面（role共通ルートは1回）のHTMLがmanifestリンクを1件だけ持ち、favicon/Apple/themeColor/viewportを継承することをHTTP/ブラウザーで確認。招待URLとAPI認証のコード差分がないことを確認する。
4. 既存テスト、lint/typecheck/build、git diff --check。既存の実API書込テストは隔離DBがなければ有効化しない。
5. ブラウザーでホームと主要な遷移を確認し、実インストール・standalone起動・実機セッション復元を実施できない場合は未検証とする。インストール可能な構成とインストール実証は別扱い。

## 未決定事項

今回の設定修正に必要な未決定事項なし。安定したHTTPS公開origin、iOS/Android実インストール・既存インストール更新、PWA再起動時の認証永続化は別途確認が必要。

## Progress

- 完了：Git/既存PWA/全ルート/起動ページ/アイコン/キャッシュ・セッション実装を調査。Next.js公式資料をContext7経由で確認し、MDNのインストール要件とidの契約を照合。
- 完了：共通manifest/config/root metadata、旧URLからの308転送、ページ別PWA設定の除去、maskable/favicons/透過なしAppleアイコン、4件のPWAテストを実装。既存192/512pxアイコン・QR参照URLを保持。
- Docker検証：`npm run lint`、`npm run typecheck`、`npm run build`成功。ビルド一覧に新しい/manifest.webmanifestと旧URL転送を確認。既存テストに`src/features/pwa/*.test.mjs`を加えた115件中111件成功、失敗0、隔離DBを要する実API結合テスト4件は既定どおりskip。既存MODULE_TYPELESS_PACKAGE_JSON警告あり。
- 画像検証：sharpでmanifest画像3枚とApple/faviconのPNG形式・寸法を検証。maskableは全画素不透明でMの全白画素が半径40%の安全円内、Apple用は透過なし。全5画像のHTTP 200とContent-Type image/pngも確認。
- HTTP検証：canonical manifestは200/application/manifest+json、start_url=/home-preview・scope=/・id=/genre-vote・standalone。旧URLは308、追従後はcanonicalと同じ本文。S01〜S12の11共通ルートに/room-joinと/を加えた13 URLで、200・manifestリンク1件・共通favicon/Apple/application-name/theme/viewportを確認。S03とS06は同じ認証付きルートのためメタデータ確認は共通。
- 起動時の切り分け：稼働中のNext devでは新規manifestルートが一度404。本番ビルド成功後にfrontendサービスだけを再起動し、新規ルートの200を確認した。Docker設定・backend/dbは変更していない。
- ブラウザー検証：localhostのアプリ内ブラウザーでホームの共通manifest/アイコン/theme/viewportをDOMから確認。ホーム→作成→ホームに到達（開発コンパイル待ちあり）。作成画面390pxでstickyヘッダー上端0・固定ボタン下端844と共通manifestを確認。招待/j/7K9M2QXRで参加欄1つ・no-referrer・共通manifest、Consoleのerror/warnは確認時0件。実参加POSTは行わない。
- 表示検証：ホーム320/375/390/430/768/1024pxで横スクロールなし・manifest1件。390pxの通常ブラウザー画面をGit管理外の`C:/Users/TanaT/.codex/visualizations/2026/10/27/01a17eaf-0c75-7db0-a708-c505d44d081a/pwa-home-390-20261106.jpg`へ保存（インストール済み表示の証拠ではない）。
- APIへの影響：既存の/api/healthでstatus/databaseともok。API client・no-store・認証・セッション・投票ロジックは差分なし。新しいSW登録/Cache Storage/オフライン処理なし。DB書込を伴うAPI回帰は未実施。
- 未検証：Android/iPhoneの実インストール、standalone内の全画面遷移・戻る・再読み込み、実機safe-area/キーボード、既存インストールの更新、PWAコールド起動時のセッション維持、別端末招待、公開HTTPS origin。Statusは実機未検証のためVerifiedにしない。
- 残件：スマートフォンから到達できる安定したHTTPS originで配信し、実機でホーム追加/起動/実ルーム操作を確認する。公開作業・トンネル作成・設定変更はしていない。ブラウザー/PWA間やアプリ終了後のセッション共有は保証せず、認証永続化が必要なら別仕様とする。PWAのためのバックエンドコード変更は不要。
- 差異：旧genre-vote仕様の「画面限定manifest・他画面へ追加しない」条件と旧helperのパスを、新しい全体PWA仕様への参照へ更新。旧検証ログは履歴として保持。
- 残る文書差異：README.mdの3行目・293行目は「PWA未実装」のままで、本仕様の設定実装状況と一致しない。今回のフロントPWA設定範囲ではREADMEを変更せず、最終報告へ記載する。オフライン未実装という説明は引き続き正しい。
- Git確認：git diff --check成功。HEAD 777ba37と既存コミットを保持。バックエンド/DB/Docker/環境変数/API仕様/接続先/README/package・依存/共通UI/CSS/認証・セッション/現在地・投票APIロジックに差分なし。
- コミット/プッシュ/PR作成：なし。

## 参照資料

- [Next.js PWAガイド](https://nextjs.org/docs/app/guides/progressive-web-apps)・[manifest規約](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)（Context7のNext.js公式ソース）
- [MDN インストール要件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN manifest id](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)・[icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)
- [W3C maskableの安全円](https://w3c.github.io/manifest/#icon-masks)
- [Apple ホーム画面からWebアプリとして開く](https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios)
- [Google Chrome Androidウェブアプリ](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=ja)

## Self-Review

- Score: 96/100
- Review date: 2026-11-06
- Reasons for deductions: 実端末のインストール・OSリンク処理・既存アプリ更新は実行環境に依存し未検証となり得る（4点）。
- Revisions made: 既存ID/旧manifest URLの互換性、起動とscopeの分離、セッション復元の限界、SW非導入、maskable安全円を明記。
