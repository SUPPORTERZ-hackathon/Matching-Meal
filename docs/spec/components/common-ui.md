# メシマッチ共通UIコンポーネント仕様

- Status: Verified
- Last updated: 2026-10-28
- Related issue: None
- Related specifications: ../themes/design-system.md, ../screens/ui-preview.md
- Implementation files: frontend/src/components/common/, frontend/src/components/ui/button.tsx

## UI統合の現行契約（2026-10-31）

主仕様は[frontend-ui-integration.md](../screens/frontend-ui-integration.md)。AppHeaderへ互換のsticky?: boolean（既定true）を追加する。FixedBottomActionを追加し、実測spacer/VisualViewport補正/入力フォーカス露出を集約する。BottomActionの通常フローとButtonの契約は維持する。 後段の従来ルート/固定処理/モック供給の記録は、相違する部分のみ本契約へ更新する。検証結果は主仕様のProgressへ集約する。

## 今回の実装契約（2026-10-28）

### 目的・範囲・前提・承認

今回の実装開始指示に基づき、AppLogo・AppHeader・StepProgress・PageContainer・BottomAction・ParticipantAvatarと既存Buttonの拡張を実装する。保存済みFigma CSS/TSXを確認し、Context7のブロッカーは解消した。今回の指示で確定した表示契約を本節に定義する。視覚値は[テーマ仕様](../themes/design-system.md)を唯一の参照元とする。初回調査本文は履歴として保存する。

### 対象外

VoteCounter・VoteAction・VoteWaiting、店舗等の固有カード、API/DB・投票・同票・集計・退出・本番の画面遷移。これらの初回調査の未決定事項は今回の実装に持ち込まない。

### Props・型・出力・配置の契約

ファイル名は既存ui/button.tsxに合わせkebab-case、名前付きexport。共通部品はcomponents/commonに置く。表示部品はServer Component、既存Buttonはloading/asChildの操作抑制のためClient Componentとする。プレビューの操作見本だけ別のClient Componentとする。

| 部品 | Props（?は任意） | 責務・初期値・境界条件 |
| --- | --- | --- |
| AppLogo | compact?: boolean=false, className?: string | 表示のみ。role=img、読み上げ名「メシマッチ」。リンク/コールバックなし |
| AppHeader | roomNumber?: string, layout?: "default" / "centered"="default", leading?: ReactNode, className?: string | 自身でAppLogo compactを描画。空白のみ・未指定ルームはチップなし。defaultは左ロゴ・右チップ、centeredは中央ロゴと左leading。leadingの動作は親が指定。長いルームは折返し、固定サンプルを内蔵しない |
| StepProgress | currentStep: MealStep, className?: string | MealStep="room" / "genre" / "shop" / "result"。olに4段階を並べ、前は完了、同じ段階は現在、後は未到達。aria-current=stepと状態文字。遷移イベントなし。必須のunion型で未指定・異常入力を受け付けない |
| PageContainer | children: ReactNode, header?: ReactNode（既定AppHeader）, bottomAction?: ReactNode, className?: string | 外枠div、本文main、下部領域の順。header=nullでホームの本文ロゴ等を許容。ヘッダー/下部の二重描画をページで避ける。通常ページスクロール |
| BottomAction | children: ReactNode, note?: string, className?: string | 操作・待機表示と任意の注記を包む。通常フロー。子をButtonに変換せず、操作条件を判断しない |
| ParticipantAvatar | nickname: string, avatarText?: string, tone?: "peach" / "pink" / "blue"="peach", state?: "default" / "waiting" / "complete"="default", size?: "default" / "lg"="default", className?: string | アバター・名前・状態文字。色は親が指定。avatarTextの空白以外の先頭2コードポイント、未指定時は名前の先頭2コードポイント、名前なしは「?」と「名前未設定」。文字抽出は表示専用でIDや業務入力制限に使わない。長い名前は全体を折返し。waitingは…、completeは✓、状態を文字でも表示。ホスト/ゲストを判定しない |

