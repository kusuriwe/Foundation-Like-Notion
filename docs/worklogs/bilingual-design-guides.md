# デザイン追加ガイド・日英併記 worklog

## Goal and status

利用者がReaderの文言・色・headerを安全に変更できるよう、LLM向けクイックガイド付きの文書を追加し、主要な利用者向け文書を日本語・英語の両方で読めるようにした。独立reviewで日英の手順、実装との一致、秘密情報境界を確認し、blocking findingがなかったため、[計画をarchive](../plans/archive/2026-09-23-bilingual-design-guides.md)した。実環境での操作や英語の人間による校閲は引き続き未実施である。

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

## Independent review (2026-09-23)

- Reviewerは`723e6c4`の親commitからの全差分と、6つの利用者向け文書、active plan、worklogを確認した。日本語・英語の手順と設定キーを比較し、Compose、package scripts、Notion設定schema、header registry、demo build設定、Pages workflowと照合した。READMEのfixture開発手順、セットアップの本番image手順、デザインガイドのYAMLとtrusted renderer手順にblocking findingはなかった。
- `git diff 723e6c4^ 723e6c4 --check`、`docker compose config --quiet`、`docker compose run --rm app npm run check`をreviewerが再実行し、すべてpassした。後者ではAPI 60件、Web 12件、contracts 10件のtestとproduction buildがpassした。
- `.env/`、実Notion、SQLiteの値は読まず、GitHub Pagesへのpushも行っていない。実macOS・Linux、実iOS、公開Pages、英語の人間による校閲はこのreviewの範囲外である。

## Next step

利用者がガイドに沿って新しいデザインを試し、必要に応じて文言・画面の微調整を行う。表示仕様に新しい選択肢が出る場合は先にPLAN、既存設定内の小さな修正なら直接実装できる。remoteへのpushは利用者だけが行う。
