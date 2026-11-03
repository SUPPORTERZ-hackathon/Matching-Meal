# 店舗結果プロトタイプ

- 明示デモの入口：`/restaurant-vote-waiting?genre=italian&demo=1`。「デモ：結果画面へ進む」を押すと、共有候補の先頭店舗を表示します（実集計ではありません）。
- デモ結果：`/restaurant-result?genre=italian&restaurant=mock-restaurant-akari&demo=1`
- 条件切替：`/ui-preview/restaurant-result`（development限定）
- 待機からの明示操作：`/ui-preview/restaurant-vote-waiting?genre=italian`

genreは既存16ジャンルの固定ID、restaurantは共有の架空店舗候補IDです。demo=1は単一の文字列1だけ有効。ジャンル/店舗を省略・誤指定した場合は補完せず、結果を表示しません。通常modeには正式な結果取得がまだないため、IDだけを渡してもモックを供給しません。店舗投票もgenre省略時にラーメンへ補完しません。

画面10にはマッチ率を表示せず、写真上のサンプルバッジも撤去しました。画面12だけにBEST MATCHバッジを表示します。計算は`result-data.ts`の`calculateMatchRate`で`Math.round(likes / total * 100)`。likesは対象店舗への「ここがいい」、totalはその店舗への「ここがいい」＋「見送り」で、未投票者は含みません。total=0や未取得は「集計待ち」、0/3は0%です。開発プレビューで0人/0%/33%/67%/75%/100%を確認できます。

この画面は静的です。料理画像の登場・紙吹雪・拡縮・フェード等の演出はありません。地図は既存店舗型の有効なcoordinatesを受け取る時だけMaps URLsへ接続します。架空店舗には実際の位置がないので、通常モックでは無効です。

API/保存/同期/集計/全員完了判定は未実装。開発プレビューの内訳は実際の投票結果ではありません。通常の待機画面から自動で架空結果へは進みません。店舗データは`../restaurant-vote/prototype-data.ts`を再利用し、複製しません。

主仕様・検証記録：`docs/spec/screens/restaurant-result.md`。テスト：`docker compose exec frontend npm run test:restaurant-result`。
