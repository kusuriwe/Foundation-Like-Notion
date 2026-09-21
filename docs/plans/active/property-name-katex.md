# Property 名設定・KaTeX 数式表示 実装計画

## Summary

- `reader.yaml` で Property ID または完全一致する Property 名を指定できるようにし、Notion 起動時に名前を ID へ解決する。
- Notion の inline equation と equation block を KaTeX で表示し、`mhchem` を有効にする。
- 一覧・検索の plain-text title、read-only 境界、SQLite schema、API の NetworkOnly 方針は維持する。

## Implementation

- 入力用 config schema と ID 解決済み config schema を分離する。各 locator は ID / name のどちらか一方だけを許可し、fixture は ID のみとする。
- Notion schema は content Data Source ごとに起動時一度だけ取得する。完全一致と Property type を検証し、解決結果はメモリだけに保持する。
- Rich text contract に equation variantを追加し、記事詳細だけ `titleRichText` を返す。一覧・検索は従来の `title: string` を維持する。
- KaTeX を safe options で DOM に描画し、失敗時は式を text-only で表示する。KaTeX font は静的 PWA asset として precache する。
- README、example config、unit/contract/UI/E2E test、worklog を更新する。

## Acceptance

- ID/name の単独・混在設定、失敗時の fail-closed と秘密値非露出をテストする。
- inline/display/mhchem/title/fallback、plain-text list/search、offline cache 境界をテストする。
- `git diff --check`、Compose config、`npm run check`、E2E、audit を通す。
- live smoke と独立レビュー後だけ本計画を archive する。

## Assumptions

- `sourceDataSourceId` と `relationSources` は ID のままとする。
- Property 名の rename や曖昧な一致は暗黙補正せず、起動エラーにする。
- `.env/`、Notion content、既存 SQLite data は自動変更しない。
