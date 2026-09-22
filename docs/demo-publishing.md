# 静的ダミーデモの編集・配布 / Edit and publish the static dummy demo

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

実Notionのtoken・設定・内容はこの配布経路に含めません。Pagesの実公開状況はGitHub上で確認してください。

### 静的fixtureデモ

公開demoは `demo/demo.yaml`、`demo/articles/*.yaml`、`apps/web/public/demo/` だけを入力にする静的PWAです。Notion、Fastify、SQLite、password、`.env/` は使いません。IDはすべて `demo_` prefixにし、未知のmanifest欄、参照切れ、無効なReader DTOはbuild時に拒否されます。

```sh
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
docker compose run --rm app npm run e2e:demo
```

出力は `apps/web/dist-demo`、base pathは `/Foundation-Like-Notion/` です。demoのdummy contentは意図的にService Workerへprecacheされ、offlineでも読めます。通常版の `/api/**` は従来どおりNetworkOnlyで、実Notion contentはoffline保存されません。新しいheaderや公開ダミー記事を追加する前に[デザイン追加ガイド](design-customization.md)を参照してください。

### GitHub Pages公開手順

`.github/workflows/pages.yml` は `release` branchへのpushだけで起動し、検証済みの `apps/web/dist-demo` だけをPages artifactとしてdeployします。`main`へのpush、手動実行、GitHub Secrets、Notion設定では起動しません。

初回公開時は、GitHub Settings → PagesのSourceを **GitHub Actions** に設定します。`docker compose run --rm app npm run pages:verify`でworkflowを確認し、`git ls-remote --heads origin release`でremoteに既存の`release` branchがないことを確認してから、人間が最新`main`から作成・pushします。既存branchがあれば新規作成や上書きをせず、差分を確認してください。

```sh
git switch main
git status
git switch -c release
git push -u origin release
```

これらのpushは人間のrepository ownerだけが行い、coding agentは実行しません。既存のremote `release` がある場合は上書きせず、先に差分を確認して統合方法を決めてください。想定URLは `https://kusuriwe.github.io/Foundation-Like-Notion/` ですが、公開後にworkflow結果と実URLを確認してください。

<a id="english"></a>

## English

This publishing path must never include real Notion tokens, settings, or content. Check GitHub for the current Pages deployment status; do not assume the expected URL is already live.

### Static fixture demo

The public demo is a static PWA built only from `demo/demo.yaml`, `demo/articles/*.yaml`, and `apps/web/public/demo/`. It uses no Notion connection, Fastify, SQLite, password, or `.env/` files. All demo IDs use the `demo_` prefix. Unknown manifest fields, broken references, and invalid Reader DTOs fail the build.

```sh
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
docker compose run --rm app npm run e2e:demo
```

The output is `apps/web/dist-demo`, with base path `/Foundation-Like-Notion/`. Dummy content is deliberately precached by the demo Service Worker and remains available offline. In the normal reader, `/api/**` remains NetworkOnly and real Notion content is not stored for offline reading. See the [design customization guide](design-customization.md) before adding a new header or public dummy article.

### GitHub Pages release procedure

`.github/workflows/pages.yml` runs only on a push to the `release` branch and deploys only the verified `apps/web/dist-demo` artifact. Pushing `main`, manual execution, GitHub Secrets, and Notion settings do not trigger this workflow.

For first publication, choose **GitHub Actions** as the Source in GitHub Settings → Pages. Check the workflow with `docker compose run --rm app npm run pages:verify`. Before creating a branch, run `git ls-remote --heads origin release` to check whether a remote `release` branch already exists. A human should create and push `release` from the latest `main` only if it is absent. If it exists, inspect the differences and decide how to integrate; do not overwrite it.

```sh
git switch main
git status
git switch -c release
git push -u origin release
```

These push commands are for the human repository owner, not an automated coding agent. The expected URL is `https://kusuriwe.github.io/Foundation-Like-Notion/`; verify the actual workflow result and URL after publication.
