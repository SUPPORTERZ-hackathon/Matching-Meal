# Matching Meal

みんなで飲食店を選ぶアプリです。現在は **画面 → Go API → PostgreSQL の接続を確認できる開発環境** を用意しています。店舗検索・ルーム・投票・PWAは今後実装します。

## 1. 最初に知っておくこと

- **Git**：コードの変更履歴を保存し、チームで共有する道具です。
- **GitHub**：Gitで管理したコードを共有・レビューする場所です。
- **Docker**：アプリを動かすための環境を、PCごとの差を抑えて用意する道具です。
- **コンテナ**：Dockerで起動するアプリの実行環境です。
- **Docker Compose**：画面・API・DBなど複数のコンテナをまとめて起動します。
- **イメージ**：コンテナの元になる環境です。Dockerfileから作成することを「ビルド」と呼びます。
- **ボリューム**：コンテナを削除してもDBデータなどを残す保存場所です。

Node.js・Go・PostgreSQLをPCに個別インストールする必要はありません。

```text
ブラウザ（http://localhost:3000）
  → frontend：Next.js + TypeScript + Tailwind CSS + shadcn/ui
      → /api/* を backend：Go + Gin に転送
          → db：PostgreSQL
```

PCに公開するポートは通常3000番だけです。APIの8080番とDBの5432番はDocker内部で使います。8000番は使いません。

## 2. 初回だけ：必要なものを用意する

