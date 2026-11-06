# S09・確定済み上位3位の表示準備

- Status: Verified
- Last updated: 2026-11-07
- Related issue: None
- Related specifications: genre-result.md, genre-voting-api-integration.md, ../services/genre-voting.md, ../services/genre-vote-rankings.md, ../models/genre-votes.md
- Implementation files: frontend/src/features/genre-result/{result-data.ts,genre-result-screen.tsx,genre-result-rankings.tsx,prototype-data.ts,genre-result-preview.tsx,result-data.test.mjs}, frontend/src/features/genre-voting-api/genre-voting-data.ts

## 目的・承認・今回の完成範囲

既存の順位UIを共通表示部品として再利用し、実APIの確定済み上位3件を決定方法・票数の要約と併せて表示する。順位はサーバー保存済みの配列順を使用し、フロントエンドでは生成・並べ替え・再抽選しない。

## バックエンド連携の現行契約（2026-11-07）

主仕様は[genre-vote-rankings.md](../services/genre-vote-rankings.md)。APIは`rankings: [{genreId, votes}]`を確定順で返し、フロントエンドは既存表示型へそのまま渡す。新規結果は3件、既存結果は空配列とし、`rankingTieBreakApplied`を既存の同票説明へ接続する。後段の未承認バックエンド案は、この承認済み契約により更新する。

## 前提・調査・既存との差異

- ブランチはfeature/genre-voting-api-integration、HEAD/main/origin/mainは6d88938。既存の未コミット26ファイルをハッシュ記録して保護する。PR18はマージ済み。GitHub検索で現ブランチのPRは見つからない。切替/コミット/プッシュ/PR作成なし。
- Figma 09-genre-result.png、旧プロトタイプ、result-data.ts/結果コンポーネント、OpenAPI/R6 Handler/Service/Repository/DB定義を確認。
- R5/R6 resultはgenreId/likeCount/decisionMethod/decidedAtに加え、`rankings`と`rankingTieBreakApplied`を返す。新規結果は上位3件、既存結果は空配列となる。
- 現UIはdecisionがあると順位UIを表示しない排他的分岐。要約と順位の表示を分離して、将来確定順位が渡された場合にも両方を表示できるようにする。
- 旧テストは決定IDと先頭順位の不一致を許容していたが、今回の「1位は決定ジャンルと必ず一致」を優先する。並べ替えで補正せず、不整合データを拒否する。

## 対象外

R5保存/R6のレスポンス解釈やルーティング/ポーリングの変更、実票のフロント集計/乱数/独自シード、バックエンド/DB/API仕様書/Docker/環境変数/PWA/README/依存関係の変更、写真/ハート/発表演出/共通UIの変更。

## フロント表示の入力・責務

- 既存GenreResultData.rankingsの{genreId,votes}を再利用する。配列はAPIが確定した順位順で、0件なら順位を表示しない。新規API結果は3件に限定し、表示部品も先頭3件だけを表示する。
- 名前・画像は渡された既存genresから解決し、二重管理しない。表示部品GenreResultRankingsはServer Componentで、状態/通信/並べ替え/乱数を持たない。順位番号は入力の確定順を1〜3として表示するだけ。
- データ解決時に既知ID/重複なし/非負整数票/参加者数以下を検証し、空配列を除き先頭ID=decidedGenreId、票数が降順、decisionありなら先頭票=decision.likeCountも検証する。不整合は既存の結果エラー表示にし、別の勝者や票数を補完しない。
- `rankingTieBreakApplied`をR5/R6から表示用モデルへ渡し、真の場合だけ「同票の順位は抽選で決定しています。」と表示する。可視3件から同票を推測しない。
- decisionの要約カードと確定順位は共存する。順位未保存の既存結果は`rankings=[]`として従来どおり決定ジャンルの票数/方法だけを表示し、モックへフォールバックしない。

## 見た目・操作・状態

Figma/旧UIのカード・金色1位/グレー2〜3位の番号・赤い票数バー・余白/フォントをそのまま再利用する。順位行は非操作、順序付きリストと票数の読み上げを維持。最大430px/通常縦スクロール/既存固定領域の実測spacerを維持し、順位に新規アニメーションを追加しない。320/375/390/430/768/1024px、横向き/短画面、文字200%で折り返しと本文末尾到達を検証する。

開発プレビューは既存操作/初期モックを保持し、「異なる票数」「1位同票」「2/3位同票」「3位境界の同票」「上位3件同票」「全16件0票」「実API相当・順位なし」を追加する。抽選済み順序を模した固定の仮データであり、実投票/実抽選として扱わない。再描画/再読み込みで新たに順位を抽選しない。デモのmock注記と本番アクセス制限を維持する。

## 過去のバックエンド依頼案（現行契約で置換済み）

以下は実装前の検討記録である。現在の正式な構造・JSON名・既存結果の扱いは`../services/genre-vote-rankings.md`を優先する。

