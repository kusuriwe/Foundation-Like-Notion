# 初回セットアップ・配布手順の簡略化

## Goal

Windows・macOS・Linuxで、ホストにNode.jsを入れず、最小YAMLとDocker内の安全な診断を使って自分のNotion Readerを起動できるようにする。公開ダミーデモの閲覧・配布は別経路として案内する。

## Implementation contract

- READMEを3つの入口に整理し、詳細設定とデモ公開の手順を個別ガイドへ移す。
- 最小Notion設定例を追加し、既存の詳細例・schema・設定との互換性を保つ。
- 本番imageでパスワードhash生成と `config:check` を実行できるようにする。診断はYAML・環境変数・hashを検証し、NotionではData Source schemaだけを読み取り、SQLiteと本文には触れない。
- 診断結果にtoken、Notion ID、Property名、SDKの生エラーを含めない。既存のread-only/API/SQLite境界は変更しない。

## Acceptance and review

- mockで設定・接続・型不一致・秘密値非露出・書込み不在をテストする。
- Compose、check、通常/demo E2E、demo build/verify、Pages workflow、auditを再実行する。
- local `main`でcommitまで進め、独立reviewerが最終差分と証跡を確認してfindingがない場合だけarchiveする。pushと`release` branch作成は行わない。