### 既存Buttonの拡張と互換性

- React.ComponentProps<"button">、asChild、buttonVariants export、className・ref・イベントを維持する。cnの参照は既存パッケージを継続する。
- 既存variantのdefault/destructive/outline/secondary/ghost/link、sizeのdefault/xs/sm/lg/icon/icon-xs/icon-sm/icon-lgを残す。既存の既定サイズ・type（未指定時のHTML動作）も維持。
- primary/soft/darkとsize=mealを追加。defaultは引き続きPrimary系、outlineは白地。既存secondaryは淡色、ghostは透明のまま。Figma側のsecondaryという名前で既存secondaryを白地に変えない。
- loading?:boolean=falseを追加。ラベルはchildrenを維持し、spinnerとaria-busyを付ける。通常buttonはdisabled || loadingで操作無効、asChildではaria-disabled・tabIndex=-1・captureでクリック/Enter/Spaceを止める。Slottableでloading時も単一の子の構造・refを維持する。
- 呼び出し元はloadingを自分の処理に合わせて更新する。Button自身は送信、タイマー、成功/失敗判定を持たない。API例外や業務エラーの意味を変えない。

### 状態と状態遷移・操作・再利用

全ての状態変更は親から入力する。進捗はタブでなくol、クリック・タブキー・スワイプで遷移しない。ロゴも操作対象にしない。ButtonはEnter/Space・タッチ・focus-visibleを維持し、loadingとdisabledはキーボード・ポインタ双方で操作を抑止する。待機表示は押せる要素にしない。ヘッダーのないページはheader=nullを明示し、QR風の構成は同じAppHeaderのcenteredを使える。既存トップページへのヘッダー適用は今回対象外。

読み込み・empty・errorは外部データを取得しない表示部品では発生しない。必要な表示は親のchildrenで渡す。確認ページにはサンプルの空状態・エラー・読み込みを含める。ParticipantAvatarの空名は業務上の参加許可を意味しない。写真URL・画像取得は今回Propsに加えない。元資料同様の文字アバターを実装する。

### 利用例

```tsx
<PageContainer
  header={<AppHeader roomNumber="2481" />}
  bottomAction={
    <BottomAction note="表示確認用のサンプルです">
      <Button variant="primary" size="meal">次へ</Button>
    </BottomAction>
  }
>
  <StepProgress currentStep="genre" />
  <ParticipantAvatar nickname="ゆうき" avatarText="YU" state="complete" />
</PageContainer>
```

### 受け入れ条件・検証方法

1. 6部品とButtonの新旧variant/sizeが型検査・buildを通る。
2. /ui-previewで進捗4段階、ヘッダー3例、全ボタン色・loading/disabled、アバターの3色/3状態/長文/空名、BottomActionを確認する。
3. 進捗/ロゴにリンクやクリック処理がなく、ボタン操作とloadingの二重操作抑止を確認する。
4. テーマ仕様の各幅・文字200%で表示・スクロール・本文/下部の非重複を確認する。
5. lint/typecheck/buildをDocker Composeで実行し、既存/の接続成功と/api/healthを再確認する。

### 未決定事項

今回の表示専用UIに必要な未決定事項なし。業務仕様C5とVoteCounter等の未対象部品の異常値契約は別の実装時に決める。

### 進捗

