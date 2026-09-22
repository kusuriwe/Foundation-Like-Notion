# 初回セットアップ・配布手順の簡略化 worklog

## Goal and status

複数OSの自前運用者向けに、Notion接続の最小手順と安全な起動前診断を提供した。公開ダミーデモの閲覧・公開は別導線に分けた。独立reviewで初回clone手順と開発用fixtureの説明を修正し、最終差分と検証証跡を承認した。planは[archive](../plans/archive/2026-09-22-setup-distribution.md)へ移した。

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

## Independent final review

- Reviewerは`3693ca4..f04cece`の実装・手順書・テスト・証跡を確認した。初回セットアップでclone後の作業場所が不明な点と、開発用fixtureで読まれない`.env/reader.yaml`を案内していた点を指摘し、`f04cece`で両方が修正されたことを確認した。
- 診断CLIは設定のschema、Argon2id hash、Data Source schemaを検証し、SDKの`dataSources.retrieve`のみを利用する。記事取得・Notion書込み・SQLite操作への参照はなく、失敗出力は分類、安全な設定path、HTTP statusに限定される。Property名・ID・token・SDK生エラーは出力しない。
- 最小YAMLは既存のdefault `simple` headerと互換で、既存の詳細例・YAML schema・公開API・SQLite schemaは変更されていない。診断はrelation先の個別ページや記事内容の取得までは保証しないことを手順書に明記した。
- 修正後の`git diff --check`はpass。実装commit後の全gateと実Notion read-only診断の結果は上記のとおりで、documentation修正は実行コードを変更していない。未実施は実macOS/Linux端末と実GitHub Pages公開であり、今回の合格範囲外である。

## Next step

人間が配布・公開方針を確認する。実macOS/Linux端末での初回セットアップとGitHub Pages実公開は別途受入する。remoteへはpushしない。
