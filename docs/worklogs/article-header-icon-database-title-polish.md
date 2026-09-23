# Embedded Database Title・Article Header Icon Polish Worklog

## Status

Completed; native Notion icon follow-up implemented / 基本修正およびNotion標準icon対応完了。

## Goal

単一Data Sourceの埋め込みデータベース名を重複表示せず、Compact Emblemの主emblemとCactus Studyの右端sealへ記事ページ自身のiconを表示する。Relation由来のclass iconと複数Data Sourceの識別表示は維持する。

## Decisions

- 子データベース全体のtitleは常に一度表示する。Data Source個別titleは複数Data Sourceがある場合だけ表示する。
- Compact Emblemは記事iconを優先し、未設定時はclass iconではなく空の標準マークへフォールバックする。
- Cactus Studyの右端sealは記事iconを優先し、未設定時だけ`seriesMark`へフォールバックする。上段のseries textと各class field iconは変更しない。

## Evidence

- `ArticleRenderer` component testで、単一Data Sourceの子データベースtitleが1回だけ表示されることを確認した。
- `TemplateHeader` component testでは記事iconとclass iconに別の値を使い、Compact Emblemの主emblemとCactus Studyの右端sealが記事iconを表示し、class fieldはRelation iconを維持することを確認した。
- `docker compose config --quiet`: pass。
- `docker compose run --rm app npm run check`: pass。API 68 tests、Web 16 tests、Contracts 11 testsを含む。
- `docker compose run --rm app npm run e2e`: Chromium desktop／WebKit mobileの2件pass。
- 初回のdemo E2Eは、旧仕様の単一Data Source見出しを期待していた3件が失敗した。期待値を子データベースtitleが1回表示される新仕様へ更新した。
- 更新後の`docker compose run --rm app npm run e2e:demo`: 3件pass、既存のWebKit offline 1件skip。
- `docker compose run --rm app npm run demo:verify`: pass。
- `docker compose run --rm app npm audit`: 0 vulnerabilities。
- 最終sourceからproduction imageを再構築し、`GET /api/health`が`status=ok`、`source=notion`を返すことを確認した。

## Changed files

- `apps/web/src/components/ArticleRenderer.tsx`とtest
- `apps/web/src/components/article-headers/CompactEmblemHeader.tsx`
- `apps/web/src/components/article-headers/CactusStudyHeader.tsx`とCSS Module
- `apps/web/src/components/TemplateHeader.test.tsx`
- `e2e-demo/demo.spec.ts`
- `docs/design-customization.md`、`docs/header-renderers.md`

## Limitations

- 実Notion記事の見た目は自動操作していない。production containerは最終imageで起動中のため、既存記事での短いvisual smokeはユーザーがそのまま実施できる。

## Follow-up diagnosis

- ユーザーのvisual smokeで記事iconが表示されなかったため、値・ID・本文を出さず実Notionのicon type件数だけをread-only診断した。対象Data SourcesにはNotion標準iconの`type: "icon"`が1件、iconなしが10件あり、既存adapterが標準iconを未対応として省略していたことを確認した。
- API `2026-03-11`の標準iconは画像URLではなくnameとcolorを返す。正確な図柄を表示するにはNotion asset endpointへそのname/colorを送ってSVGを取得し、認証済みReader asset proxyで配信する追加境界が必要になる。外部送信のユーザー承認を得てから実装する。
- 追加要望に合わせ、Compact Emblemは記事iconがない場合にclass iconを流用せず空の標準マークを表示するよう変更した。Web component tests 17件がpassした。

## Native Notion icon follow-up / Notion標準アイコン追補

- The user explicitly approved sending native icon `name` and `color` metadata to Notion's official asset endpoint. The browser still receives only an opaque Reader asset ID.
- ユーザーは標準アイコンの `name` と `color` をNotion公式asset endpointへ送信することを明示的に承認した。Browserへ返す値は従来どおり不透明なReader asset IDだけである。
- A read-only live probe confirmed that an image `Accept` header and a product-specific `User-Agent` change the official endpoint response from 403 to `200 image/svg+xml`. No icon name, color, Notion ID, token, or content was printed.
- 読み取り専用の実環境診断では、画像用 `Accept` と製品固有 `User-Agent` により公式endpointの応答が403から `200 image/svg+xml` になることを確認した。アイコン名・色・Notion ID・token・本文は出力していない。
- The adapter validates the icon name and color against fixed formats, constructs only the fixed `https://www.notion.so/icons/` URL, and marks it with an internal fetch profile. The authenticated `/api/assets/*` route applies the required headers and retains `Cache-Control: no-store`.
- Adapterはアイコン名と色を固定形式で検証し、固定された `https://www.notion.so/icons/` URLだけを生成して内部fetch profileを付ける。認証必須の `/api/assets/*` が必要なheaderを追加し、`Cache-Control: no-store`を維持する。
- Malformed metadata fails closed. Icon metadata is not returned in article DTOs or persisted separately; the existing opaque page-icon asset mapping remains the only SQLite mapping.
- 不正なmetadataはfail closedで拒否する。icon metadataは記事DTOへ返さず個別保存もしない。SQLiteには既存の不透明なpage-icon asset mappingだけが残る。
- `docker compose run --rm app npm run check`: pass after the follow-up (API 71, Web 17, Contracts 11 tests). `docker compose config --quiet` and `git diff --check` also passed.
- 追補後の `docker compose run --rm app npm run check` はpass（API 71、Web 17、Contracts 11 tests）。`docker compose config --quiet` と `git diff --check` もpassした。
- The production image was rebuilt from the final source. `GET /api/health` returned `status=ok` and `source=notion`; the container remained bound only to `127.0.0.1:3000`. Its structured log contained only startup and health request metadata, with no icon metadata, Notion IDs, token, or content.
- 最終sourceからproduction imageを再構築した。`GET /api/health` は `status=ok`、`source=notion` を返し、containerは `127.0.0.1:3000` のみにbindされている。構造化logは起動情報とhealth request metadataだけで、icon metadata、Notion ID、token、本文を含まなかった。
- `docker compose run --rm app npm run e2e`: Chromium desktop and WebKit mobile both passed. `docker compose run --rm app npm audit`: 0 vulnerabilities.
- `docker compose run --rm app npm run e2e`: Chromium desktopとWebKit mobileがともにpass。`docker compose run --rm app npm audit`: 0 vulnerabilities。