- 完了: 直接資料照合、C1〜C4/C6の今回対象部品の契約明文化、既存Button互換方針、自己レビュー。
- 実装開始承認: 2026-10-28のユーザー指示。表示の技術的補足を上記に記録。
- 完了: 6部品、既存Button拡張、/ui-preview実装。全Propsを型検査済み。現在段階は各1件、完了数0/1/2/3、未到達3/2/1/0、進捗とロゴの操作要素0件を確認。
- 操作検証: Enter/Spaceで押下回数が加算。loading切替で無効化し、asChildリンクのクリック/Enterも遷移・子の押下処理とも抑止。タッチ操作、フォーカス枠を確認。旧サイズの高さ36/24/32/40pxとicon系36/24/32/40pxを維持。
- 表示検証: テーマの指定幅と文字200%で横スクロールなし、長文/空名、ルームなし/長文、全色/状態、カードの読込/空/エラー、BottomActionの長文注記と短いページでの配置を確認。
- 検証: Docker Composeのlint/typecheck/buildは最終ソースですべて成功。/と/api/healthも正常。プレビューのAPIリクエスト0件、ブラウザ例外0件。
- 残作業: 今回の受け入れ条件はすべて確認済み。実機safe-area/キーボード/スクリーンリーダーは未検証として別途確認する。Go/API/DB変更なしのためGo test/vetは対象外。
- ブロッカー: なし。新しい依存追加なし。
- 関連Issue・PR・コミット: None。

### Self-Review（実装開始前）

- Score: 95/100
- Review date: 2026-10-28
- Reasons for deductions: 一意性29/30、状態19/20、型15/15、配置14/15、再利用10/10、検証8/10。実機・支援技術検証を残す。
- Revisions made: Props/既定値/異常値/配置/操作抑止/利用例を確定し、今回対象外の業務仕様を分離。

## 初回調査記録（履歴）

<details>
<summary>以前の仕様案を表示（以下は現行の実装契約ではありません）</summary>

## 目的と対象範囲

複数の画面担当者が同じ共通UIを利用できるよう、コンポーネントの責務、入出力、状態、操作、再利用条件を整理する。URLを変更しない表示要素の主仕様を本書とする。

色・フォント・寸法・余白・角丸・影・ブレークポイントは[共通UIデザイン仕様](../themes/design-system.md)を唯一の参照元とし、本書には重複定義しない。画面URL・画面全体の遷移は、別途screens仕様で定義する。

## 対象外

- コンポーネントの実装、ファイル移動、依存追加、既存Buttonの置換。
- 投票の保存・取り消し条件・集計・同票・結果確定・ルームの同期方法。
- 未提供の店舗検索条件画面、業務データ型、APIの確定。
- 参加画面やQR・ホーム画面の固有機能の実装。

## 前提条件と参照資料

資料は[figma-style-audit.txt](../../design/reference/figma-style-audit.txt)（R1）と[figma-implementation-notes.md](../../design/reference/figma-implementation-notes.md)（R2）のみとする。元のindex.css・App.tsxは今回直接確認していない。

R1・R2の「実装済み」「確認済み」は参考実装に関する二次記載であり、現在のNext.js側の実装状態ではない。元コードに関する構造・動作・Propsの記載はすべて**元コードによる再確認が必要**。両資料の共通化候補を承認済みの依頼として扱わない。

ユーザー指定として、既存構成を維持し、globals.cssと既存Buttonを活用する。進捗は「ルーム作成 → ジャンル → お店 → 決定」であり、画面移動用のタブにしない。

## 期待する振る舞い・コンポーネント一覧

以下の新しい名前・責務分割は仕様案であり、Next.js側の既存コンポーネント名や実装済みAPIではない。

| コンポーネント候補 | 参考資料内の対応 | 責務・配置 | 再利用の境界 |
| --- | --- | --- | --- |
| AppHeader | R1「3」、R2「3」のShell内ヘッダー | ロゴ・ルーム情報。通常はスクロール本文の外 | 画面ごとのヘッダー複製を避ける。QR・ホームの扱いはC1 |
| AppLogo | R1・R2のLogo | 通常・コンパクトの表示 | 表示のみ。ロゴの遷移処理とは分ける案 |
| StepProgress | R1のSteps、R2「4」 | 本文上部で4段階を表示 | 段階の変更・ナビゲーション処理を持たない |
| PageContainer | Shell、content-scroll、screen | 画面枠と本文の幅・余白・スクロール | ヘッダーと下部操作を二重に配置しない。責務の最終分割はC1 |
| 既存Button | frontend/src/components/ui/button.tsx | 操作要素と用途別の表示 | 既存のprops・variant・sizeを起点とし、別Buttonを新造しない |
| BottomAction | sticky-action | 下部操作または待機表示と補足文 | 固定位置・本文の予約余白はテーマ仕様を参照 |
| ParticipantAvatar | avatar、mini-members | 表示文字・色・参加者状態 | 参加者の業務状態を自ら判定しない |
| VoteCounter | VoteHeader | 現在件数・総件数とバー | 全体のStepProgressとは別表示 |
| VoteAction | round-btn、undo-btn | 見送り・肯定・任意の戻す操作 | 業務上の投票処理を含めない。既存Buttonの再利用を検討 |
| VoteWaiting | VoteWait | 完了見出し、投票状況、参加者の表示 | 自動集計・結果遷移は担当しない |
| 共通カード外枠 | R1「5」、R2「7」のカード群 | 共通の面・枠・余白等 | ジャンル・店舗・結果の内容や画像高を一律にしない |

