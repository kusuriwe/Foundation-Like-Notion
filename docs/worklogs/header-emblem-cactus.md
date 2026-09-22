# Emblem改良・Cactus Study header追加 worklog

## Goal and status

既存のread-only Readerに、プロトタイプに近いEmblemとカクタス風の分類headerを追加する。実装と自動検証は完了した。独立reviewとarchiveは未実施である。

## Evidence and decisions

- 開始時はlocal `main`、worktree clean、`origin/main`と一致していた。remoteへはpushしない。
- `dev-docs/notion_reader_header_prototypes.html` のEmblemとCactus Studyの構造・mobile reflowを参照した。Emblemは既存renderer IDを維持し、額縁iconと中央分類、任意captionを追加した。Cactus Studyは`cactus-study`という新しいtrusted rendererで、分類は設定順の最大3fieldから構成する。欠損値は詰め、すべて欠損なら分類枠を表示しない。
- 新しい設定はplain textと既存Reader variableだけを受け付ける。任意HTML/CSS/URLは受け付けない。headline欠損時は記事titleをrich text/数式のまま一度だけheaderに表示する。
- 変更箇所はcontracts/schema/default、backendのheader variable検証、web renderer/registry/CSS/title配置、fixture・Notion設定例、公開ダミーデモ、config/rendererガイド、unit/E2E test、active planである。ignored `.env/`、公開API、SQLite、Notion adapter、Service Workerは変更していない。
- `git diff --check`、`docker compose config --quiet`、`npm run check`（API 60/Web 12/contracts 10 tests）、通常版E2E 2件、demo E2E 3件はpass。demo WebKit offline test 1件は既存の意図的skipである。`demo:build`、`demo:verify`、`pages:verify`、`npm audit`（0 vulnerabilities）もpassした。
- demo E2EはChromium desktopとWebKit mobileでEmblemからCactus Studyへの切替、分類の表示、viewportを超えない配置を確認した。実Notionと実機iOSでの新header表示は未実施。公開ダミーデモの実Pages deployも行っていない。

## Next step

local commit後、別reviewerが差分・テスト・デモartifactを確認する。findingがなければreviewerがactive planをarchiveする。利用者が実Notionで試す場合は、ignored `.env/reader.yaml` の対象databaseの`templates`へ`cactus-study`を追加して再起動する。token、ID、本文は共有しない。
