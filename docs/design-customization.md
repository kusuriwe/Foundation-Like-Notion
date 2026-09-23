# デザイン追加ガイド / Design customization guide

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

このガイドは、Readerの文言・色・記事headerを変えたい利用者向けです。まずYAMLでできる範囲を試し、まったく新しいレイアウトが必要な場合だけReact/CSSのrendererを追加します。[設定リファレンス](reader-configuration.md)は全fieldの意味、[renderer開発ガイド](header-renderers.md)はコード側の詳細を説明します。

新しく作成した未追跡fileは `apps/web/src/components/article-headers/` 配下で既定でGit ignoreされます。repository同梱の既存headerはすでに追跡されているため、そのまま残ります。schemaや`registry.ts`など既存fileへの変更は通常どおり差分に出ます。新しいheaderをupstreamへ寄稿する場合だけ、licenseを確認したうえで `git add -f` を明示的に使ってください。ignoreは著作権やlicenseを付与するものではありません。

### LLMを使う場合のクイックガイド

LLMにデザイン作業を依頼する場合は、リポジトリの作業コピーと、公開可能な参考画像・プロトタイプだけを渡してください。`.env/reader.yaml`、`.env/reader.env`、Notion token・ID、実記事本文、ログイン情報は貼らないでください。実データに合わせたfield名が必要なら、架空の名前へ置き換えた対応表を使います。

依頼文の例:

```text
このリポジトリのAGENTS.md、docs/design-customization.md、
docs/header-renderers.mdを読んでください。
公開ダミーデータだけを使い、[参考画像または公開プロトタイプ]に近い
記事headerを[既存headerの調整 / 新しいtrusted rendererの追加]として実装してください。
表示するReader variableは[架空のvariable名と型]です。
任意HTML/JS/CSSをYAMLから実行しないでください。
.env/と実Notionの内容には触れず、remoteへpushしないでください。
desktop/mobile、欠損field、記事titleと数式、reduced motionを確認し、
変更ファイル・実行したテスト・未確認点を報告してください。
```

まずlocal previewで見た目を確認し、その後に公開demo snapshotを更新します。未公開の記事やIDを含むスクリーンショットは共有しないでください。

### どこまでYAMLだけで変えられるか

| 変更したいこと | 編集場所 | 再build |
| --- | --- | --- |
| ブランド名、画面文言、theme色 | `.env/reader.yaml`の`presentation` | 通常版は再起動。デモは再export・build |
| headerの選択、field・label・順番、既存rendererの設定 | `.env/reader.yaml`の`templates`と`articleHeaders` | 通常版は再起動。デモは再export・build |
| 新しいheaderの構造・アニメーション | trusted React componentとCSS Module | 必要 |

`variables`はNotion PropertyをReader値へ変換する設定、`articleHeaders`はその値の見せ方です。headerが参照するvariableは、そのdatabaseの`variables`に定義します。組み込みheaderの既定fieldだけは、最小設定でも起動できるよう欠損を許容します。未知のcustom variable参照やschema外の設定は起動時に拒否されます。

例えば既存のカクタス風headerを選ぶには、対象databaseの`templates`に`cactus-study`を追加します。`defaultTemplate`も変えたい場合は、同じIDを指定してください。既存の`.env/reader.yaml`は自動変更されません。

```yaml
contentDatabases:
  - id: my-notes
    # 他のdatabase設定は省略
    defaultTemplate: simple
    templates: [simple, compact-emblem, cactus-study]
```

`presentation`は省略可能です。次は表示設定の抜粋です。通常版・公開demoとも`.env/reader.yaml`を元にし、公開demoは[デモ配布ガイド](demo-publishing.md)の安全なexportで静的snapshotへ変換します。既存の`presentation`がある場合は同じセクションへ追記し、重複した`presentation:`を作らないでください。

```yaml
presentation:
  version: 1
  brand:
    name: My Reader
  theme:
    colors:
      accent: "#D8FF5F"
  messages:
    navHome: Home
  articleHeaders:
    cactus-study:
      name: Cactus Study
      renderer: cactus-study
      title: { placement: content, alignment: center }
      headlineVariable: codeName
      headlineLabel: Code name
      seriesMark: "Ⅶ"
      seriesLabel: Reference file
      caption: Classification record
      fields:
        - { variable: mainClass, label: Main-class }
        - { variable: subClass, label: Sub-class }
        - { variable: tags, label: Tag, showIcon: false }
```