R1・R2では、画面タイトル、状態ラベル、参加メンバー行、営業時間、店舗情報・詳細行も共通化候補である。実際の再利用箇所と既存コンポーネントを確認してから採用する。既存shadcn/ui等で満たせるものを重複実装しない。

## 入力・出力・Props・型の要件

以下は必要な情報と責務を示す仕様案。正式なProps名、必須・任意、型定義は未確定であり、この表をそのまま公開APIとして実装しない。元コードによる再確認が必要。

| 対象 | 入力の概念と型候補 | 出力・イベント | 未決定事項 |
| --- | --- | --- | --- |
| AppHeader | ルーム表示文字列、ロゴ操作のコールバック | 操作されたことを親に通知 | 文字列なし・読込中・表示対象・戻る操作、C1 |
| AppLogo | 通常／コンパクトの区分 | ロゴ表示 | 素材と読み上げ名、テーマQ7 |
| StepProgress | 現在段階の識別値 | 段階の表示のみ。遷移イベントなし | 0始まり番号と意味付き識別値の選択、範囲外・未指定、C2 |
| PageContainer | ReactNode相当の本文 | レイアウト | 各領域の所有者、固有画面との差、C1 |
| Button | 既存button props・variant・size・children・asChild等 | 既存の操作イベント | 共通デザインとの対応、送信中の契約、テーマQ4 |
| BottomAction | 操作UIまたは非操作の状態表示、補足文字 | 子要素の表示 | loading等の切り替え条件、C4 |
| ParticipantAvatar | 表示文字列、表示区分、状態区分 | アバター表示 | 色割り当て、状態型、名前なし、C3 |
| VoteCounter | 現在件数number、総件数number | 件数・進捗表示 | 0・負数・総数超過・非整数・総数不明、C2 |
| VoteAction | 操作ラベル、操作コールバック、無効フラグ | 見送り・肯定・戻すを親へ通知 | 二重操作防止、戻す可否、C4・C5 |
| VoteWaiting | 件数と参加者表示用の型付きデータ | 待機状態の表示 | APIからの変換境界と空・エラー、C3・C4 |
| カード外枠 | ReactNode相当の内容、用途区分 | 外枠表示 | variant名と用途の対応、C6 |

実装に進む際は、各Props・表示状態・API応答の型を明示し、any・unknown・不要なclass宣言を使わない。表示データとAPI・DBのデータを同一と仮定しない。

Button以外は未実装である。Buttonのpropsは既存コードで確認した範囲を出発点とし、ライブラリAPIの互換性はContext7で確認できるまで断定しない。

### 契約の確定手順

1. テーマ仕様Q1で元コードの構造・Propsと資料との差を確認する。
2. 本書C1〜C6で、入力の名前・型・必須/任意・初期値、イベントの引数、正常/異常入力の扱い、表示状態、配置の所有者を部品ごとに決める。
3. 色・寸法はテーマ仕様へ、画面のURLと業務上の遷移条件はscreens・services仕様へ記録し、本書は参照する。
4. 各状態を同じ入力で再現できる利用例と検証手順を用意し、自己レビュー・承認を得てから実装する。

