# 共通サウンドシステム

- Status: Implemented
- Last updated: 2026-11-07
- Related issue: None
- Related specifications: ../components/common-ui.md, ../screens/home-screen.md, ../screens/genre-vote.md, ../screens/genre-result.md, ../screens/restaurant-vote.md, ../screens/restaurant-result.md
- Implementation files: frontend/src/features/audio/, frontend/src/app/layout.tsx, frontend/src/components/common/app-header.tsx, frontend/src/features/home-preview/home-preview-screen.tsx, frontend/src/features/genre-vote/, frontend/src/features/genre-result/, frontend/src/features/restaurant-vote/, frontend/src/features/restaurant-result/

## 目的と範囲

全画面でBGM・SEの設定、再生許可、停止、失敗を共有し、音声が失敗しても投票・遷移を妨げない。ホームBGM、ジャンル投票・取り消し・結果SE、店舗投票専用SE、店舗決定SEを対象とする。店舗決定後は無音とし、結果BGMは利用しない。スマートフォンの共通ヘッダーに設定メニューを置く。

## 対象外

API・DB・投票集計、音源の加工・再生成、ブラウザーキャッシュ全体の無効化、ブラウザーの自動再生制限を回避する実装、結果画面の視覚アニメーション追加。

## 前提と入力

- `/audio/genre-vote.mp3`、`genre-undo.mp3`、`genre-result.mp3`、`home-bgm.mp3`、`restaurant-vote.mp3`を使用する。店舗決定SEは元ファイル`restaurant-decide.mp3`と同一バイトの`restaurant-decide.m4a`を配信する。`restaurant-vote.mp3`は2026-11-07の追加確認時に配置済みで、MP3フレームヘッダーを確認した。音源は加工しない。
- `restaurant-decide.mp3`の実体はMP4コンテナー/AAC音声である。元ファイルを保持し、同じバイト列を`restaurant-decide.m4a`として配信する。`audio/mp4`の配信ヘッダーを実測した。元ファイルの拡張子との不一致はレビューで共有する。
- 既存のユーザー入力・ルーム・投票データを音声管理へ渡さない。音声は画面の操作・決定データIDにより開始する。
- 初期値はBGM OFF・SE ON。初期値はSSRと初回クライアント描画で同じにし、保存済み設定はマウント後に復元する。localStorageが使えない場合はメモリー内で動作する。
- 音源の音量係数はBGM 0.20、ジャンル投票/取り消しSE 0.45、店舗投票SE 0.45、ジャンル結果SE 0.5、店舗決定SE 0.6を初期案とし、実機試聴まで確定品質とみなさない。

## 状態と遷移

- 設定: BGMとSEを独立して切り替え、localStorageへ保存・各画面に同期する。BGMのON操作はユーザー操作中にホームBGMを開始できる。SEのOFF操作は再生中のSEを止める。
- 再生許可: アプリ内のクリック操作中に共有`AudioContext`を一度作成・再開し、ジャンル結果/店舗決定SEを事前取得・デコードする。結果画面では`running`を確認し、`interrupted`/`suspended`なら標準の`resume()`を一度試してから再生する。結果表示のタイミングではAudioContextを優先し、利用不能なら既存の`HTMLAudioElement.play()`を試す。失敗した結果を再生成功として記録しない。Contextが後から`running`へ戻った場合や次の自然な操作で、同じ結果を上限内で再試行できる。`NotAllowedError`や音源失敗で業務操作を止めず、結果画面に再生専用ボタンを出さず、無限再試行しない。直接アクセスや端末ポリシーでは自動再生を保証しない。
- SE: 投票・取り消し操作1回につき再生試行1回。ジャンル投票には従来音源、店舗投票には専用音源を使う。HTML音声要素の生成時だけでなく、各再生直前にも音源設定の音量係数を適用する。失敗した要素は再利用せず、次のユーザー操作で上限内の再試行を行う。欠損した店舗投票音源は同じ画面滞在中に繰り返し要求しない。結果SEのデコード済みデータは共有Contextで再利用し、再生ノードは1回ごとに生成・解放する。画面遷移・非表示・SE OFFで結果SEを止める。
- ホーム: 以前の位置・配色・最小高さの「音ありで楽しむ」を復活する。BGMがOFF、再生拒否、音源失敗のとき表示し、タップで設定をONにして再生、または失敗から再試行する。再生中・開始処理中に二重再生しない。ホーム表示中だけBGMをループ再生する。画面離脱時は短くフェードアウトし、タブ非表示では一時停止する。戻った際は設定と許可状態に従う。
- 店舗結果: 有効な決定店舗を初めて表示したときだけ決定SEを試み、終了後は無音にする。SEがOFFなら再生しない。別画面への移動ではSEを止め、同じ結果の再レンダリング・Strict Mode再実行で重複しない。`restaurant-result-bgm.mp3`は参照しない。
- ホームBGMのフェードは画面・設定の変更により取り消せる。音声のイベントリスナー・Audio要素・Web Audio再生ノードは画面離脱とアンマウント時に解放する。AudioContextは共通Providerで1個だけ保持する。

## 共通ヘッダーと操作

- ロゴ、戻る操作、sticky、Safe Areaを維持する。ルーム番号は左側へ置き、右端に44px以上のメニューボタンを置く。幅が狭い場合はルーム番号を次の行へ折り返してロゴと重ねない。
- `aria-label`・`aria-expanded`・`aria-controls`、Escape、外側クリック、閉じたときのフォーカス復帰、キーボード・タッチ操作に対応する。
- メニューにはBGM・SEの独立したON/OFFボタンを置く。ホームの「音ありで楽しむ」を復活し、結果画面には手動SE/BGM再生ボタンを設けない。BGMのON切り替え操作もホームBGM開始に利用できる。