この例の`codeName`、`mainClass`、`subClass`、`tags`は、使うdatabaseにmappingがある場合に指定してください。設定例全体は`config/reader.notion.example.yaml`を参照します。`title.placement`は`header`か`content`で、記事titleはrich text・inline数式を保って必ず一度だけ表示されます。記事で値が欠けたfieldは詰めて省略されます。

Relation型のfieldで`showIcon: true`にすると、Relation先ページの絵文字・Notion-hosted画像・カスタム絵文字を表示できます。画像URLやNotion IDをYAMLへ書く必要はありません。Relation先Data Sourceは`relationSources`で許可し、read-only connectionへ共有します。

`compact-emblem`の大きなemblemと`cactus-study`の右端のsealは、記事ページ自身のiconを優先して表示します。emoji、アップロード画像、custom emoji、Notion標準iconに対応します。標準iconはbackendがNotion公式asset endpointから取得し、認証済みasset proxyで配信するため、Browserへicon metadataやNotion IDは公開されません。記事iconがない場合、emblemは空の標準マーク、sealは`seriesMark`へフォールバックします。クラスのRelation iconは各fieldにも引き続き表示されます。

### 新しいデザインを追加する場合

新しい見た目はYAML内のHTMLではなく、同梱されたtrusted rendererとして実装します。作業の流れは次のとおりです。

1. 参考画像、desktop/mobileの配置、使うReader variable、欠損時の表示、titleの位置を決めます。実NotionのIDや本文は設計資料に含めません。
2. [renderer開発ガイド](header-renderers.md)に従い、schema、component、CSS Module、registry、default定義、設定例とテストを追加します。
3. ignored `.env/reader.yaml`へtemplate IDと必要なvariable mappingを設定し、`config:check`後に通常版を再起動します。
4. 公開demoへ反映する場合は`demo:export`で候補を検証してから`--apply`します。`demo/published/`を直接編集しません。demoは公開・offline保存されるため、公開権利のない本文や画像を含めないでください。

確認コマンド:

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
docker compose run --rm app npm run e2e:demo
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
```

通常版のNotionアクセスはbackend内の読み取り専用のままです。header変更のためにBrowserからNotion APIを呼んだり、実記事をService Workerへ保存したりしないでください。デザインの微調整は上の範囲なら直接実装できますが、新しい設定fieldや公開APIの意味を変える場合は先に設計を確認してください。

<a id="english"></a>

## English

This guide is for readers who want to change copy, colors, or article headers. Try the YAML options first; add a React/CSS renderer only when you need a genuinely new layout. The [configuration reference](reader-configuration.md) defines the fields, and the [renderer development guide](header-renderers.md) covers code changes.

New untracked files under `apps/web/src/components/article-headers/` are ignored by Git by default. Existing bundled headers remain tracked because they are already in the repository. Changes to tracked files such as the schema or `registry.ts` still appear normally. Use an explicit `git add -f` only when intentionally contributing a new header upstream, after checking its license. Ignoring a file does not grant or change copyright or license rights.

### Quick guide for working with an LLM

Give the LLM a working copy of the repository and only public reference images or prototypes. Do not paste `.env/reader.yaml`, `.env/reader.env`, Notion tokens or IDs, real article text, or login details. If it needs field names, supply a fictional mapping instead.

Example request:

```text
Read AGENTS.md, docs/design-customization.md, and docs/header-renderers.md.
Using public dummy data only, implement an article header inspired by
[public reference image or prototype] as [an adjustment to an existing header /
a new trusted renderer]. The Reader variables are [fictional names and types].
Do not execute arbitrary HTML/JS/CSS from YAML. Do not inspect .env/ or real
Notion content, and do not push to a remote. Check desktop/mobile layout,
missing fields, the article title and equations, and reduced motion.
Report changed files, tests run, and anything not verified.
```

Preview the design locally before updating the public demo snapshot. Do not share screenshots containing unpublished article text or identifiers.

### What YAML can change

| Goal | Edit | Rebuild |
| --- | --- | --- |
| Brand, screen copy, and theme colors | `presentation` in `.env/reader.yaml` | Restart the normal app; export and rebuild the demo |
| Header choice, fields, labels, order, and existing renderer options | `templates` and `articleHeaders` in `.env/reader.yaml` | Restart the normal app; export and rebuild the demo |
| A new header layout or animation | A trusted React component and CSS Module | Required |

`variables` maps Notion Properties to Reader values; `articleHeaders` controls how those values appear. A header's custom variable references must exist in that database's `variables`. Built-in default fields tolerate missing values so the minimal config still starts. Unknown custom references or unsupported settings fail validation at startup.

To make the existing Cactus Study header selectable, add `cactus-study` to the database's `templates`. Set the same ID as `defaultTemplate` if you want it selected first. The app will not edit your ignored `.env/reader.yaml` for you.

```yaml
contentDatabases:
  - id: my-notes
    # Other database settings omitted
    defaultTemplate: simple
    templates: [simple, compact-emblem, cactus-study]
