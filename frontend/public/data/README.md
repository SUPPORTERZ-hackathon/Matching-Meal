# 全国駅データ

`stations-2025.json`は、国土交通省「国土数値情報（鉄道データ）」2025年度版を加工して作成しています。

- 出典: [国土数値情報（鉄道データ）](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html)
- データ基準日: 2025年12月31日
- 取得日: 2026年11月6日
- ライセンス: CC BY 4.0
- 対象: 全国の旅客鉄道・軌道の駅
- 加工: 同じ駅コードの線分を統合し、全線分の長さに沿った中間点を緯度・経度として算出。検索に不要な属性と形状を削除

公開データには基準日以降に開業・廃止・改称された駅が反映されていない可能性があります。位置情報にも原典由来の誤差があります。

## 更新方法

公式ZIPのUTF-8版`N02-XX_Station.geojson`を`frontend/.station-source/`へ展開し、データ年度等の定数を`frontend/scripts/generate-stations.mjs`で更新してから、Docker Compose内で実行します。

```bash
docker compose exec frontend npm run data:stations -- .station-source/N02-XX_Station.geojson
```

生成後は、件数、IDの一意性、必須文字列、座標範囲をテストで検証してください。原典と生成済みJSONを手作業で編集しないでください。