既存Buttonと新しい候補の公開APIは別々に確認する。資料のButtonにあるPropsだけを理由に、現在のButtonのPropsを削減しない。

## 状態と状態遷移

| 対象 | 参考資料に記載された状態・変化 | 未確定の状態・処理 |
| --- | --- | --- |
| StepProgress | activeより前が完了、同じ段階が現在、後が未到達とのR2記載 | 未指定・範囲外の入力、業務状態との対応 |
| Button | 通常・押下・focus。disabled propはあるが共通専用外観の記載なし | hover・disabled・loadingの最終デザインと操作契約 |
| 戻す操作 | 最初のカードで無効、不透明度変更とのR1・R2記載 | 保存済み投票の取消可否や許可条件 |
| ParticipantAvatar | 色違い、完了バッジ、待機の不透明度との資料記載 | 切断・退出・名前なし・多数時の表示 |
| VoteCounter／VoteWaiting | 件数、バー、完了・待機の表示 | 読込・空・エラー・再試行・集計中・結果確定の対応 |
| AppHeader／PageContainer／カード | 通常レイアウトの記載 | 読込・情報なし・エラー・長文での構成 |

状態の変化は親から入力され、表示部品自身は投票完了や結果確定を推測しない。投票数の増減を画面遷移の根拠にしない。参考の固定人数・票数・一致率・ルーム番号・デモボタンを、本番の状態遷移仕様にしない。

資料の「全員の投票後に自動で結果を表示」という文言と実際の動作が一致するかは、元コードによる再確認が必要。業務仕様としての採否も別途決定する。

本仕様のStatusはDraftとし、未決定事項が解消され自己レビュー90点以上かつ承認を得るまで実装へ進めない。

## キーボード・タッチ・スワイプ

- StepProgressにリンク・クリック・スワイプ移動を持たせない。タブとして扱わない。
- 操作部分は既存Buttonを起点にし、標準のキーボード操作、無効状態、フォーカス表示を維持する方針。
- 丸い投票ボタンは文字ラベルを含めた操作として設計する。装飾記号だけに操作の意味を依存させない。
- 参加待機メッセージは、R1では操作を持たない表示との記載がある。押せるボタンのような操作を追加しない。
- 参考資料のスワイプ案内は、タッチ処理の存在の確認にはならない。ジェスチャー、しきい値、アニメーション、取り消し・送信の関係は元コードによる再確認が必要。製品での条件はC5で決める。
- 状態更新の読み上げ、記号操作の読み上げ名、タップ領域、送信中の連打防止は未決定。資料にない動作を確定しない。

## 配置・レスポンシブ・再利用条件

全寸法はテーマ仕様の「画面枠、余白、レスポンシブ」「ヘッダーとロゴ」等を参照する。通常ヘッダー、スクロール本文、下部操作の所有者を一か所に決め、ページ側と共通レイアウト側で重複描画しない。

通常の画面が共有する枠と、ホーム・QR等の固有構成は区別する。全画面のヘッダー統一要件との整合がC1で決まるまで、例外やルートグループを新設しない。

スマートフォンでは内容が下部操作に隠れないこと、長い文字や参加者数の増加で操作が画面外へ消えないことを検証する。正式な対応幅や折り返し・省略・複数行の選択は未確定。

既存のfrontend/src/app、components/ui、libを維持する。新しい共通部品はcomponents/commonを候補とするが、これはファイル作成済みを意味しない。表示だけの部品はServer Componentを基本とし、操作・状態・ブラウザAPIが必要な境界だけClient Componentを検討する。

## 担当画面の共通部分と固有部分

次表はR2「担当画面との対応」の整理であり、参考実装の存在・段階対応は元コードによる再確認が必要。画面URLや製品の遷移条件は確定しない。

