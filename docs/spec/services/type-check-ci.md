# 型検査CI仕様

- ステータス: Verified
- 最終更新日: 2026-10-26
- 関連Issue: なし
- 関連仕様: なし
- 実装ファイル: `.github/workflows/type-check.yml`

## 目的と対象範囲

GitHubへ送信されたコードに対し、フロントエンドのTypeScript型検査とバックエンドのGoコンパイル・静的検査を自動実行する。型やコンパイルに問題がある変更をPull Request上で確認できる状態にする。

対象は次の検査とする。

- フロントエンド: `npm run typecheck`
- バックエンド: `go test ./...`
- バックエンド: `go vet ./...`

## 対象外

- 本番・ステージング環境へのデプロイ
- Dockerイメージのビルドと公開
- ESLint
- Next.jsの本番ビルド
- PostgreSQLを利用する結合テスト
- ブランチ保護ルールの設定

## 前提条件

- GitHub Actionsを利用できること。
- `frontend/package-lock.json`がGit管理されていること。
- `frontend/package.json`に`typecheck`スクリプトが存在すること。
- `backend/go.mod`と`backend/go.sum`がGit管理されていること。
- CIはGitHub提供の`ubuntu-latest`ランナー上で実行すること。

## 起動条件

ワークフロー名は`Type Check`とする。次のイベントで起動する。

1. 任意のブランチへのpush
2. Pull Requestの作成、再オープン、更新
3. GitHub Actions画面からの手動実行

同じリポジトリ、ワークフロー、参照先に対する古い実行が進行中の場合、その実行をキャンセルして最新の実行を継続する。

## 権限

ワークフローへ付与するGitHub権限は`contents: read`のみとする。書き込み権限、シークレット、外部サービスの認証情報は使用しない。

## ジョブ構成

### frontend-type-check

1. `ubuntu-latest`で実行する。
2. リポジトリをcheckoutする。
3. Node.js 24をセットアップする。
4. `frontend/package-lock.json`をキーとしてnpmキャッシュを利用する。
5. 作業ディレクトリを`frontend`にする。
6. `npm ci`でロックファイルどおりに依存関係をインストールする。
7. `npm run typecheck`を実行する。

### backend-type-check

1. `ubuntu-latest`で実行する。
2. リポジトリをcheckoutする。
3. `backend/go.mod`に記載されたGoバージョンをセットアップする。
4. `backend/go.sum`をキーとしてGoモジュールとビルドキャッシュを利用する。
5. 作業ディレクトリを`backend`にする。
6. `go test ./...`を実行し、全パッケージをコンパイルする。
7. `go vet ./...`を実行する。

2つのジョブに依存関係は設けず、並行実行する。

## 状態と結果

- 両方のジョブが成功した場合、ワークフロー全体を成功とする。
- いずれかのコマンドが終了コード0以外を返した場合、そのジョブとワークフロー全体を失敗とする。
- 一方のジョブが失敗しても、もう一方の独立ジョブは実行する。
- 新しい同一条件の実行によってキャンセルされた場合、古い実行を失敗とはみなさない。

## エラー処理と境界条件

- `npm ci`がロックファイル不整合やパッケージ取得失敗で終了した場合、フロントエンドジョブを失敗とする。
- Goのバージョン取得、モジュール取得、コンパイル、`go vet`のいずれかが失敗した場合、バックエンドジョブを失敗とする。
- PostgreSQLや環境変数を必要としない検査だけを実行する。
- 同じコミットで再実行しても、キャッシュの有無によって検査結果が変化してはならない。

## 受け入れ条件

1. `.github/workflows/type-check.yml`が存在する。
2. push、Pull Request、手動実行の3種類のトリガーが定義されている。
3. GitHub権限が`contents: read`に限定されている。
4. フロントエンドとバックエンドが独立ジョブとして定義されている。
5. フロントエンドで`npm ci`と`npm run typecheck`が実行される。
6. バックエンドで`go test ./...`と`go vet ./...`が実行される。
7. Node.js 24と`backend/go.mod`のGoバージョンを利用する。
8. npmとGoの依存関係キャッシュが設定されている。
9. ローカル環境で同等の4コマンドが成功する。
10. GitHubへpush後、`Type Check`ワークフローの結果を確認できる。

## 検証方法

```bash
docker compose exec frontend npm ci
docker compose exec frontend npm run typecheck
docker compose exec backend go test ./...
docker compose exec backend go vet ./...
```

加えて、ワークフローのYAML構文と設定内容を確認し、push後にGitHub Actionsの実行結果を確認する。

## 未決定事項

なし。

## 進捗

- 完了: 仕様作成、ワークフロー実装、YAML構文確認、ローカル検証、GitHub Actions実行確認。
- 残作業: なし。
- ブロッカー: なし。
- 検証結果: ローカルとGitHub Actionsの両方で`npm ci`、`npm run typecheck`、`go test ./...`、`go vet ./...`が成功。GitHub Actions実行: `https://github.com/SUPPORTERZ-hackathon/Matching-Meal/actions/runs/40216736966`。
- 関連Pull Request・コミット: `e260474`。

## 自己レビュー

- スコア: 97/100
- レビュー日: 2026-10-26
- 減点理由: GitHubのブランチ保護設定はリポジトリ管理権限とチーム方針が必要なため対象外とした。
- 修正内容: ジョブの独立性、使用バージョン、権限、キャッシュ、失敗条件を明文化した。


git branch
git pull
git merge
pr