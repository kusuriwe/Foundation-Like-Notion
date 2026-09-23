# Embedded Database Title・Article Header Icon Polish Worklog

## Status

Completed; native Notion icon follow-up awaits authorization / 基本修正完了・Notion標準icon対応は承認待ち。

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
