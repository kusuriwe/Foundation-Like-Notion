# Header renderer guide / 記事header renderer開発ガイド

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

これは新しいheaderレイアウトをコードで追加する開発者向けの手順です。まず[利用者向けデザイン追加ガイド](design-customization.md)で、YAMLだけで目的を達成できるか確認してください。記事headerはYAMLから任意HTMLを読み込まず、bundle済みのtrusted renderer registryだけを使用します。

### 設定だけで変更できる範囲

- `field-grid`: fieldの順番、label、`third` / `half` / `full`幅、通常/強調、icon有無、密度、tone
- `compact-emblem`: 記事icon優先のemblem（emoji、upload、custom emoji、Notion標準iconに対応。未設定時は空の標準マークへfallback）、headline variable、title fallback、metadata fields、任意caption
- `cactus-study`: 記事icon優先の右端seal（未設定時はシリーズ表記へfallback）、headline variable、シリーズ表記、最大3つの分類field、任意caption。欠損fieldは詰めて表示
- 共通: template表示名、記事titleの`header` / `content`配置とalignment

記事に値がないfieldは隙間を残さず省略します。custom headerが存在しないReader variableを参照すると、起動時validationが失敗します。

### 新しいrendererの追加

1. `packages/contracts/src/index.ts`の`ArticleHeaderSchema` discriminated unionへ設定branchを追加します。任意HTML、script、生CSS、外部URLを受け付けないstrict schemaにします。
2. built-inとして提供する場合は、同ファイルの`defaultArticleHeaders`と`packages/contracts/src/presentation-default.ts`のZod非依存fallbackを同じ内容に更新します。
3. `apps/api/src/config.ts`の`headerVariables`で、新rendererが参照するReader variableを起動時検証に含めます。built-inの欠損許容が必要なら、その条件も明示します。
4. `apps/web/src/components/article-headers/`へReact componentとCSS Moduleを追加し、`registry.ts`へ登録します。共通の`HeaderTitle`、`HeaderField`、`ReaderIcon`、ReaderValue formatterを再利用します。記事titleはheaderまたはcontentに一度だけ表示し、rich text・inline数式を保持します。headline欠損時にtitleへfallbackするrendererでは`TemplateHeader.tsx`のtitle配置判定も確認します。
5. `config/reader.example.yaml`と`config/reader.notion.example.yaml`に安全な例を追加します。公開demoは`.env/reader.yaml`から`demo:export`で再生成し、`demo/published/`を直接編集しません。tokenやNotion内部IDはsnapshotへ含めません。
6. contract/config/component testで無効設定、未知variable、field順序、欠損値、title一回表示、数式を確認します。desktop/mobile E2Eでreflow・横はみ出し・reduced motionを確認します。

公開endpoint、Reader Service、Notion adapterにrenderer固有分岐は追加しません。TypeScriptは未登録rendererをregistry型検査で検出します。runtimeの未知template IDはbuilt-in `simple`へ安全にfallbackしますが、設定内の未知template参照はbuild/起動時に拒否されます。

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
docker compose run --rm app npm run e2e:demo
docker compose run --rm app npm run demo:verify
```

<a id="english"></a>

## English

This is the developer checklist for adding a new header layout in code. First read the [user-facing design guide](design-customization.md) to see whether YAML already covers the change. Article headers never load arbitrary HTML from YAML; they use only bundled, trusted renderers in a registry.

### Changes available in YAML

- `field-grid`: field order, labels, `third` / `half` / `full` widths, normal/strong emphasis, icons, density, and tone
- `compact-emblem`: an article-icon-first emblem (supporting emoji, uploads, custom emoji, and native Notion icons; falling back to the default empty mark), headline variable, title fallback, metadata fields, and an optional caption
- `cactus-study`: an article-icon-first right-hand seal (falling back to the series mark), headline variable, series text, up to three classification fields, and an optional caption; missing fields collapse
- All renderers: template name and article-title placement (`header` or `content`) and alignment

A missing value in an article removes that field without leaving a gap. A custom header referencing an undefined Reader variable fails startup validation.

### Add a new renderer

1. Add a strict branch to the `ArticleHeaderSchema` discriminated union in `packages/contracts/src/index.ts`. Do not accept arbitrary HTML, scripts, raw CSS, or external URLs.
2. If it is built in, update both `defaultArticleHeaders` in that file and the Zod-free fallback in `packages/contracts/src/presentation-default.ts` with matching definitions.
3. Include the renderer's Reader variable references in startup validation in `headerVariables` in `apps/api/src/config.ts`. Explicitly define any missing-value exception for a built-in default.
4. Add the React component and CSS Module under `apps/web/src/components/article-headers/`, then register it in `registry.ts`. Reuse `HeaderTitle`, `HeaderField`, `ReaderIcon`, and the ReaderValue formatter. Render the article title exactly once, in the header or content, preserving rich text and inline equations. Check the title-placement logic in `TemplateHeader.tsx` if a missing headline falls back to the title.
5. Add safe examples to `config/reader.example.yaml` and `config/reader.notion.example.yaml`. Regenerate the public demo from `.env/reader.yaml` with `demo:export`; do not hand-edit `demo/published/`. Tokens and Notion-internal IDs must never enter the snapshot.
6. Test invalid configuration, unknown variables, field order, missing values, one-time title rendering, and equations at contract/config/component level. Use desktop/mobile E2E to check reflow, horizontal overflow, and reduced motion.

Do not add renderer-specific branches to public endpoints, Reader Service, or the Notion adapter. TypeScript's registry type catches missing bundled renderers. An unknown runtime template ID falls back safely to built-in `simple`, while unknown template references in Reader or demo configuration fail at startup/build time.

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
docker compose run --rm app npm run e2e:demo
docker compose run --rm app npm run demo:verify
```
