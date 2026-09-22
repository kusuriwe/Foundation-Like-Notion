# デザイン追加ガイド・利用者向け文書の日英併記

## Goal

初めて利用する人が、安全に文言・配色・記事headerを変更できる手順を示す。READMEと利用者向けのセットアップ、設定、デモ配布、renderer開発文書を日本語・英語の両方で読めるようにする。

## Scope and invariants

- `docs/design-customization.md`を新設し、YAMLだけでの変更、新しいtrusted rendererの実装、LLMに依頼する際の秘密情報境界を説明する。
- `README.md`、`docs/setup.md`、`docs/reader-configuration.md`、`docs/demo-publishing.md`、`docs/header-renderers.md`を日英併記にし、相互リンクとコマンドを一致させる。
- plan/worklogと`dev-docs/`は利用者向け配布文書ではないため翻訳しない。`.env/`、公開API、実装コード、Demo contentは変更しない。
- 実Notionを公開デモへ混ぜず、Readerのread-only/秘密情報/非キャッシュ境界を維持する。

## Acceptance and review

- 両言語の手順・コマンド・設定キーが対応し、ローカルリンクがすべて存在することを確認する。
- `git diff --check`、Compose設定、既存の品質gateを確認する。
- local commit後、独立reviewerが利用者視点と安全性を確認する。承認された場合だけreviewerがplanをarchiveする。pushはしない。
