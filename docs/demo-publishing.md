# 静的公開デモの更新・配布 / Update and publish the static demo

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

公開demoは、公開SDQ NotionをReader DTOへ変換した静的snapshotです。Notion token、Password hash、Data Source・Property・Page・Block ID、署名付きURL、`.env/`はPagesへ含めません。GitHub ActionsからNotionへ接続せず、ローカルで検証・commitされた`demo/published/`だけをbuildします。

記事本文と画像は意図的な公開物であり、Service Workerにもprecacheされます。Notion側で後から非公開または削除しても、Git履歴や公開済みartifactから自動では消えません。export前に公開範囲と権利を確認してください。

### 1. 候補を生成する

Docker Desktopを起動し、`.env/reader.yaml`と`.env/reader.env`が通常Readerで動作する状態にします。次のコマンドはread-only接続で全記事、Relation表示、記事内database、画像・iconを読み取り、ignored領域へ候補を生成します。Notionや通常ReaderのSQLiteは変更しません。

```powershell
docker compose run --rm `
  -e READER_CONFIG_PATH=/workspace/.env/reader.yaml `
  app npm run demo:export
```

macOS・LinuxなどのPOSIX shellでは1行で実行します。

```sh
docker compose run --rm -e READER_CONFIG_PATH=/workspace/.env/reader.yaml app npm run demo:export
```

成功時に表示するのはdatabase、article、assetの件数と合計byte数だけです。候補は`.data/demo-export/candidate/published/`、安定した公開ID用の専用SQLiteは`.data/demo-export/reader.sqlite`へ保存され、どちらもGitには追加されません。

exportは記事200件、asset 500件、1 asset 10 MiB、全asset 100 MiB、記事内table 1表500行を上限とします。超過、取得失敗、未変換ID、秘密値、署名付きURLは省略せずexport全体を停止します。

### 2. 追跡対象へ反映する

候補を再取得・再検証し、`demo/published/`へ反映します。`--apply`がない実行はtracked fileを変更しません。

```powershell
docker compose run --rm `
  -e READER_CONFIG_PATH=/workspace/.env/reader.yaml `
  app npm run demo:export -- --apply
```

```sh
docker compose run --rm -e READER_CONFIG_PATH=/workspace/.env/reader.yaml app npm run demo:export -- --apply
```

反映は検証済みdirectory単位で行い、途中で失敗した場合は以前のsnapshotへ戻します。生成fileは直接編集せず、表示設定や内容はNotionまたは`.env/reader.yaml`で直して再exportします。

### 3. ローカル確認

```sh
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
docker compose run --rm app npm run e2e:demo
docker compose run --rm app npm run demo:preview
```

<http://127.0.0.1:4173/Foundation-Like-Notion/>でdesktop/mobile、記事、画像、数式、header、検索、offline表示を確認します。出力は`apps/web/dist-demo`、base pathは`/Foundation-Like-Notion/`です。通常版の`/api/**`は引き続きNetworkOnlyで、通常Readerの記事はoffline保存されません。

### 4. GitHub Pagesへ公開する

`.github/workflows/pages.yml`は`release` branchへのpushだけで起動し、`apps/web/dist-demo`だけをdeployします。GitHub SecretsやNotion設定は使いません。coding agentはpushせず、人間のrepository ownerが行います。

既存の`release`を最新`main`へfast-forwardする場合:

```sh
git fetch origin
git switch main
git status
git switch release
git merge --ff-only main
git push origin release
```

remote `release`にローカルにない変更がある場合は上書きせず、先に差分を確認してください。想定URLは <https://kusuriwe.github.io/Foundation-Like-Notion/> です。

初回はGitHub Settings → Pages → Build and deployment → Sourceを **GitHub Actions** にします。`github-pages` environmentが`release`を拒否する場合は、Settings → Environments → github-pages → Deployment branches and tagsで **Selected branches and tags** を選び、Branch rule `release`を追加します。Node.jsやrunner imageのdeprecation表示だけならdeploy失敗原因ではありません。

