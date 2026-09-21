# Property 名設定・KaTeX 数式表示 Worklog

## Goal

Reader YAML の Property 名指定を安全に起動時解決し、Notion の inline/block 数式と記事詳細タイトルを KaTeX で表示する。一覧・検索の plain text と既存の security/cache/storage 境界は維持する。

## Status

- 2026-09-21: 実装開始。開始時 HEAD は `456c991`、branch は `main`、worktree は clean。
- 2026-09-21: 最初のlive smokeで、既存PWAの旧contractと新APIのinline-equation variantが一時的に競合し、記事詳細のparseが失敗した。Serveとproductionを停止し、equationへ旧client用plain `text`を付けるrolling compatibility修正へ移行した。

## Evidence

- Pending.

## Decisions

- Input config と内部の ID-only config を別 schema にする。
- Property 名は完全一致・大文字小文字区別で解決し、結果を永続化しない。
- Article summary は plain title のまま、article detail のみ rich title を追加する。
- KaTeX parse failure はログを残さず、元の TeX を text-only で表示する。

## Next step

- Config schema と起動時 Property resolver を実装する。
