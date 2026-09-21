# Property 名設定・KaTeX 数式表示 Worklog

## Goal

Reader YAML の Property 名指定を安全に起動時解決し、Notion の inline/block 数式と記事詳細タイトルを KaTeX で表示する。一覧・検索の plain text と既存の security/cache/storage 境界は維持する。

## Status

- 2026-09-21: 実装開始。開始時 HEAD は `456c991`、branch は `main`、worktree は clean。
- 2026-09-21: 最初のlive smokeで、既存PWAの旧contractと新APIのinline-equation variantが一時的に競合し、記事詳細のparseが失敗した。Serveとproductionを停止し、equationへ旧client用plain `text`を付けるrolling compatibility修正へ移行した。
- 2026-09-21: 修正版の自動gate、実Notion smoke、security/cache/storage監査が合格。独立レビュー待ち。
- 2026-09-21: 別reviewerがbase `456c991`から証跡commit `b75372d`までを独立確認した。findingなしで承認し、active planをarchiveした。

## Evidence

- Implementation commits:
  - `c59e91a feat: resolve Notion properties by name`
  - `098fcc1 feat: render Notion equations with KaTeX`
  - `f328d42 fix: preserve equation compatibility during PWA updates`
- `git diff --check` と `docker compose config --quiet` は合格した。
- `docker compose run --rm app npm run check` は format、lint、strict typecheck、API 49件、Web 6件、contract 5件のtest、全production buildに合格した。
- `docker compose run --rm app npm run e2e` は Chromium desktop と WebKit iPhone profile の2件に合格した。
- `docker compose run --rm app npm audit` は既知脆弱性0件だった。
- Production imageは内部でも全checkとproduction dependency auditを再実行して合格した。Nodeは24.21.0、Tailscaleは1.102.4だった。
- ignored実設定はProperty名1件とProperty ID 7件の混在で起動し、YAMLを書き換えずに実Notion schema解決へ成功した。healthは200かつ `source: notion`、listenerは `127.0.0.1:3000` のみだった。
- 最初のlive smokeでは旧PWA bundleが新equation variantをtext spanとしてparseできず、記事詳細が失敗した。修正後はequationが同値のplain `text`を持ち、新contractはequationを優先、新旧text contractはplain fallbackとして受理する回帰testを追加した。
- 修正版を再deploy後、ユーザーはbrowser cacheを消した短いHTTPS smokeで実Notionの記事詳細と数式表示を確認した。route evidenceはdatabase list、article list、11 article details、2 searches、2 assetsがすべて200だった。
- Production logのkeyは `endpoint`、`hostname`、`latencyMs`、`level`、`msg`、`pid`、`reqId`、`requestId`、`status`、`time` だけだった。token、password hash、設定済みData Source/Property名・IDのexact matchは0件、Reader cursorも0件だった。
- SQLiteは `resources` 20行と `sessions` 6行だけだった。列は従来どおりresource mappingとsession hash/timestampだけで、title、body、Property value、equation、cursorを保持する列はなかった。
- Built Service WorkerはKaTeXのwoff2を19件、woffを20件precacheし、API precacheは0件、`/api/**` はNetworkOnlyだった。health responseは `Cache-Control: no-store` だった。
- 監査後にTailscale Serveとproduction containerを停止した。`.env/` とproduction SQLite named volumeは削除していない。
- 独立reviewerは全差分、active plan、worklogを照合し、`git diff --check`、`docker compose config --quiet`、`docker compose run --rm app npm run check`、`docker compose run --rm app npm run e2e`、`docker compose run --rm app npm audit`を再実行した。checkはAPI 49件、Web 6件、contract 5件、全build、E2EはChromium desktopとWebKit mobileの2件に合格し、auditは既知脆弱性0件だった。
- 独立reviewerはtracked `.env` が0件、`.env/reader.env` がignore対象、Browser側のNotion SDK/API参照が0件であることを確認した。公開route実装とSQLite実装はbaseから不変で、Property名解決、KaTeX安全設定、rolling PWA互換、NetworkOnly/no-store境界にfindingはなかった。

## Decisions

- Input config と内部の ID-only config を別 schema にする。
- Property 名は完全一致・大文字小文字区別で解決し、結果を永続化しない。
- Article summary は plain title のまま、article detail のみ rich title を追加する。
- KaTeX parse failure はログを残さず、元の TeX を text-only で表示する。
- PWAのrolling update中は旧bundleが新APIへ接続し得るため、inline equationは `type` / `expression` に加えて同値のplain `text`を返す。新clientはequationを優先し、旧clientは安全なTeX文字列として表示する。

## Next step

- ユーザーがlocal commit群とarchive結果を確認し、必要な場合だけremoteへpushする。
