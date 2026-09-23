# コールアウト・記事内データベース・クラスアイコン対応計画

## Summary

- コールアウトの子ブロック、アイコン、背景色を正しく表示する。
- 記事内で作成した子データベースを read-only の表として表示し、50 行ずつ追加取得する。
- Relation 先ページの絵文字・アップロード画像・カスタム絵文字を記事ヘッダーへ反映する。

## Implementation

- `callout` block に色と再帰的な子 block を追加し、取得深度と総数を制限する。
- 記事内の `child_database` から Data Source と全 Property を読み、opaque table token と Reader cursor だけを Browser へ返す。
- 認証必須の embedded-table pagination endpoint を追加し、上流 ID と cursor は 30 分だけ memory に保持する。
- 通常版・静的 demo・日英ドキュメントを同じ contract に更新する。

## Acceptance

- Adapter、contract、service、API、UI、demo の正常系と拒否系を自動テストする。
- 全 gate と可能なら read-only live smoke を実施し、結果を worklog に記録する。
- 独立 reviewer の承認後だけ archive する。remote へ push しない。