```

The optional `presentation` section can adjust the design. Both the normal app and public demo originate from `.env/reader.yaml`; the [demo publishing guide](demo-publishing.md) converts it into a safe static snapshot. If `presentation` already exists, add entries to it rather than creating a second section. This is a partial example:

```yaml
presentation:
  version: 1
  brand:
    name: My Reader
  theme:
    colors:
      accent: "#D8FF5F"
  messages:
    navHome: Home
  articleHeaders:
    cactus-study:
      name: Cactus Study
      renderer: cactus-study
      title: { placement: content, alignment: center }
      headlineVariable: codeName
      headlineLabel: Code name
      seriesMark: "Ⅶ"
      seriesLabel: Reference file
      caption: Classification record
      fields:
        - { variable: mainClass, label: Main-class }
        - { variable: subClass, label: Sub-class }
        - { variable: tags, label: Tag, showIcon: false }
```

Map `codeName`, `mainClass`, `subClass`, and `tags` in the database before using this customized definition. For a full example, see `config/reader.notion.example.yaml`. `title.placement` is `header` or `content`; the rich-text article title, including inline equations, appears exactly once. Fields with missing article values collapse without leaving gaps.

Set `showIcon: true` on a relation-backed field to display the related page's emoji, Notion-hosted image, or custom emoji. Do not put image URLs or Notion IDs in presentation settings. Allow the target Data Source through `relationSources` and share it with the read-only connection.

The large `compact-emblem` emblem and the right-hand `cactus-study` seal prefer the article page's own icon. Emoji, uploaded images, custom emoji, and native Notion icons are supported. The backend retrieves native icons from Notion's official asset endpoint and serves them through the authenticated asset proxy, so icon metadata and Notion IDs are not exposed to the browser. Without an article icon, the emblem falls back to the default empty mark and the seal falls back to `seriesMark`. Relation-backed class icons continue to appear in their individual fields.

### Adding a new design

New layouts are bundled as trusted renderers, not loaded as HTML from YAML.

1. Specify the reference, desktop/mobile layout, Reader variables, missing-value behavior, and title placement. Keep real Notion IDs and article text out of the design brief.
2. Follow the [renderer development guide](header-renderers.md) to add the schema, component, CSS Module, registry entry, defaults, example config, and tests.
3. Add the template ID and needed variable mappings to ignored `.env/reader.yaml`, run `config:check`, and restart the normal Reader.
4. To update the public demo, validate a `demo:export` candidate and apply it with `--apply`. Do not hand-edit `demo/published/`. The demo is public and cached offline, so include only text and images that may be published.

Validation commands:

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
docker compose run --rm app npm run e2e:demo
docker compose run --rm app npm run demo:build
docker compose run --rm app npm run demo:verify
```

The normal reader must keep Notion access read-only and behind the backend. Do not call Notion directly from the browser or cache real article content in the Service Worker to implement a header. Small visual changes within these boundaries can be implemented directly; plan first if a new setting or public API would change behavior.
