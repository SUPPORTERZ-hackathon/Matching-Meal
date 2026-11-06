# 店舗住所保存・Google Maps検索位置修正

- Status: Verified
- Last updated: 2026-11-06
- Related issue: None
- Related specifications: ../models/restaurant-candidates.md, restaurant-search.md, ../screens/restaurant-result.md, ../screens/restaurant-voting-api-integration.md
- Implementation files: ../../backend/internal/domain/restaurant_candidate.go, ../../backend/internal/hotpepper/client.go, ../../backend/internal/repository/postgres/restaurant_search.go, ../../backend/internal/transport/http/restaurant_search.go, ../../backend/internal/transport/http/restaurant_voting.go, ../../backend/migrations/000008_add_restaurant_candidate_address.up.sql, ../../backend/migrations/000008_add_restaurant_candidate_address.down.sql, ../../docs/api/openapi.yaml, ../../frontend/src/features/restaurant-voting-api/restaurant-voting-data.ts, ../../frontend/src/features/restaurant-result/maps-url.ts, ../../frontend/src/features/restaurant-result/result-map-action.tsx

## 目的と対象範囲

Hot Pepper Gourmet APIが返す店舗住所を候補店舗と一緒に保存・返却し、店舗投票結果画面からGoogle Mapsを開いたときに、座標上の一点ではなく対象店舗を検索できるようにする。

対象は、Hot Pepperレスポンスからの住所変換、候補店舗への永続化、候補APIへの追加、フロントエンドでの受信、およびGoogle Maps URLの検索条件変更とする。本仕様を住所保存とMaps検索条件の主仕様とし、既存仕様と異なる部分は本仕様を優先する。

## 対象外

- Google Maps API、Places API、Geocoding APIの呼び出しとAPIキーの追加
- Hot Pepper以外の情報源による住所補完
- 保存済み候補へのバックフィル、再検索、再抽選
- ユーザーによる住所の入力・編集
- Google Maps上の検索結果をアプリ側で検証または固定する処理
- 店舗候補、店舗投票、結果決定のルール変更

## 前提条件

- Hot Pepper Gourmet APIの検索リクエストは`datum=world`を明示し、世界測地系の座標を取得する。
- 店舗候補は一度保存した後に外部APIから再取得しない。
- 店舗名は候補の必須項目であり、住所と座標は任意項目である。
- Google Maps URLsはAPIキー不要の`https://www.google.com/maps/search/?api=1&query=...`を使用する。

## 期待動作と処理順序

### 新規に検索する候補

1. Hot Pepperレスポンスの`shop.address`を読み取る。
2. 文字列の前後の空白を除去する。空文字または空白だけなら`null`とし、候補自体は除外しない。
3. 正規化した住所を他の候補項目と同じトランザクションで保存する。
4. 店舗候補検索・取得APIおよび決定結果に含まれる候補表現で、住所を`address: string | null`として返す。
5. フロントエンドは`address`が非空文字列のときだけ表示・Maps検索に使用する。

### Google Maps URL

優先順位を次のとおり固定する。

1. 店舗名と住所が有効な場合、`query`を「`店舗名` + 半角空白 + `住所`」として店舗検索URLを生成する。
2. 住所がない場合、有効な緯度・経度が両方あれば、従来どおり`query=latitude,longitude`を使う。
3. 住所も有効な座標もない場合、URLを生成せず、Mapsボタンを無効にする。

URLは`URL`と`URLSearchParams`相当の標準機能で生成し、店舗名・住所を手動連結して未エンコードのクエリ文字列にしない。Mapsは別タブで開き、`target="_blank"`と`rel="noopener noreferrer"`を維持する。

## 状態と状態遷移

```text
新規候補（addressあり） ─> 店舗名＋住所でMaps検索
新規候補（addressなし、座標あり） ─> 座標でMaps検索
既存候補（address=NULL、座標あり） ─> 座標でMaps検索
住所なし・座標なし ─> Mapsボタン無効
```

住所の追加ではルーム状態、候補の保存順、version、投票状態を変更しない。

## データ要件

### Go・TypeScript・PostgreSQL

| 層 | フィールド | 型 | 必須性・制約 |
| --- | --- | --- | --- |
| Hot Pepperレスポンス | `address` | `string` | 欠損・空文字を許容 |
| Goドメイン | `Address` | `*string` | 任意。前後空白除去後の非空文字列 |
| PostgreSQL | `address` | `TEXT NULL` | 既存行と欠損値は`NULL` |
| API JSON | `address` | `string \| null` | lower camel case、常にキーを返す |
| TypeScript | `address` | `string`（候補型では任意） | APIの`null`はプロパティなしへ変換 |

- `restaurant_candidates`へ新規マイグレーション`000008`で`address TEXT`を追加する。共有済みの`000005`は変更しない。
- downマイグレーションは`address`列だけを削除する。
- 既存行は`NULL`のままとし、Hot Pepper APIを再呼び出さない。
- 住所に一意制約、インデックス、長さ制限を追加しない。
- APIへのフィールド追加は後方互換な追加変更とし、既存フィールドを変更しない。

