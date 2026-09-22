# Configurable Presentation・静的 Fixture PWA・GitHub Pages準備

## Goal

local `main`で通常版と公開demoに共通する安全なpresentation設定と拡張可能な記事headerを実装する。静的dummy PWAをPages相当の`/Foundation-Like-Notion/`で検証し、将来人間が`release`へpushすればdeployが始まるworkflowを用意する。今回、branch作成・push・実Pages deployは行わない。

## Implementation contract

- `reader.yaml`の任意`presentation.version: 1`でlocale、brand、theme色、allowlisted messages、templateごとのarticle headerを設定する。省略時は既存表示とstorage keyを維持する。
- template IDは小文字英数字/hyphen最大64文字。databaseのtemplate参照とheader variable参照を起動時検証する。任意HTML/JS/CSS/外部font URLは受け付けない。
- `field-grid`と`compact-emblem`をtrusted renderer registryへ分離し、field/label/order/width/emphasis/icon/density/title placementをYAMLで設定可能にする。詳細titleはrich text/equationを保ち、headerかcontentの一方だけに表示する。
- 通常版にunauthenticated `GET /api/presentation`とserver-generated manifestを追加する。Notion IDや秘密値を返さず、APIは`no-store`、Notion contentはNetworkOnlyとする。read-only endpoint/SQLite schemaは維持する。
- Web通信をHTTP/static clientへ分離する。demoは追跡対象の新規dummy YAML/assetだけをbuild時検証してbundleし、認証不要の入口、HashRouter、demo専用storage、offline dummy記事を提供する。
- `.github/workflows/pages.yml`は`release` pushのみでNode 24.21.0のbuild/verifyを行い、`apps/web/dist-demo`のみをdeployする。GitHub Secrets/Notion設定は使用しない。

## Acceptance and review

- Config/contract、header UI、API/manifest、demo参照整合性、start/exit/search/recent、asset path、秘密情報非露出をunit/contract testする。
- `git diff --check`、Compose config、`npm run check`、通常/demo Chromium desktop・WebKit mobile E2E、`npm audit`、demo build/verify、workflow静的検査を通す。
- ローカルproject-path production previewでdummy offline PWAを確認し、通常版は実Notionの短いlogin/list/detail/header smokeとログ・SQLite/cache境界を監査する。
- 実装・証跡はlocal `main`へcommitする。別reviewerが最終diff、gate、artifact、workflow、worklogを独立確認し、findingがない場合だけ本planをarchiveする。programmer agentはpushしない。
