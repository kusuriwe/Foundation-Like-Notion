# Configurable Presentation・静的 Fixture PWA worklog

## Goal and current assessment

通常版と公開用の静的demoに共通する安全な表示設定と拡張可能な記事headerを実装し、`release` branchへ人間がpushすればGitHub Pagesへdeployされる状態にする。実Pages公開とremote操作は今回の範囲外である。

2026-09-22現在、通常版とdemoの自動gate、Pages相当のproject subpath preview、productionコンテナの起動・公開表示・保存境界監査は合格した。認証後の実Notion画面の短い目視smokeはユーザー確認待ちであり、独立レビューとarchiveはまだ行っていない。したがって、現時点では完了とは判定しない。

## Independent review remediation (2026-09-22)

最初の独立レビューでは、code name 欠損時の Compact Emblem による記事タイトル重複、light theme に残る固定暗色、組み込み header ID を上書きした際の未設定 variable の見逃しが見つかった。これらを修正し、記事タイトルの rich text/数式を一度だけ表示する回帰テスト、上書き設定の拒否テスト、light palette のテストを追加した。日付 locale と検索画面の固定文言も presentation に連動させた。修正 commit は `021729b` (`fix: address presentation review findings`)。独立 reviewer による修正後の再確認と実Notion smoke はまだ必要である。

再レビューでは不正なlocaleによる日付表示例外と、demo manifestの未知のトップレベル欄をbuildが見逃す問題が見つかった。共有schemaでlocaleを検証し、公開用manifest全体をstrict schemaで検証するようにした。各拒否ケースの回帰テストも追加した。修正commitは `652b54a` (`fix: validate locale and strict demo manifest`)。修正後に `git diff --check`、`docker compose config --quiet`、`npm run check` (API 52/Web 10/contracts 10 tests)、通常版 E2E (Chromium/WebKit 2件)、demo E2E (3件 pass/ WebKit offline 1件 skip)、`demo:build`、`demo:verify`、`pages:verify`、`npm audit` (0 vulnerabilities) が通過した。

最終production imageを再ビルドした。healthは `ok` / `source: notion`、presentation APIは `no-store`、port bindは `127.0.0.1:3000` のみ、tailnet限定Serveはport 3000へ転送中である。production logは4行で、ignored環境変数値、設定中のsource/Property ID、sensitive keyの一致は各0件だった。SQLiteをread-onlyで検査し、`resources(reader_id, source_id, kind, database_reader_id, created_at)`が22行、`sessions(token_hash, expires_at, created_at)`が7行で、本文・title・Property値の列は存在しなかった。独立reviewerは `652b54a` までのコード、demo artifact、release限定workflowについて追加findingなしと暫定承認した。ユーザーの更新後の実Notion smokeはまだ待機中であり、その後の最終判定とarchiveは未実施である。

## Implementation record

- 開始時のlocal `main` は `548968c`、worktreeはclean、`origin/main`より20 commit ahead。remote `release` 照会はsandbox内Git権限で失敗したため、将来の公開前に人間が再確認する。
- 機能別local commitは`bc9453c`（presentation/header）、`eaccf4b`（静的fixture demo）、`6cf4b6b`（release限定Pages workflow）。remoteへはpushしていない。
- 共有contractにversioned presentation、safe color/文言/header schemaとZod非依存fallbackを追加した。通常版でpresentation省略時は既存表示とlocalStorage keyを保つ。custom headerの未定義variable参照は起動時に拒否する。
- `field-grid`、`compact-emblem` をtrusted renderer registryとCSS Moduleへ分離した。新規renderer追加はschema branch、component、CSS、registry、testで完結する。
- unauthenticated `GET /api/presentation`、presentation由来のserver-generated manifest、HTTP/static demo client分離を追加した。API responseの`no-store`、read-only、認証・SQLite schema・通常版のNetworkOnlyは維持した。
- 追跡対象の新規dummy YAMLとSVG assetをbuild時に検証し、project base `/Foundation-Like-Notion/` のHashRouter PWAを生成する。demo sessionはsessionStorage、recent/template preferenceは通常版から分離したnamespaceを使う。
- `.github/workflows/pages.yml` は`release`へのpushだけで実行し、最小権限で`apps/web/dist-demo`のみをuploadする。branch作成、push、実Pages deployは行っていない。

## Validation evidence

- `git diff --check`: pass。
- `docker compose config --quiet`: pass。
- `docker compose run --rm app npm run check`: pass。API 51、Web 8、Contracts 7 testsがpass。format/lint/typecheck/通常production buildもpass。
- `docker compose run --rm app npm run e2e`: Chromium desktop、WebKit mobileともpass（2 tests）。
- `docker compose run --rm app npm run e2e:demo`: Chromium desktopの主要導線とoffline再読込、WebKit mobileの主要導線がpass（3 passed、WebKit offline 1 skipped）。同コマンドのwebServerが`/Foundation-Like-Notion/`でproduction previewを起動した。
- `docker compose run --rm app npm run demo:build` と `npm run demo:verify`: pass。demo artifactのAPI/Notion SDK/設定keyとignored `.env`実値の一致は0件。YAML parserはbrowser bundleへ入らない。
- `docker compose run --rm app npm run pages:verify`: pass。release-only trigger、権限、検証command、artifact path、concurrencyを確認。
- `docker compose run --rm app npm audit`: 0 vulnerabilities。
- `docker compose --profile production up --build -d production`: pass。既存のignored設定とnamed SQLite volumeを保持して再作成した。
- `http://127.0.0.1:3000/api/health`: `ok` / `source: notion`。`/api/presentation`: 200 / `Cache-Control: no-store`。`/manifest.webmanifest`: 200 / `application/manifest+json`。
- production portはCompose定義上`127.0.0.1:3000`のみ。productionログ8行に秘密環境値、Cookie/Authorization/Property/Source key、UUID形式IDの一致0件。SQLiteは`resources(reader_id, source_id, kind, database_reader_id, created_at)`22行、`sessions(token_hash, expires_at, created_at)`7行だけで、本文・title・Property列はない。
- Tailscale Serveは既存のHTTPS URLがport 3000へ転送される状態であることを、URLを記録せず確認した。

## Limitations and judgment

- 実GitHub workflow run、実Pages URL、PWA installは、ユーザーが後日`release`を作成・pushするまで未実施。既存remote `release`は今回確認できていないため、公開時に上書きせず確認する。
- 実Notionのlogin、記事一覧、記事詳細、既存2headerはユーザーの短いsmoke待ち。値・ID・本文・passwordはチャットへ貼らない。
- demoのdummy本文は意図的にoffline precacheされる。通常版の実本文はoffline再表示しない。WebKit offline自動試験は未実施で、Chromiumで同じ静的bundleを検証した。
- Viteの500 kB超chunk警告は残るが、demo previewのdesktop/mobile操作は合格。性能最適化は今回の受入条件ではない。
- 最初のdemo E2Eはpreview port引数の伝播不備でtimeoutした。scriptにportを固定して再実行し合格した。artifact verifierの`propertyName`単語検査はReact内部の`event.propertyName`を誤検知したため除外し、実設定値と固有設定keyの検査は維持した。

## Next step

ユーザーの実Notion短いsmoke結果を受け取る。合格後、productionコンテナの後片付け方針を確認して停止・保全し、実装と証跡をlocal `main`へcommitする。最後に独立reviewerが差分・gate・artifact・workflow・本記録を確認し、findingがない場合だけactive planをarchiveする。remoteへはpushしない。
