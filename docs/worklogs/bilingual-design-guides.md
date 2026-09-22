# デザイン追加ガイド・日英併記 worklog

## Goal and status

利用者がReaderの文言・色・headerを安全に変更できるよう、LLM向けクイックガイド付きの文書を追加し、主要な利用者向け文書を日本語・英語の両方で読めるようにした。実装とローカル検証は完了し、独立reviewとarchiveは未実施である。

## Scope and decisions

- `README.md`、`docs/setup.md`、`docs/reader-configuration.md`、`docs/demo-publishing.md`、`docs/header-renderers.md`を日英併記にし、`docs/design-customization.md`を追加した。内部のplan/worklogと`dev-docs/`は翻訳対象外とした。
- 言語ごとの章と明示的なanchorを使い、設定キー・コマンドは原文のまま維持した。デザインガイドではYAML設定と新しいtrusted renderer実装を分け、通常版のignored設定と公開デモのtracked dummy設定の違いを明記した。
- LLM利用例には、`.env/`、token、Notion ID、実記事、passwordを渡さず、架空のReader variableと公開可能なプロトタイプだけを使う境界を記載した。
- READMEとデモ配布手順は、Pagesの稼働を未確認のまま断定しない記述にした。push手順は人間のrepository owner向けであり、agentは実行しない。
- 実装コード、公開API、Demo data、ignored `.env/`、SQLiteは変更していない。検証時に既存のproduction containerが起動中であることがComposeの出力に見えたが、本作業では停止・再起動していない。

## Validation

- 6つの利用者向けMarkdownについて、日本語・英語anchorとローカルリンクの存在を検査し、欠落0件だった。
- `git diff --check`、`docker compose config --quiet`、`docker compose run --rm app npm run check`がpassした。品質gateにはformat、lint、typecheck、unit tests、production buildが含まれる。
- 実Notion、実機iOS、GitHub Pagesの状態は本書き換えで操作・検証していない。英語表現の人間による校閲も未実施。

## Next step

local commit後、別reviewerが日本語・英語の手順の一致、秘密情報境界、リンク、YAML例を確認する。findingがなければreviewerだけがactive planをarchiveする。remoteへpushしない。
