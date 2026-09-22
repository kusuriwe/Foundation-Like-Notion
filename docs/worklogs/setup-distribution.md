# 初回セットアップ・配布手順の簡略化 worklog

## Goal and status

複数OSの自前運用者向けに、Notion接続の最小手順と安全な起動前診断を提供する。公開ダミーデモの閲覧・公開は別導線に分けた。コードと手順書の実装・検証は完了し、独立reviewとarchiveは未実施である。

## Evidence and decisions

- 開始時はlocal `main` の `3693ca4`、worktree clean、`origin/main`より28 commit ahead。remoteへはpushしない。
- 現行READMEはfixtureからNotionへの二段階コピーで、hash生成にPlaywright入り開発imageを使う。新手順は本番image内のcompiled CLIに統一する。
- `config:check` はNotion schemaをread-onlyで照会するが、記事本文・個別relationページ・SQLiteには触れない。結果は件数と安全な分類のみとする。
- 追加・変更したfileは、`README.md`、`docs/setup.md`、`docs/reader-configuration.md`、`docs/demo-publishing.md`、`config/reader.notion.minimal.example.yaml`、root script、API診断CLIとtest、active plan、本worklogである。既存の詳細YAML例、`auth:hash`、`config:resolve`、公開API、SQLite schemaは変更していない。
- 本番imageのcompiled `setup:hash`を合成パスワードで実行し、完全なArgon2id hashが1件得られることを確認した。hash値は記録していない。
- 本番imageの`config:check`を既存のignored実Notion設定で実行し、`ok: true`、Data Source 2件、mapping 8件を確認した。token、ID、Property名、本文は出力されていない。実記事と個別relationページの取得可否はこの診断の範囲外である。
- 診断前後の既存SQLite row countは`resources=23`、`sessions=8`で不変。診断CLIはDBを開かず、serverも起動しなかった。
- `git diff --check`、`docker compose config --quiet`、`npm run check`（API 59/Web 10/contracts 10 tests）、通常版E2E 2件、demo E2E 3件（WebKit offline 1件skip）、demo build/verify、Pages workflow検査、`npm audit`（0 vulnerabilities）はpass。新規ガイドの相対リンクは全件存在を確認した。SDKをmockした回帰テストではschema retrievalだけが呼ばれ、query/updateは0回だった。
- WindowsホストのPowerShellとDocker上のLinux環境ではコマンドと設定を確認した。実際のmacOS・Linuxホスト端末でのコピー・Docker操作は未実施であり、配布後の確認項目として残る。実Pages公開も今回行っていない。
- 実装・手順書・active planはlocal commit `6a0697c`（`feat: simplify Reader setup and diagnostics`）に記録した。`.env/reader.yaml`と`.env/reader.env`はignore対象であり、stage・commitしていない。

## Next step

実装と本記録をlocal `main`へcommitし、独立reviewerに最終差分・テスト・手順書・診断証跡を確認してもらう。findingがなければreviewerだけがactive planをarchiveする。remoteへはpushしない。