## エラーと端末条件

- 自動再生は保証しない。`NotAllowedError`を取得・デコード失敗と分け、許可操作を案内する。HTTP/デコード失敗で音声要素を無制限に再生成しない。音声がなくてもUIとAPI操作を続ける。
- 通信不能、ページ非表示、設定OFF、`interrupted`/`suspended`/`running`のContext、音源取得・デコード失敗、短い画面、320〜768px、文字拡大、PWA、reduced-motionを検証する。reduced-motionでは視覚的なメニュー演出と音量フェードを省略できる。
- iPhone Safariで投票SEの2回目以降にHTML音声要素の`volume`が1と読まれた。再生直前の再設定はアプリ側で可能な最小修正だが、[AppleのiOS向けSafari資料](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html)はHTML音声要素の音量をJavaScriptから制御できないと説明する。実際の音量が0.45相当かは実機で再試聴し、制御が必要なら別途Web AudioのGainNodeを検討する。現在聞こえているSEを失うような再生経路変更は今回行わない。

## 受け入れ条件・検証方法

1. 既存音源を再生成せず使用し、ホームBGMボタンとヘッダー設定のどちらからも設定ONと再生を同期できる。失敗後のボタン再試行と二重再生防止を確認する。
2. ジャンル/店舗投票の各確定操作でそれぞれ異なるSEを1回試み、毎回設定音量を再適用し、失敗しても投票・保存・遷移を継続する。結果SEは通常操作中のWeb Audio準備により自動再生を試み、失敗を成功と誤記録せず、Context再開後の有界再試行ができる。
3. BGM・SE設定が独立し、再読み込み後も維持され、全画面のメニューに反映される。両方OFFなら無音。
4. ホームBGMはホーム中だけループし、画面離脱で停止する。店舗決定SE後にはBGMを開始せず、重複・画面離脱後の再生がない。結果画面の再生専用ボタンと結果BGMの参照が残らない。
5. ヘッダーのロゴ・ルーム番号・戻る・メニューが320/375/390/430/768pxで重ならず、stickyとSafe Area、Escapeとフォーカス復帰を保つ。
6. Docker Composeでlint/typecheck/テスト/build、`git diff --check`、可能なブラウザーで再生と失敗状態を検証する。iPhone再確認とAndroid/PWAの実機未検証は明記する。

## 未決定事項

なし。初期設定・数値は上記を採用し、実機試聴に基づく音量調整を将来の検証課題とする。ブラウザーの自動再生方針とiOSの`interrupted`状態は[MDNのWeb Audio指針](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)と[状態の説明](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)、[WebKit](https://webkit.org/blog/6784/new-video-policies-for-ios/)の一次資料に従う。

## Progress

- 完了: 2026-11-07にGit差分、現行コード、音源を再確認。iPhone実機で結果SEが鳴らず、ホームBGMも開始しなかったことを再現報告として記録。コード上、結果SEを試行前に再生済み扱いし、Contextが停止時に再開を待たずHTMLAudioへ進む経路を確認。店舗投票音源の配置とMP3ヘッダーを確認。今回の詳細指示を承認根拠として仕様を改訂。
- 前回の変更: ホームBGMボタンを元の位置とスタイルで復活した。結果SEは再生成功前に再生済みとして記録しない。共有Contextの`statechange`と次の自然なクリックで有界再試行し、非`running`時は`resume()`を試みる。
- 今回の実機報告: iPhone Safariでジャンル投票・結果、店舗投票・決定の4種のSEが実際に聞こえ、`interrupted`後の`resume()`と結果SEのBuffer再生が成功した。一方、投票SEのHTML音声要素は初回`volume=0.45`、2回目以降`volume=1`と観測された。
- 今回の検証: ローカルESLint成功、音声・ジャンル投票/結果・店舗投票/結果の関連Nodeテスト57件成功、`git diff --check`成功。フロント全Nodeテストは144件中137件成功・6件スキップ・1件失敗。失敗はローカル環境に`qrcode.react`がないQRテストの読み込みエラー。ローカルtypecheckは未配置の既存依存`@zxing/library`と`qrcode.react`の解決に失敗。ローカルNext.js本番buildはGoogle FontsのDNS失敗と`.next-build`への`EPERM`で完了できなかった。Docker Composeは通常権限で`Access is denied`となり未実施。ローカル`localhost:3000`は起動しておらず新規のHTTP検証は未実施。店舗投票音源は現在配置済みで、以前の404記録は旧状態を示す。
- 今回の実装: HTML音声要素を使うSEの各再生直前に設定音量を再適用した。開発用の一時的な画面・記録処理・専用ファイルは撤去し、共有AudioContext・復帰・重複防止は保持した。
- 残り: 音量再適用後のiPhoneでの聴感・属性値、Android/PWAでの実機確認。各SEの実再生は変更前のiPhoneで確認済みだが、診断撤去と音量再適用後は未確認。
- ブロッカー: この環境からiPhone実機を操作できず、Docker接続とローカル本番buildにも上記の制約がある。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 95/100
- Review date: 2026-11-07
- Reasons for deductions: iPhoneのHTML音声要素の実音量はブラウザー制約があり、再設定後の聴感は端末で再確認が必要。
- Revisions made: 投票SEの音量再適用、実機確認済みの結果SE復帰と未確認の音量を区別した。