1. 最終提出の既存トランザクションで、現行どおり勝者を決定する。既存の勝者は変更せず1位に固定する。
2. 既存AggregateLikeCountsの全16件から勝者を除き、票数ごとのグループを降順にする。2/3位の順序や採用候補にかかる同票グループだけを既存の安全な乱数源で偏りなく並べ、先頭2件を2/3位にする。表示する上位3件の順序/採用に抽選が影響した場合にrankingTieBreakAppliedをtrueとする。0票を含め常に3件埋める案、全skipでは勝者以外の15件から重複なく2件を選ぶ案を確認する。
3. 結果1件と上位3順位を同じトランザクションで保存し、room状態遷移と共にコミットする。GET/同一PUT再送では抽選・更新しない。追加テーブルgenre_vote_result_rankingsなどに(room_id,rank)主キー、(room_id,genre_id)一意、rank1〜3/非負票/結果への外部キーを設ける案。実際の構造・新規migrationは担当者と合意後に決める。
4. R6のdata.result配下にrankings:[{rank,genreId,likeCount}]とrankingTieBreakAppliedを返す案。rankings[0]はresult.genreId/likeCountと一致し、rank順・3件・重複なし・降順を保証する。decisionMethodは既存の勝者決定用3値を維持する。R5/R6が同じ応答型なので両方へ同じ定義を反映する。現在のFindStateは参加者行のwindow COUNTを使うため、順位3行をそのままJOINして参加者数を3倍にしない。順位は別取得または1行に集約した副問い合わせで取得する。合意後、フロントのR6アダプターへrank/likeCount→表示用順序/votesの検証付きマッピングを追加する。
5. 既存結果で順位未保存のルームは、rankings未提供またはnullとして扱う互換案を合意する。GET時の再抽選はしない。バックフィルが必要なら既存勝者を保つ明示的な一度限りの処理を別途設計する。
6. 異票数/1位同票/2・3位同票/3位境界の多候補/上位同票/全skip、並行最終提出、同一再送、複数認証セッション、再取得で、順位・勝者・票数が不変であることをサーバー側で検証する。

レスポンス案（決定ジャンル部分の例）：

```json
{
  "genreId": "ramen",
  "likeCount": 5,
  "decisionMethod": "most_likes",
  "decidedAt": "2026-11-01T00:00:00Z",
  "rankings": [
    { "rank": 1, "genreId": "ramen", "likeCount": 5 },
    { "rank": 2, "genreId": "sushi-seafood", "likeCount": 3 },
    { "rank": 3, "genreId": "yakiniku", "likeCount": 3 }
  ],
  "rankingTieBreakApplied": true
}
```

## 受け入れ条件・検証方法

1. 純粋な入力検証テストで、上記6ケースの確定済み順序を維持し、勝者と先頭ID/票の不一致、重複、逆順、不正票を拒否する。0票の割合はNaNにしない。表示上位3件を制限し、入力を変更/再抽選しない。
2. 実API結果の上位3件と同票フラグを既存UIへ渡し、複数参加者・再取得・同一再送で順序が変わらないことを確認する。既存結果は空順位のままとする。
3. デモの上位3件/同票説明/0票/写真/ハート/演出/固定ボタンとレスポンシブを維持し、今回のデータ接続でレイアウトを変更しない。
4. Docker Composeでlint/typecheck/既存・新規テスト/buildとgit diff --check。開始時の変更ハッシュと比較し、対象外の既存差分/禁止領域を維持する。

## 未決定事項

None。バックエンドの応答配置、抽選結果保存、既存結果、0票の扱いは`../services/genre-vote-rankings.md`で承認済み。

## Progress

- 完了：Git/PR/既存26ファイルの保護記録、Figma/旧順位UI/R6/内部集計/保存形式を調査。
- 完了：旧順位UIをGenreResultRankingsへ分離、先頭と決定ID/票の一致・降順・重複なしの検証、決定要約との共存、確定済み順序を模した7ケースの開発プレビュー。名前/写真は既存GENRESから解決する。
- Docker Compose：lint、typecheck、本番build成功。フロント全テスト81件成功（失敗/skip 0）。うち結果モデル15件、既存R5/R6の実API結合3件を含む。結合テストはローカルで新規に作成した検証専用ルームのみ使用し、異票数/最多同票/全skipで2認証セッションが同じ既存勝者を取得できることを回帰確認。2/3位の実抽選テストではない。
- ブラウザー：7ケースの票数/順位/抽選注記/順位なし表示、長いジャンル名の切替、再読み込みで従来の固定モックへ復帰、写真/ハート/pop演出と図形のDOM消去を確認。プレビューの選択状態自体は従来どおり再読み込みで初期化する。
- レスポンシブ：320/375/390/430/768/1024px、横向き844×390px、短画面390×320pxで、長いジャンル名が折り返し、横スクロールなし、ヘッダー上端固定、下部操作の画面下端固定、本文末尾が固定領域に隠れないことを計測。スクリーンショットはリポジトリ外の検証成果物へ保存（genre-ranking-390-top.jpg / genre-ranking-390-card.jpg）。
- 未検証：文字サイズ200%（使用中のブラウザー操作では拡大を反映できず）、実機、OSの動き軽減設定の切替、別ブラウザーでの実ランキング一致。既存reduced-motion CSSと発表演出ファイルは変更なし。フロントの確定順不変テストは複数ブラウザーで実API順位が共有される証明ではない。
- 差分確認：git diff --check成功。開始時26ファイルのうち今回対象の4ファイル以外の22ファイルはSHA256一致。今回の変更は結果画面6ファイルと関連画面仕様3ファイルだけで、バックエンド/DB/API仕様/Docker/環境変数/PWA/README/共通UI/既存演出への変更なし。
- 既存の非阻害警告：NodeのMODULE_TYPELESS_PACKAGE_JSONがテスト時に出る。今回のためにpackage.jsonのモジュール方式は変更しない。
- 実APIの上位3位・2/3位抽選/共有：実装・検証済み。新規結果3件と既存結果0件を区別して表示する。
- 2026-11-07 検証：実API結合5ケース、フロント解析テスト、lint・typecheck・buildに成功。保存済み順位をフロントで並べ替えず表示用モデルへ渡すことを確認。
- コミット/プッシュ/PR/バックエンド変更：なし。

## Self-Review

- Score: 97/100
- Review date: 2026-11-07
- Reasons for deductions: 実機・別ブラウザーでの実ランキング表示は未検証のため3点減点。
- Revisions made: 承認済みAPI契約、勝者一致、票数降順、抽選済み順序、既存結果の空順位、実API結合結果へ更新。