1. [Git](https://git-scm.com/downloads) をインストールします。
2. [Docker Desktop](https://docs.docker.com/desktop/) をインストールして起動します。Windowsでは案内に沿ってWSL 2も設定します。
3. [Visual Studio Code](https://code.visualstudio.com/) などのエディタを用意します。
4. GitHubアカウントを作り、チームからリポジトリへのアクセス権を受け取ります。

以降のコマンドは、macOSでは「ターミナル」、Windowsでは「Git Bash」で実行してください。VS Codeのターミナルを使う場合もWindowsではGit Bashを選びます。`$`などのプロンプト記号は入力不要です。

```bash
git --version
docker --version
docker compose version
docker info
```

最初の3つでバージョンが表示され、`docker info` のServer部分に接続エラーが出なければ準備完了です。Docker Desktopは起動したままにします。

Gitの名前とメールアドレスを登録していない場合は、次の例をご自身の情報に置き換えて実行します。コミット履歴に載る情報です。メールアドレスにはGitHubの設定に表示される非公開用アドレスも使えます。

```bash
git config --global user.name "あなたの名前"
git config --global user.email "あなたのメールアドレス"
```

## 3. 初回だけ：コードを取得して起動する

### 3-1. コードを取得する

プロジェクトを保存したいフォルダで実行します。

```bash
git clone https://github.com/SUPPORTERZ-hackathon/Matching-Meal.git Matching-Meal
cd Matching-Meal
```

`clone`はコードのコピーをPCに取得する操作です。認証を求められた場合はGitHubの認証画面の案内に従ってください。アカウントのパスワードをターミナルに直接入れる方式は使いません。アクセスできない場合はチームに権限を確認してください。

すでに取得済みの場合、再度cloneせず既存の`Matching-Meal`フォルダを開きます。

**以下は、特に指定がない限り `compose.yaml` と `README.md` がある `Matching-Meal` フォルダ内で実行します。** `pwd` で現在位置、`ls` でファイルを確認できます。

### 3-2. 設定ファイルを作る

```bash
cp .env.example .env
```

初回だけ実行します。すでに`.env`がある場合は上書きしないでください。初期設定のままで接続確認ができます。ホットペッパーのAPIキーはまだ必要ありません。

### 3-3. 起動する

```bash
docker compose up --build
```

画面・API・DBをまとめて準備して起動します。初回はイメージと依存ライブラリの取得、Goのコンパイルで数分かかります。ログが流れ続けるのは正常です。このターミナルは起動用として開いたままにします。

起動時にDBの準備を待ち、マイグレーション（テーブルの作成・変更）を適用してからAPIを起動します。`migrate exited with code 0` は正常終了です。

ブラウザで **http://localhost:3000** を開きます。「接続成功：画面 → Go API → PostgreSQL が動作しています。」と表示されれば完了です。

別のターミナルで状態を確認することもできます。

```bash
docker compose ps -a
```

`frontend`が起動中、`backend`と`db`が`healthy`、`migrate`が`Exited (0)`なら正常です。APIだけを確認する場合は http://localhost:3000/api/health を開きます。

## 4. 毎日の開発の流れ

### 4-1. Docker Desktopを起動し、作業状態を確認する

```bash
git status
```

未コミットの変更がある場合は、先に変更を保存してコミットするかチームに相談します。変更があるままブランチを切り替えたり、無理に更新したりしないでください。

### 4-2. 新しい作業を始める場合

以下は変更がなく、`main`から新しい作業を始める場合の手順です。`feat/restaurant-card`は例なので、自分の作業名に変えます。

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/restaurant-card
```

ブランチは作業ごとの変更を分ける仕組みです。`main`へ直接変更を送らず、作業ブランチからPull Requestを作ります。続きの作業の場合は新しいブランチを作らず、既存の作業ブランチで作業します。

### 4-3. 起動して編集する

```bash
docker compose up --build
```

PC側のソースを保存すると、画面は自動更新され、Goは自動でビルド・再起動します。通常の編集で毎回コンテナを作り直す必要はありません。

### 4-4. 変更を確認する

別のターミナルで実行します。

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
docker compose exec backend go test ./...
git diff
```

エラーがないことと、ブラウザで変更箇所が動くことを確認します。初期段階のGoには自動テストはまだなく、`go test`はパッケージのコンパイル確認になります。`build`は本番向けビルドの確認です。開発サーバーの出力と競合しないよう、`.next-build`に出力します。

### 4-5. 変更をチームに共有する

```bash
git status
git add frontend/src/app/page.tsx
git diff --cached
git commit -m "トップ画面の表示を調整"
git push -u origin feat/restaurant-card
```

- `git add`：コミットに含めるファイルを選びます。パスは実際に変更したものに置き換えます。
- `git diff --cached`：選んだ変更だけを確認します。APIキーなどが含まれていないか確認します。
- `git commit`：変更のまとまりをPC上の履歴に保存します。
- `git push`：履歴をGitHubに送信します。続きのpushは`git push`だけで実行できます。

GitHubのリポジトリ画面で「Compare & pull request」を開き、取り込み先を`main`にして、変更内容と確認したことを書いてPull Request（変更のレビュー依頼）を作成します。レビュー後にチームの運用に沿ってマージします。

競合（conflict）やpushの拒否が出た場合は、強制pushや`reset --hard`をせず、`git status`とエラーメッセージをチームに共有してください。

## 5. 終了・再開する

起動したターミナルで `Ctrl + C` を押すと停止します。バックグラウンドで動かしたい場合は次を使います。

```bash
docker compose up --build -d
```

バックグラウンドで起動したものを含め、停止するには次を使います。

```bash
docker compose stop
```

コンテナも片付ける場合は次を使います。**DBデータは残ります。** 次回は`docker compose up --build`で再開できます。

```bash
docker compose down
```

## 6. ファイルの案内

```text
Matching-Meal/
├── frontend/
│   ├── src/app/             # ページ、全体レイアウト、CSS
│   ├── src/components/ui/   # shadcn/uiの部品
│   ├── src/lib/             # 共通処理
│   ├── components.json     # shadcn/ui設定
│   ├── next.config.ts      # API転送・開発設定
│   └── Dockerfile          # フロントエンドの開発環境
├── backend/
│   ├── cmd/api/main.go      # APIの起動・接続確認
│   ├── migrations/         # DBテーブル変更の履歴
│   ├── .air.toml           # Goの自動再起動設定
│   └── Dockerfile          # バックエンドの開発環境
├── compose.yaml            # サービスの起動・接続設定
├── .env.example            # チームで共有する設定例
└── .env                    # 自分の設定。Gitには送らない
```

APIに新しい機能を追加する際は、必要に応じて`backend/internal/`に処理を分割します。

## 7. 設定・依存ライブラリを変更する

| 設定 | 用途 | 初期値 |
| --- | --- | --- |
| `FRONTEND_PORT` | PCで画面を開くポート | `3000` |
| `POSTGRES_USER` | ローカルDBのユーザー | `meal` |
| `POSTGRES_PASSWORD` | ローカルDBのパスワード | 開発用の仮パスワード |
| `POSTGRES_DB` | ローカルDB名 | `meal` |
| `HOTPEPPER_API_KEY` | 今後の店舗検索に使用 | 空でOK |
| `DEV_ALLOWED_ORIGIN` | スマホ確認用のホスト名 | 空でOK |

`.env`は個人用、`.env.example`は設定項目を共有する見本です。新しい項目を追加したら見本にも説明を書きます。秘密情報にはブラウザへ公開される`NEXT_PUBLIC_`を付けず、バックエンドで扱います。

`.env`変更後は`docker compose up --build -d`で反映します。**DBのユーザー・パスワード・DB名は初期作成時に適用されるため、既存のDBには`.env`変更だけでは反映されません。** 通常は初期値のまま使います。変更が必要ならチームに相談してください。

フロントエンドのパッケージ追加例（`パッケージ名`を置き換えます）：

```bash
docker compose exec frontend npm install --save-exact パッケージ名
```

`package.json`と`package-lock.json`を両方コミットします。コンテナ起動時に`npm ci`が走り、共有されたロックファイルに合わせて依存関係が揃います。起動にはパッケージ取得のネットワーク接続が必要な場合があります。

Goの依存関係を変更したら、コンテナ内で`go mod tidy`を実行し、`go.mod`と`go.sum`を両方コミットします。Dockerfileを変更した場合も`docker compose up --build`で再ビルドします。

## 8. DBマイグレーション

最初のマイグレーションでは、接続確認専用の`development_checks`テーブルと1行のデータを作ります。ヘルスチェックはこのデータを実際に読みます。

新しいDB変更は、番号を増やしたファイルをペアで追加します。

```text
backend/migrations/000002_create_rooms.up.sql    # 変更を適用するSQL
backend/migrations/000002_create_rooms.down.sql  # 変更を戻すSQL
```

すでに共有・適用済みのSQLを書き換えず、新しい番号を追加します。チーム内で番号の重複を避けてください。

DBが起動している状態で、未適用の変更を適用します。

```bash
docker compose run --rm migrate
```

`no change`は適用済みという意味で正常です。適用に失敗して`dirty`と出た場合は、バージョンを無理に進めずログとSQLをチームに共有してください。

DB内を確認する場合は次を実行します。

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

`\dt`でテーブル一覧、`SELECT * FROM development_checks;`で接続確認データ、`\q`で終了できます。

### DBデータを全部消して作り直す場合だけ

**次の操作は、このプロジェクトのローカルDBデータと依存ライブラリのキャッシュを削除します。元に戻せません。日常の停止には使わないでください。** ソースコードは消えません。必要なデータがないことを確認してから実行します。

```bash
docker compose --profile tunnel down --volumes
docker compose up --build
```

## 9. スマホで確認する（任意）

PC上のアプリをCloudflareの一時的なHTTPS URLで開きます。このURLはインターネットからアクセスできるため、検証用データだけを使い、確認後は停止します。PCとDockerは起動したままにしてください。

```bash
docker compose --profile tunnel up --build -d
docker compose logs -f tunnel
```

ログに出る`https://……trycloudflare.com`をスマホで開きます。`Ctrl + C`はログ表示だけを終了し、トンネルは動いたままです。

開発中の画面自動更新を許可するため、`.env`の`DEV_ALLOWED_ORIGIN`に、表示されたURLの`https://`と末尾の`/`を除いたホスト名を設定します。

```dotenv
DEV_ALLOWED_ORIGIN=実際のホスト名.trycloudflare.com
```

```bash
docker compose up -d frontend
```

確認が終わったら公開を止めます。

```bash
docker compose --profile tunnel stop tunnel
```

Quick TunnelのURLは再起動時に変わることがあります。その場合は設定も更新します。現時点ではPWA・オフライン対応は未実装です。継続的なPWA確認には固定URLのトンネルを検討します。

## 10. 困ったとき

| 症状 | 最初に試すこと |
| --- | --- |
| `Cannot connect to the Docker daemon` | Docker Desktopを起動して、起動完了を待つ |
| `docker: command not found` | Docker Desktopをインストールし、ターミナルを開き直す |
| `.env`の値が足りないというエラー | `.env`があるか、`.env.example`の必須項目が揃っているか確認 |
| `port is already allocated` | `.env`の`FRONTEND_PORT`を`3001`などに変更し、再起動。開くURLも変更 |
| 起動に時間がかかる | 初回はダウンロード・コンパイルを待つ。別ターミナルでログを確認 |
| 画面で接続失敗 | `docker compose ps -a`とbackend・migrate・dbのログを確認 |
| 編集が反映されない | 保存先がこのプロジェクトか確認し、該当サービスを再起動 |
| ライブラリが見つからない | 最新コード取得後に`docker compose up --build`を実行 |
| DBの認証エラー | 作成後に`.env`のDB設定を変更していないか確認。安易にデータを削除しない |
| Gitの更新で競合・拒否 | `git status`を確認し、エラーと一緒にチームに相談 |
| Tunnelで画面が開かない | PCが起動中か、最新のURLか、frontendが起動済みか確認 |

ログを見るコマンド：

```bash
docker compose logs --tail=100 frontend backend migrate db
```

ログを追いかける場合：

```bash
docker compose logs -f backend
```

自動更新にはDocker上でも検知しやすいポーリングを使っています。それでも反映されない場合：

```bash
docker compose restart frontend backend
```

相談時には「実行したコマンド」「エラー」「OS」「`docker compose ps -a`の結果」を添えてください。`.env`の中身やAPIキーは貼らないでください。

## 11. よく使うコマンド早見表

すべて`Matching-Meal`フォルダで実行します。

| やりたいこと | コマンド |
| --- | --- |
| 起動 | `docker compose up --build` |
| バックグラウンド起動 | `docker compose up --build -d` |
| 状態を見る | `docker compose ps -a` |
| ログを見る | `docker compose logs --tail=100` |
| 停止する | `docker compose stop` |
| コンテナを片付ける（DBは保持） | `docker compose down` |
| DB変更を適用する | `docker compose run --rm migrate` |
| コードの変更一覧 | `git status` |
| コードの差分 | `git diff` |

## 12. 開発環境の範囲

このComposeはホットリロード付きのローカル開発用です。本番用のデプロイ設定は含みません。Node.js 24・Go 1.26・PostgreSQL 17の系列を指定し、JSとGoの依存ライブラリはロックファイルで共有します。コンテナのパッチ更新は取得時点で変わるため、完全に同一のイメージが必要になった段階でdigest固定を検討します。
