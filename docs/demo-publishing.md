# 静的ダミーデモの編集・配布

実Notionのtoken・設定・内容はこの配布経路に含めません。Pagesはまだ実公開していません。

## Static fixture demo

公開demoは `demo/demo.yaml`、`demo/articles/*.yaml`、`apps/web/public/demo/` だけを入力にする静的PWAです。Notion、Fastify、SQLite、password、`.env/` は使いません。IDはすべて `demo_` prefixにし、未知のmanifest欄、参照切れ、無効なReader DTOはbuild時に拒否されます。

```powershell
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
docker compose run --rm app npm run e2e:demo
```

出力は `apps/web/dist-demo`、base pathは `/Foundation-Like-Notion/` です。demoのdummy contentは意図的にService Workerへprecacheされ、offlineでも読めます。通常版の `/api/**` は従来どおりNetworkOnlyで、実Notion contentはoffline保存されません。

## GitHub Pages release procedure

`.github/workflows/pages.yml` は `release` branchへのpushだけで起動し、検証済みの `apps/web/dist-demo` だけをPages artifactとしてdeployします。`main`へのpush、手動実行、GitHub Secrets、Notion設定では起動しません。

初回公開時は、GitHub Settings → PagesのSourceを **GitHub Actions** に設定します。`docker compose run --rm app npm run pages:verify`でworkflowを確認し、`git ls-remote --heads origin release`でremoteに既存の`release` branchがないことを確認してから、人間が最新`main`から作成・pushします。既存branchがあれば新規作成や上書きをせず、差分を確認してください。

```powershell
git switch main
git status
git switch -c release
git push -u origin release
```

既存のremote `release` がある場合は上書きせず、先に差分を確認して統合方法を決めてください。想定URLは `https://kusuriwe.github.io/Foundation-Like-Notion/` です。
