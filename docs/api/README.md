# Matching Meal API仕様書

現在バックエンドに実装済みのHTTP APIを、OpenAPI 3.1形式で管理する。

## ファイル

- `openapi.yaml`: HTTPメソッド、パス、認証、入出力、ステータスコード、エラーコードの契約
- 業務ルールと状態遷移の詳細: `../spec/`配下の各仕様

HTTP契約は`openapi.yaml`、業務ルールは`../spec/`を正とする。両者が矛盾する場合は実装を変更せず、差異を解消してから作業する。

## 対象範囲

2026-10-30時点で実装済みの以下だけを記載する。

- ヘルスチェック
- ルーム作成・参加・状態取得
- ジャンル投票開始
- ジャンル投票提出・状態取得

店舗検索、店舗投票、店舗決定など、未実装のAPIは記載しない。

## 閲覧

`openapi.yaml`をOpenAPI対応エディターまたはSwagger UIへ読み込む。APIキーやセッショントークンの実値を仕様書へ保存しない。

## 更新ルール

1. API実装の仕様を`../spec/`で承認する。
2. 実装と同じ変更単位で`openapi.yaml`を更新する。
3. パス、HTTPメソッド、認証、Schema、全レスポンスを実装と照合する。
4. OpenAPI Validatorで検証する。
5. 未実装APIを将来予定として先行追加しない。

## 検証

リポジトリルートで次を実行する。

```bash
docker run --rm \
  -v "$PWD/docs/api:/spec:ro" \
  openapitools/openapi-generator-cli:v7.10.0 \
  validate -i /spec/openapi.yaml
```

OpenAPI 3.1の記述は[OpenAPI Initiative公式仕様](https://spec.openapis.org/oas/v3.1.0.html)に従う。