| 担当画面 | 参考の対応／進捗 | 共通化候補 | 画面固有・別仕様の内容 |
| --- | --- | --- | --- |
| ジャンル投票 | GenreVote／ジャンル | ヘッダー、進捗、件数、投票操作 | ジャンル写真の重なり、説明、戻す条件 |
| ジャンル投票待機 | VoteWait／ジャンル | 完了・待機、人数、アバター | 待機終了条件・結果への遷移 |
| ジャンル結果 | GenreResult／ジャンル | ヘッダー、進捗、カード、下部操作 | 円形画像、順位、装飾、次画面への条件 |
| 店舗検索条件 | 独立画面の記載なし／未確認 | レイアウト・フォームの外観は候補 | 項目、配置、段階、URL、入力・検索仕様 |
| 店舗投票 | ShopVote／お店 | ヘッダー、進捗、件数、投票操作、店舗情報 | カード内容、検索条件との接続 |
| 店舗投票待機 | VoteWait／お店 | ジャンル待機と同じ表示の仕組み | 店舗結果の確定・遷移 |
| 最終結果 | Final／決定 | ヘッダー、進捗、店舗情報、下部操作 | 決定演出、投票サマリー、地図導線 |

Create内の集合場所・検索範囲を、担当する店舗検索条件の確定仕様として流用しない。R2の未使用filter-chipの記載も、利用画面・検索機能の存在を確定する根拠にしない。

## 利用例

以下は構成の説明であり、実装済みのimport先・Propsを示すコード例ではない。

- ジャンル投票: 共通ヘッダーと本文枠に、StepProgress、画面固有の見出し・ジャンルカード、VoteCounter、VoteActionを配置する案。
- ジャンル・店舗投票待機: 共通のVoteWaitingに段階・人数・参加者表示情報を渡し、結果の購読や遷移は画面側仕様で扱う案。
- 最終結果: 共通枠に店舗情報を表示し、BottomAction内の既存Buttonで地図操作を示す案。URL生成と遷移先は別のサービス・画面仕様で決める。

## エラー処理と境界条件

- 未確認のProps、外観、型、業務状態は実装前の確認対象として残す。
- active未指定・範囲外、投票総数0・不明・超過で、計算式から不正表示が出ない契約を決める。表示の補正や非表示を勝手に選ばない。
- 名前なし・長い名前・同名・画像取得失敗・参加者なし・多数時の表示はC3・C4で決める。アバターの頭文字抽出・色割り当てを推測しない。
- デモ操作のラベル・固定データを本番UIの要件にしない。
- 読込・空・エラー・再試行の共通表示は、業務エラーの意味を変えずに扱う契約を決める。
- 見た目のために既存Buttonのdisabled・focus-visible等の機能を消さない。
- 差異を発見した場合はテーマ仕様の差分表と未決定事項に記録する。

## 受け入れ条件

| ID | 条件 | 現状 |
| --- | --- | --- |
| C-AC1 | 共通部品と画面固有部分、既存部品の再利用方針を記録している | 文書検証対象 |
| C-AC2 | Props・型・状態・操作・配置・再利用・利用例と未確定箇所を記録している | 文書検証対象 |
| C-AC3 | 進捗は指定の4段階であり、ナビゲーションを持たない | ユーザー指定として文書確認。実装未検証 |
| C-AC4 | 視覚値をテーマ仕様から参照し、矛盾する重複定義がない | 文書検証対象 |
| C-AC5 | C1〜C6と関連テーマQを解消し、Props・状態・実装配置を承認する | 未達 |
| C-AC6 | 各表示状態を検証でき、指定幅で表示・操作・読み上げを確認する | 未着手、実装後 |
| C-AC7 | 必要なlint・型検査・ビルドをDocker Compose経由で実行する | 未着手、実装後 |

## 検証方法

### 今回

1. 必須メタデータ・章・参照リンク・自己レビューの存在を確認する。
2. R1・R2の共通化候補と現在のNext.js実装を混同していないか照合する。
3. 段階名・非ナビゲーション要件、責務分離、状態の保留条件を確認する。
4. 視覚値の重複がなく、テーマ仕様のQと本書のCに追跡できることを確認する。
5. Git差分と確認対象のハッシュで実装コード・参照資料を変更していないことを確認する。