## エラー処理と境界条件

- `address`の欠損、`null`、非文字列、空白だけの値は住所なしとして扱い、候補全体を破棄しない。
- フロントエンドAPI解析では、`address`が文字列または`null`以外なら不正レスポンスとして候補を採用しない。
- 店舗名または住所の前後空白はMaps検索語へ含めない。
- 住所があれば座標の有無・妥当性に関係なく店舗名＋住所を優先する。
- 住所がなく座標を使う場合、緯度は有限値かつ-90〜90、経度は有限値かつ-180〜180でなければならない。0は有効とする。
- Google Mapsが同名店舗や移転後の店舗を別結果として返す可能性はアプリ側で補正しない。
- 住所や完全なMaps URLをバックエンドのエラーログへ新たに出力しない。

## 受け入れ条件

1. Hot Pepperの住所が前後空白を除去して候補と同じトランザクションで保存される。
2. 住所が欠損または空白だけでも、有効な店舗候補は保存される。
3. 候補検索・取得APIが`address`を文字列または`null`で返し、フロントエンドが安全に解析できる。
4. 店舗名と住所がある結果は、両方を検索語にしたGoogle Maps URLを開く。
5. 住所がない既存候補は有効な座標へフォールバックし、従来のMaps導線を維持する。
6. 住所も有効な座標もない場合はMapsボタンが無効になる。
7. 既存候補を再検索・更新せず、ルーム状態、候補順、version、投票結果を変更しない。
8. マイグレーションのup、down、再upが成功し、up適用直後の既存行が`address IS NULL`になる。
9. APIキーや新しい外部API・依存関係を追加しない。

## 検証方法

- Hot Pepperクライアントのテストで、住所あり、前後空白、空文字、欠損を確認する。
- Repository統合テストで、住所あり・`NULL`の保存と取得、既存相当行の`NULL`を確認する。
- HandlerテストとOpenAPI検証で、`address`の文字列・`null`を確認する。
- フロントエンドのAPI解析テストで、住所あり、`null`、不正型を確認する。
- Maps URL単体テストで、店舗名＋住所の優先、エンコード、座標フォールバック、全欠損を確認する。
- 結果画面で住所表示、別タブ属性、無効状態を確認する。
- Docker Compose内でfrontendのlint、typecheck、関連テスト、build、およびbackendの`go test ./...`、`go vet ./...`を実行する。
- DB変更はマイグレーションのup、down、再upを確認する。downは列を削除するため、実行前に対象DBが検証環境であることを確認する。

## 未決定事項

None。住所はHot Pepperから取得し、店舗名＋住所を優先、既存候補は座標へフォールバック、バックフィルなしとする。

## 進捗

- 完了: 現行のHot Pepperレスポンス変換、候補DBスキーマ、候補API、フロントエンド解析、Maps URL生成を確認。
- 完了: 現行仕様の「座標だけをMaps検索へ使う」契約と、バックエンド/APIに住所がない差分を確認。
- 完了: Hot Pepper公式APIリファレンスで`address`レスポンス項目と`datum=world`を確認。
- 完了: 住所保存、API追加、店舗名＋住所優先、座標フォールバック、既存行`NULL`の仕様を作成。
- 完了: ユーザーが仕様を承認。
- 完了: Hot Pepper住所の正規化、ドメイン変換、候補DB保存・取得、候補・決定結果API返却、OpenAPI契約を実装。
- 完了: フロントエンドの住所解析と、店舗名＋住所優先・座標フォールバックのMaps URL生成を実装。
- 検証: Hot Pepperクライアント、Handler、Maps URL、フロントエンドAPI解析の関連テストに成功。
- 検証: Docker開発DBで`000008`のup、down、再upに成功。適用直後、既存候補11件の`address`がすべて`NULL`であることを確認。
- 検証: 実PostgreSQL統合テストで住所の保存・取得に成功。
- 検証: Docker Compose内でfrontend lint、typecheck、関連テスト、build、backend `go test ./...`、`go vet ./...`に成功。
- 注記: 初回typecheckはコンテナ内にlockfile定義済みの`@zxing/library`が未配置で失敗。`npm ci`で依存を同期後、typecheckとbuildに成功。`npm ci`は8件のmoderate脆弱性を報告したが、本変更では依存定義を変更していない。
- 残作業: None。
- ブロッカー: None。
- 関連Issue・PR・コミット: None。

## Self-Review

- Score: 97/100
- Review date: 2026-11-06
- Reasons for deductions: Google Mapsの検索結果自体は外部サービスのため、対象店舗への一致をアプリの自動テストだけでは完全保証できない（3点）。
- Revisions made: 住所欠損時の座標フォールバック、既存行の扱い、APIの不正型、マイグレーション戦略、Maps検索条件の優先順位を明文化。
