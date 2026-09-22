# Emblem改良・Cactus Study header追加

## Goal

`dev-docs/notion_reader_header_prototypes.html` のEmblemとCactus Studyを、既存のtrusted renderer方式で記事headerへ反映する。実Notion設定と公開APIは変更しない。

## Implementation contract

- `compact-emblem`を額縁付きicon、中央配置の分類、任意captionを持つプロトタイプ寄りの見た目へ改善する。既存のYAMLは引き続き有効とする。
- `cactus-study`を新しいrendererとして追加し、headline、シリーズ表記、最大3つの分類field、任意captionを設定可能にする。欠損fieldは詰め、headline欠損時は記事titleをrich text/数式のまま一度だけ表示する。
- 通常版と静的デモの設定例・選択肢・説明を更新する。ignored `.env/`は書き換えない。

## Acceptance and review

- Schema/設定、欠損値・title fallback・数式、desktop/mobileの切替をテストする。
- `npm run check`、通常版/demo版E2E、demo build/verify、Pages workflow検査をDocker内で実行する。
- local commitまで行い、独立reviewerが差分と証跡を承認したときだけarchiveする。pushはしない。