### 承認後の実装時

- 承認済みPropsで各状態を再現する利用例を用意し、loading・empty・disabled・errorを該当する部品で確認する。不要な状態を一律に実装しない。
- テーマ仕様の検証幅・safe-area・文字拡大・長文条件と、キーボード・タッチ操作を確認する。
- StepProgressのクリック・タブ移動によって画面遷移が発生しないことを確認する。
- フロントエンドのlint・typecheck・buildをDocker Compose経由で実行する。

今回は仕様書のみで、上記のアプリ検証は未実施。API・DB・Goの変更はなく、それらの検証も実施しない。

## 未決定事項

| ID | 必要な確認・判断 | 関連 |
| --- | --- | --- |
| C1 | AppHeader・PageContainer・BottomActionの所有者、例外画面、ルームなし時・ロゴ操作、正式な配置・Props | テーマQ1・Q5 |
| C2 | StepProgressの入力型・未指定・範囲外、投票進捗の0・不明・異常値の契約。元コードによる再確認が必要 | テーマQ1 |
| C3 | 参加者表示用の型、色・文字・バッジ・空・長文・多数の扱い。元コードによる再確認が必要 | テーマQ7 |
| C4 | 共通UIのloading・empty・disabled・error・retry、送信中の操作・読み上げ。元コードによる再確認が必要 | テーマQ4・Q6 |
| C5 | 戻す・スワイプ・投票完了・待機終了・遷移条件と担当画面仕様。店舗検索条件の不足資料も必要 | 別途screens・services仕様が必要 |
| C6 | Button・カード等の正式なvariant、サイズ、トークン、SVGとcnの参照方針 | テーマQ2・Q4・Q7・Q8 |

## 進捗

- 完了: R1・R2の読取、共通UIと画面固有UIの分離、入出力・状態・操作の仕様案作成、初回自己レビュー後の修正・再レビュー、文書構造・参照の検証。
- 残作業: 元コード照合、C1〜C6・関連テーマQの解消、チームレビュー。実装は今回対象外。
- ブロッカー・必要な判断: 元コード不在、未定義のProps・状態・画面仕様、Context7 MCP利用不可。実装は未着手。
- 検証: 修正後も必須メタデータ・章・相互リンク・表の列数・末尾空白の検査に合格。責務・ユーザー指定・二次資料の扱いを照合した。参照メモ更新後の再読結果・参照版はテーマ仕様の進捗に記録。実装ファイルのハッシュ一致、git diff --check成功、追跡済みファイルに差分がないことを確認した。
- 未実施の検証と影響: 実装・画面確認・lint・型検査・ビルド・Go検証は未実施で、動作保証・UI受け入れ確認は行っていない。
- 関連Issue・PR・コミット: None。本作業では作成・送信しない。

## Self-Review

- Score: 88/100
- Review date: 2026-10-28
- Reasons for deductions: 実装の一意性25/30、状態・エラー18/20、入出力13/15、外観再現12/15、再利用10/10、検証10/10。Props・状態・レスポンシブの確定に必要な元コードと意思決定が不足し、実装者間の一意性はまだ満たさない。
- Revisions made: 初回84/100から、部品ごとの公開契約を確定する手順、テーマ・画面・サービス仕様への責務分担、既存ButtonのPropsを削減しない方針、検証結果を追加して再レビューした。90点未満かつ未決定事項があるためDraftを維持し、実装には進まない。

</details>

## Self-Review

- Score: 95/100
- Review date: 2026-10-28
- Reasons for deductions: 一意性29/30、状態19/20、型15/15、配置14/15、再利用10/10、検証8/10。実機と支援技術の追加検証を残す。
- Revisions made: 6部品と既存Buttonの拡張を実装。新旧Props/サイズ・状態・キーボード/タッチ・表示と既存画面を検証し、初回調査を履歴として保存。