著作権と第三者assetの範囲は[`demo/README.md`](../demo/README.md)、[ライセンス一覧](../LICENSES/README.md)、[`NOTICE`](../NOTICE)を確認してください。

<a id="english"></a>

## English

The public demo is a static Reader DTO snapshot of the public SDQ Notion. Pages receives no Notion token, password hash, Data Source, Property, Page, or Block ID, signed URL, or `.env/` file. GitHub Actions never connects to Notion; it builds only the locally reviewed and committed `demo/published/` directory.

Article text and images are intentionally public and are precached by the Service Worker. Making an item private or deleting it in Notion does not remove it automatically from Git history or an already published artifact. Confirm publication rights and scope before exporting.

### 1. Generate a candidate

Start Docker Desktop and make sure the normal Reader works with `.env/reader.yaml` and `.env/reader.env`. This command uses the read-only connection to collect articles, displayed relations, embedded databases, images, and icons into an ignored candidate. It does not modify Notion or the normal Reader database.

```powershell
docker compose run --rm `
  -e READER_CONFIG_PATH=/workspace/.env/reader.yaml `
  app npm run demo:export
```

On macOS, Linux, or another POSIX shell, run it on one line:

```sh
docker compose run --rm -e READER_CONFIG_PATH=/workspace/.env/reader.yaml app npm run demo:export
```

Success output contains only database, article, and asset counts plus total bytes. The candidate is stored under `.data/demo-export/candidate/published/`; a dedicated ID-mapping database lives at `.data/demo-export/reader.sqlite`. Neither is committed.

The exporter allows at most 200 articles, 500 assets, 10 MiB per asset, 100 MiB total assets, and 500 rows per embedded table. A limit, retrieval failure, unconverted identifier, secret value, or signed URL fails the complete export instead of silently omitting data.

### 2. Apply the candidate

Fetch and validate the candidate again, then replace `demo/published/`. Without `--apply`, tracked files are unchanged.

```powershell
docker compose run --rm `
  -e READER_CONFIG_PATH=/workspace/.env/reader.yaml `
  app npm run demo:export -- --apply
```

```sh
docker compose run --rm -e READER_CONFIG_PATH=/workspace/.env/reader.yaml app npm run demo:export -- --apply
```

The validated directory is swapped as one rollback-safe unit. Do not hand-edit generated files; change Notion or `.env/reader.yaml`, then export again.

### 3. Check locally

```sh
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
docker compose run --rm app npm run e2e:demo
docker compose run --rm app npm run demo:preview
```

At <http://127.0.0.1:4173/Foundation-Like-Notion/>, check desktop/mobile layout, articles, images, equations, headers, search, and offline behavior. Output is written to `apps/web/dist-demo` with base path `/Foundation-Like-Notion/`. The normal Reader still keeps `/api/**` NetworkOnly and does not retain normal Reader articles offline.

### 4. Publish with GitHub Pages

`.github/workflows/pages.yml` runs only for a push to `release` and deploys only `apps/web/dist-demo`. It uses no GitHub Secret or Notion setting. A human repository owner, never a coding agent, performs the push.

To fast-forward an existing `release` to the latest `main`:

```sh
git fetch origin
git switch main
git status
git switch release
git merge --ff-only main
git push origin release
```

Do not overwrite a remote `release` that has unknown changes; inspect and reconcile it first. The expected URL is <https://kusuriwe.github.io/Foundation-Like-Notion/>.

For the first deployment, select **GitHub Actions** under GitHub Settings → Pages → Build and deployment → Source. If the `github-pages` environment rejects `release`, open Settings → Environments → github-pages → Deployment branches and tags, choose **Selected branches and tags**, and add the exact Branch rule `release`. Node.js or runner-image deprecation notices alone are not deployment failures.

See [`demo/README.md`](../demo/README.md), the [license scope](../LICENSES/README.md), and [`NOTICE`](../NOTICE) for copyright and third-party asset boundaries.
