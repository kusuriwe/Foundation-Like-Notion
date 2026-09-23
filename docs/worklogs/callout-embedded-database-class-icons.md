# Callout・Embedded Database・Class Icons Worklog

## Status

Completed and independently approved / 完了・独立レビュー承認済み。

## Goal

Notion callout の構造と外観、記事内 child database の read-only table、Relation 先ページの class icon を、既存の秘密情報・非永続化境界を維持したまま Reader に表示する。

## Result

- Callout は Notion の定義済み色、絵文字、認証済み asset proxy を通す file/custom emoji icon、再帰的な子 block を保持する。深さは 5、記事全体の block 数は 500 を上限とし、超過時は記事取得を安全に失敗させる。
- 記事 block tree で見つけた `child_database` だけを読み取り、Database 内の各 Data Source を独立した表にした。title Property を先頭にし、残りは列名順、最初の 50 行と opaque な追加取得 handle だけを Browser へ返す。
- 追加取得 endpoint は article・table・page size に結び付いた Reader-owned table ID/cursor を検証する。上流 Data Source ID、Property ID、cursor は 30 分の process memory にだけ置き、SQLite、Browser、structured log へ保存しない。
- Relation 先ページの emoji、Notion-hosted file、custom emoji icon を既存の field-grid、compact-emblem、cactus-study header が共通の `ReaderIcon` 経由で表示する。external image と Notion native icon は対象外とした。
- 通常版 client、静的 demo client、公開 DTO、fixture、日英設定ガイドを同じ機能範囲へ更新した。Demo には公開用の架空 callout、子 database、class icon を追加した。

## Validation evidence

2026-09-23 に以下を実施した。

- `git diff --check`: pass。
- `docker compose config --quiet`: pass。
- `docker compose run --rm app npm run check`: pass。初回レビュー修正後の最終実行は API 68 tests、Web 16 tests、Contracts 11 testsを含む。
- `docker compose run --rm app npm run e2e`: Chromium desktop、WebKit mobile の 2 tests pass。
- `docker compose run --rm app npm run e2e:demo`: 3 tests pass。WebKit offline test 1件は既存設定どおり skip。Chromium offline test は callout と child database を含む公開 dummy article の再表示に pass。
- `docker compose run --rm app npm run demo:build`: pass。
- `docker compose run --rm app npm run demo:verify`: pass。公開 artifact の API／Notion／secret 境界検査を通過した。
- `docker compose run --rm app npm run pages:verify`: pass。
- `docker compose run --rm app npm audit`: 0 vulnerabilities。
- 最終 source から production image を再構築した。image build 内の `npm run check` も pass。
- ignored の実設定を用いた production `npm run config:check`: pass。記事本文を取得せず、3 Data Sources・8 mappings の schema を確認した。
- `GET /api/health`: `status=ok`、`source=notion`。
- production structured log の key は `endpoint`、`hostname`、`latencyMs`、`level`、`msg`、`pid`、`reqId`、`requestId`、`status`、`time` のみ。ignored env values と YAML 内 ID 値との一致は 0 件だった。
- production SQLite は既存の `resources(reader_id, source_id, kind, database_reader_id, created_at)` と `sessions(token_hash, expires_at, created_at)` だけだった。保存行はそれぞれ 25、3で、schema追加や本文・Property値用tableはなかった。

## Security and behavior decisions

- 共有されていない child database、schema/query failure、0 Data Source は記事全体を壊さず取得不可の表として返す。再帰深度または記事 block 総数の超過は、部分表示による誤解を避けるため記事取得全体を失敗させる。
- 通常 Property は表示用の有限長 plain text に変換する。file は名前だけ、relation は件数だけを表示し、署名付きURLや関連 page IDは返さない。未対応型は `—` と表示する。
- Notion view の非表示列、filter、sort は再現せず、connection が読める全 Property を表示する。この差異と最小権限の共有方針を設定ガイドへ日英併記した。
- 通常版の `/api/**` no-store／NetworkOnly、静的 demo の公開・offline保存方針、read-only境界は維持した。

## Limitations and follow-up

- 実環境では schema診断とhealthまで確認した。実データに対象 callout、child database、Relation icon が存在するかを探索すると本文・構造へアクセスするため、今回は自動探索せず、feature固有の live visual smoke は未実施とした。fixture、adapter、UI、通常E2E、demo E2Eを受入根拠とする。
- WebKit の offline automation は既存のPlaywright制約によりskipのまま。デモのChromium offline経路は合格している。
- Vite の既存 large-chunk warning と、Zod dependency commentのRollup warningはbuildを妨げず、本変更によるfailureではない。
- production container は最終 image で起動中。ユーザーが対象記事を持つ場合は、独立レビュー後に read-only の短い表示確認を追加できる。

## Independent review remediation

- 最初の独立レビューは未承認となった。Medium finding は、別記事の同じ block index へ遷移した場合に `EmbeddedTableView` の rows/cursor state が再利用され得ることだった。article ID を block keyへ、article IDとtable IDをtable keyへ含めて再mountを保証し、記事切替で前の記事の行が消える回帰testを追加した。
- Low finding は、計画に明記した複数Data Sourceの部分失敗、callout深度、500 block上限、uploaded-file callout iconのtest不足だった。各境界testを追加し、一つの取得不可Data Sourceが同じchild database内の利用可能な表を壊さないことも固定した。
- 修正後に全gateを再実行し、`npm run check`、通常E2E 2件、demo E2E 3件（既知のWebKit offline 1件skip）、demo build/verify、Pages workflow検査、`npm audit`がすべて合格した。

## Next step

2026-09-23 の再レビューで remediation 差分、全体差分、更新済み証跡を確認し、追加 finding なしで承認した。focused review tests は Web 10件、API 36件が合格し、`git diff --check`も合格した。計画は `docs/plans/archive/2026-09-23-callout-embedded-database-class-icons.md` へarchiveした。remoteへのpushは行っていない。実データに対象blockがある場合の短いvisual smokeは、ユーザーが必要に応じて追加できる。
