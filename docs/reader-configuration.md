# Reader YAML・表示設定リファレンス / Reader YAML and presentation reference

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

以下のコマンドと`config/`・`.env/`のパスはリポジトリのルートを基準にしています。最小構成で始める場合は先に[初回セットアップ](setup.md)を参照してください。

### Reader YAMLの基本

アプリが読む実設定は `.env/reader.yaml` です。`config/reader.notion.example.yaml` を雛形として使い、
Notion の Data Source は ID で指定し、Property は `propertyId` または `propertyName` のどちらか一方で
指定します。タイトルでは `titlePropertyId` または `titlePropertyName` を使います。名前指定は選択済み
Data Source 内で大文字・小文字を区別して完全一致させ、起動時に一度だけ ID へ解決します。ID と名前は
mapping ごとに混在できますが、同じ mapping へ両方を指定することはできません。

解決結果はメモリ内だけで使われ、YAML や SQLite は変更されません。Property の rename、一致なし、
複数一致、Notion type の不一致、schema 取得失敗がある場合は安全のため起動を中止します。Property 名や
ID は Browser、通常ログ、SQLite へ出しません。`source: fixture` では Property ID だけを使用します。

名前を ID へ固定したい場合だけ、任意で次の migration command を実行できます。

```powershell
docker compose run --rm app npm run config:resolve
```

resolver は各 `contentDatabases[]` の選択済み Data Source 内だけを検索します。同名 Property が別の
Data Source にあっても衝突しません。全 mapping の Notion type が設定と互換である場合に限り、
`propertyName` を `propertyId` へ一括置換します。以前の手順で Property 名を `propertyId` に仮入力した
設定も、この migration command に限り互換入力として扱います。

書換前の設定は `.env/reader.yaml.bak` に保存されます。不一致が1件でもあれば YAML は変更されません。
標準出力には Reader field path、型、件数だけを表示し、Property 名、Property ID、Data Source ID、token
は表示しません。`sourceDataSourceId` と `relationSources` は対象 Data Source を選ぶ境界なので、この
resolver の対象外です。これらには Data Source ID を設定してください。

#### 最上位field

| Field | 値 | 説明 |
| --- | --- | --- |
| `version` | `1` | 設定 schema の version。現在は `1` のみです。 |
| `source` | `fixture` / `notion` | 実データでは `notion` を指定します。 |
| `contentDatabases` | list | Library、記事一覧、検索で公開する Data Source の定義です。1件以上必要です。 |
| `relationSources` | Data Source ID の list | Relation の title/icon 解決だけを許可する参照先です。Library には公開されません。未使用なら `[]` にします。 |

`relationSources` には `mainClass` や `subClass` が参照する Data Source ID を指定します。参照先の
Data Source/Page は Notion Internal Connection にも共有されている必要があります。content source は
自動的に許可対象となるため、同じ ID を `relationSources` へ重ねて書く必要はありません。

#### `contentDatabases`

```yaml
contentDatabases:
  - id: chemistry-notes
    name: Chemistry Notes
    sourceDataSourceId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    titlePropertyName: "Name"
    defaultTemplate: compact-emblem
    templates: [simple, compact-emblem]
    sort:
      - field: created_time
        direction: ascending
    variables: {}
    filters: {}
```

| Field | 説明 |
| --- | --- |
| `id` | Browser/API に見せる Reader 固有 ID。Notion ID は使わず、8～128文字の一意な slug にします。 |
| `name` | Library に表示する名前です。 |
| `sourceDataSourceId` | 記事を取得する Notion Data Source ID。同じ ID を複数定義できません。 |
| `titlePropertyId` / `titlePropertyName` | Notion の `title` Property を ID または完全一致する名前で指定します。どちらか一方が必須です。 |
| `defaultTemplate` | 初期 template。必ず `templates` にも含めます。 |
| `templates` | 許可する同梱 header ID。`simple`、`compact-emblem`、`cactus-study` を選べます。`presentation.articleHeaders` に追加した ID も指定できます。 |
| `sort` | Notion query に渡す既定 sort。1件以上必要です。 |
| `variables` | Template が参照できる Reader variable の allowlist です。 |
| `filters` | Browser から指定可能な検索 filter の allowlist です。 |

`sort[].field` は `created_time`、`last_edited_time`、または `variables` / `filters` に定義した Reader
field 名です。Notion Property ID を直接書きません。`direction` は `ascending` または `descending`
です。複数指定時は記載順で Notion query に渡されます。

#### `variables` と `type`

`variables` の key は Reader 内の名前です。組み込み template は `mainClass`、`subClass`、
`codeName` を参照します。`cactus-study` はさらに任意の `tags` を表示できます。`type` は Notion の Property type そのものではなく、Notion value を安全な
Reader value へ正規化した後の型です。

```yaml
variables:
  codeName:
    propertyName: "Code name"
    type: string
    required: true
    fallback: Untitled
  mainClass:
    propertyName: "Main class"
    type: reference
    required: true
  tags:
    propertyName: "Tags"
    type: string[]
```

| Reader `type` | 対応する Notion Property | Reader 側の値 |
| --- | --- | --- |
| `string` | `title`, `rich_text`, `select`, `status` | 文字列。rich text は plain text に結合されます。 |
| `string[]` | `multi_select` | 選択肢名の配列です。 |
| `number` | `number` | 有限の数値です。 |
| `boolean` | `checkbox` | `true` / `false` です。 |
| `date` | `date` | `start` と、存在する場合は `end` / `timeZone` を持つ日付値です。 |
| `reference` | `relation` | 解決済み title、Reader ID、任意の icon を持つ単一参照です。 |
| `reference[]` | `relation` | 同じ形式の参照配列です。0件も許容します。 |

`reference` は relation がちょうど1件の用途です。0件なら variable は省略され、2件以上なら
cardinality 不一致の Mapping Error になります。複数件が正しい Property には `reference[]` を使って
ください。許可されていない relation source や connection に共有されていない参照先は解決されません。

`url`、`email`、`phone_number`、`people`、`files`、`formula`、`rollup` などは v1 の variable mapping
対象外です。これらを上表の型へ暗黙変換しません。

各 variable field の意味は次のとおりです。

| Field | 説明 |
| --- | --- |
| `propertyId` / `propertyName` | Notion Property を ID または完全一致する名前で指定します。どちらか一方だけを設定します。 |
| `type` | 上表の Reader type。Notion Property と対応させます。 |
| `required` | 省略時は `false`。v1 では template の契約意図を示す metadata で、欠損だけを理由に記事取得を拒否しません。 |
| `fallback` | Property が空または取得できないときの代替文字列。`type: string` でのみ使用できます。 |

値が欠け、`fallback` もない variable は API response と画面から省略されます。`required: true` でも、
現行 v1 では欠損を起動時・表示時 error にはしません。一方、取得できた値と設定した `type` が異なる
場合は Mapping Error とし、暗黙変換しません。

#### `filters`

`filters` の key は Browser/API が使う Reader field ID です。Notion Property ID や任意の endpoint を
Browser から指定させないための allowlist になります。

```yaml
filters:
  tags:
    propertyName: "Tags"
    type: string[]
    sourceType: multi_select
    operators: [contains, isEmpty]
  mainClass:
    propertyName: "Main class"
    type: reference
    sourceType: relation
    operators: [equals, isEmpty]
```

- `type` は上表の Reader type です。同じ Property を `variables` にも定義する場合は同じ型にします。
- `sourceType` は実際の Notion Property type です。
- `operators` は Browser に許可する操作だけを列挙します。`isEmpty` は検索値を必要としません。
- Relation filter の検索値には Browser が保持する Reader ID を使い、backend が Notion ID に解決します。

| `sourceType` | Reader `type` | 許可可能な operator | `value` |
| --- | --- | --- | --- |
| `title`, `rich_text` | `string` | `equals`, `contains`, `isEmpty` | 空でない string |
| `select`, `status` | `string` | `equals`, `isEmpty` | 空でない string |
| `multi_select` | `string[]` | `contains`, `isEmpty` | 選択肢を表す空でない string |
| `checkbox` | `boolean` | `equals` | boolean |
| `number` | `number` | `equals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `isEmpty` | finite number |
| `date` | `date` | `equals`, `before`, `after`, `isEmpty` | ISO date または offset 付き ISO datetime |
| `relation` | `reference` / `reference[]` | `equals`, `contains`, `isEmpty` | 既知の page 用 Reader ID |

`isEmpty` では `value` 自体を送信しません。それ以外の operator では表に示した型の `value` が必須です。
YAML の `type` と `sourceType`、request の operator と値が一致しない場合は、Notion へ問い合わせる前に
Reader が request を拒否します。

#### 数式

Notion の equation block は display 数式として、rich text 内の inline equation は文中数式として KaTeX で
描画します。本文の段落、見出し、引用、callout、list、table、caption と、記事詳細画面の主タイトルが
対象です。一覧・検索のタイトルと template metadata は plain text のままです。

化学式では `mhchem` の `\ce{...}` を使用できます。解釈できない TeX は実行せず元の式を text-only で
表示します。KaTeX の HTML/MathML と font はアプリ自身から配信されますが、記事 API response は従来どおり
Service Worker に保存されません。PWA 更新中の旧画面にはinline equationが一時的にTeX文字列として表示され、
新しい画面へ切り替わった後にKaTeX表示となります。

#### ページネーションcursor

記事一覧と検索の `nextCursor` は `cur_` で始まる Reader 固有の random handle です。Notion の cursor は
Browser へ返さず、最大30分間、最大1,024件だけ server process のメモリに保持します。cursor は発行元の
endpoint、Reader database、検索条件、page size に結び付けられます。改変、別条件での再利用、期限切れ、
server 再起動前に発行された cursor は400 `invalid_request`になります。cursorはSQLiteへ保存されません。

#### コールアウト・記事内データベース・Relationアイコン

- コールアウトは本文、入れ子の対応済みblock、Notionの背景色を表示します。絵文字、Notionへアップロードした画像、workspaceのカスタム絵文字をiconとして利用できます。深さ5階層または記事全体500 blockを超える内容は、安全のため記事取得エラーになります。
- 記事ページ内で直接作成した子データベースはread-only tableとして自動表示されます。最初の50行を表示し、「続きを表示」で50行ずつ取得します。linked database viewは対象外です。
- 子データベースでは、接続から読めるすべてのPropertyを表示します。Notion viewの非表示列、filter、sortは再現しないため、Readerに出したくないPropertyを含む子データベースを接続範囲へ置かないでください。未対応型は`—`、Relationは件数で表示し、行からNotionページへは遷移しません。
- 子データベース自身もread-only connectionから読める必要があります。取得できない場合は記事全体を壊さず、その表だけ取得不可と表示します。表tokenとcursorはmemory内で30分だけ有効で、再起動後や期限切れでは記事を再読み込みしてください。
- `reference` / `reference[]` のiconはRelation先ページから取得します。現時点では絵文字、Notion-hosted画像、カスタム絵文字に対応し、記事headerで`showIcon: true`または`emblemVariable`に指定したfieldへ表示します。Relation先Data Sourceを`relationSources`へ追加し、同じread-only connectionへ共有してください。

#### Notion設定の全体例

全fieldを組み合わせた例は`config/reader.notion.example.yaml`にあります。実IDを入力した後は、先に本番imageのread-only診断でYAML・hash・Data Source schema・Property対応を確認します。

```sh
docker compose --profile production run --rm production npm run config:check
```

個別記事・relation先ページの閲覧可否までは検査しません。起動後のhealthと記事表示は[初回セットアップ](setup.md)に従って確認してください。エラーになっても`.env/reader.yaml`、Notion ID、tokenの内容はissueやチャットへ貼らず、診断のcategoryと安全なpathだけを使ってください。

### 表示設定のカスタマイズ

`reader.yaml` の任意の `presentation` セクションで、通常版と静的demo版に共通する表示を変更できます。省略時も既存の文言・配色と`simple` / `compact-emblem`のtemplate IDを維持します。新しい`cactus-study`は、databaseの`templates`へ明示的に追加した場合だけ選択肢に出ます。

```yaml
presentation:
  version: 1
  locale: ja-JP
  brand:
    name: My Reader
    shortName: Reader
    eyebrow: Personal reference
    tagline: Notes, shaped for reading.
  theme:
    colorScheme: dark
    colors:
      background: "#0B0D10"
      panel: "#11151B"
      panelAlt: "#171C24"
      line: "#2A313C"
      text: "#EDF2F7"
      muted: "#98A2B3"
      accent: "#D8FF5F"
      accentSecondary: "#7CECFF"
      danger: "#FF7A90"
  messages:
    navHome: Home
    navSearch: Search
    navLogout: Logout
    templateLabel: Template
  articleHeaders:
    reading-grid:
      name: Reading Grid
      renderer: field-grid
      title: { placement: header, alignment: start }
      tone: accent
      density: comfortable
      fields:
        - { variable: mainClass, label: Domain, width: half, showIcon: true }
        - { variable: subClass, label: Topic, width: half, showIcon: true }
        - { variable: codeName, label: Code name, width: full, emphasis: strong }
```

- `brand` は画面、document title、Web App Manifestへ反映されます。
- `locale` は有効な言語タグ（例: `ja-JP`、`en-US`）を指定します。不正な値は起動時またはdemo build時に拒否します。`colorScheme: light` だけでもlight用の既定配色が適用され、`colors` で個別に上書きできます。
- 色は `#RRGGBB` のみです。HTML、JavaScript、CSS、外部font/stylesheet URLは指定できません。
- `messages` はschemaで許可されたplain textだけを上書きします。API error本文は変更できません。
- template IDは小文字英数字とhyphenだけで最大64文字です。`contentDatabases[].templates` と `defaultTemplate` は `articleHeaders` の定義を参照します。
- `field-grid` の `width` は `third` / `half` / `full`、`emphasis` は `normal` / `strong` です。値がない記事ではfield自体を表示しません。
- `compact-emblem` は `emblemVariable`、`headlineVariable`、任意の `headlineLabel`、metadata `fields`、任意の`caption`を持ちます。`headlineVariable`が空なら記事titleへfallbackします。プロトタイプに合わせた額縁付きiconと中央配置の分類を表示し、旧設定のままでも動きます。
- `cactus-study` は明るい分類バーです。`headlineVariable`、`headlineLabel`、`seriesMark`、`seriesLabel`、任意の`caption`と、表示順に最大3つの`fields`を設定します。最初の表示可能なfieldが大枠、残りが小枠に詰められます。`headlineVariable`が空ならrich text/数式付き記事titleをheaderへ一度だけ表示します。
- `title.placement` は `header` または `content` です。rich textとinline equationを保ったtitleを必ず一度だけ表示します。
- custom headerが参照する `variable` は、そのdatabaseの `variables` に存在する必要があります。誤字は起動時に拒否されます。

デザイン変更の入口は[デザイン追加ガイド](design-customization.md)です。新しいtrusted rendererをコードとして追加する場合は [Header renderer guide](header-renderers.md) を参照してください。

既存の`.env/reader.yaml`でカクタス風を試すだけなら、対象databaseの`templates`へ`cactus-study`を追加します。組み込み定義は`codeName`、`mainClass`、`subClass`、`tags`を参照し、記事で欠けた値は省略します。labelやシリーズ表記を変える場合は`presentation.articleHeaders.cactus-study`を上書きしてください。完全な設定例は`config/reader.notion.example.yaml`にあります。実設定やNotion IDはGitへ追加しないでください。

### 設定境界

- `contentDatabases`: Reader の library/search/article として公開可能な Data Source
- `relationSources`: Relation の title/icon 解決にだけ利用可能な Data Source
- `variables`: Template variable と Notion Property ID の mapping
- `filters`: Browser が Reader field ID として指定できる filter の allowlist

実データ、token、password、session、SQLite DB は commit しません。

<a id="english"></a>

## English

Commands and paths in this reference are relative to the repository root. For the smallest working configuration, start with the [first-time setup guide](setup.md). For design-only changes, use the [design customization guide](design-customization.md).

### Reader YAML and Property identifiers

The app reads its real configuration from ignored `.env/reader.yaml`. Use `config/reader.notion.example.yaml` as a fuller template. A Notion Data Source is specified by ID. For each Property mapping, choose exactly one of `propertyId` or `propertyName`; for the title, choose exactly one of `titlePropertyId` or `titlePropertyName`. You may mix ID-based and name-based mappings in one file, but not within one mapping.

A name must match exactly, including case, within its selected Data Source. At startup, the app resolves names to IDs once and keeps the result in memory; it does not rewrite YAML or SQLite. A renamed, missing, duplicated, or wrong-type Property, or an unavailable schema, stops startup. Property names and IDs are not returned to the browser or written to ordinary logs or SQLite. `source: fixture` requires Property IDs.

If you intentionally want to pin names to IDs, you may run this migration command:

```sh
docker compose run --rm app npm run config:resolve
```

It searches only within each configured content Data Source. The same name in another Data Source does not collide. It replaces `propertyName` with `propertyId` only if every mapping has a compatible Notion type. Older configurations that put a Property name temporarily in `propertyId` are accepted only by this migration command. Before changing YAML, it saves `.env/reader.yaml.bak`; any mismatch leaves YAML unchanged. Standard output contains Reader field paths, types, and counts, not Property names/IDs, Data Source IDs, or tokens. `sourceDataSourceId` and `relationSources` select the allowed Data Sources and must still contain Data Source IDs.

### Top-level fields

| Field | Value | Meaning |
| --- | --- | --- |
| `version` | `1` | Configuration schema version; only `1` is supported. |
| `source` | `fixture` / `notion` | Use `notion` for your own data. |
| `contentDatabases` | List | Data Sources exposed as libraries, article lists, and search; at least one is required. |
| `relationSources` | List of Data Source IDs | Sources used only for relation title/icon resolution, not exposed as libraries. Use `[]` when unused. |

List the Data Source IDs referenced by `mainClass` or `subClass` in `relationSources`. Share the target Data Sources/pages with the same read-only Notion connection. Content Data Sources are already allowed; do not duplicate them in `relationSources`.

### `contentDatabases`

```yaml
contentDatabases:
  - id: chemistry-notes
    name: Chemistry Notes
    sourceDataSourceId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    titlePropertyName: "Name"
    defaultTemplate: compact-emblem
    templates: [simple, compact-emblem]
    sort:
      - field: created_time
        direction: ascending
    variables: {}
    filters: {}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique Reader-owned slug of 8–128 characters exposed through the Reader API; never use a Notion ID. |
| `name` | Name shown in the library. |
| `sourceDataSourceId` | Notion Data Source ID for articles; it must be unique among content databases. |
| `titlePropertyId` / `titlePropertyName` | ID or exact name of the Notion `title` Property; specify one. |
| `defaultTemplate` | Initial template; it must also appear in `templates`. |
| `templates` | Allowed bundled headers: `simple`, `compact-emblem`, `cactus-study`, or IDs added to `presentation.articleHeaders`. |
| `sort` | Default Notion query sort; at least one entry. |
| `variables` | Allowlist of Reader variables available to templates. |
| `filters` | Allowlist of search filters the browser may request. |

Each `sort[].field` is `created_time`, `last_edited_time`, or a Reader field defined in `variables`/`filters`, never a browser-supplied Notion Property ID. `direction` is `ascending` or `descending`. Multiple sorts are sent to Notion in the listed order.

### `variables` and Reader `type`

The keys under `variables` are Reader-owned names. Built-in headers use `mainClass`, `subClass`, and `codeName`; `cactus-study` can also show optional `tags`. `type` is the normalized Reader value type, not necessarily the literal Notion Property type.

```yaml
variables:
  codeName:
    propertyName: "Code name"
    type: string
    required: true
    fallback: Untitled
  mainClass:
    propertyName: "Main class"
    type: reference
    required: true
  tags:
    propertyName: "Tags"
    type: string[]
```

| Reader `type` | Compatible Notion Property | Reader value |
| --- | --- | --- |
| `string` | `title`, `rich_text`, `select`, `status` | A string; rich text is joined as plain text. |
| `string[]` | `multi_select` | Array of option names. |
| `number` | `number` | Finite number. |
| `boolean` | `checkbox` | `true` or `false`. |
| `date` | `date` | `start`, with optional `end`/`timeZone`. |
| `reference` | `relation` | One resolved reference with title, Reader ID, and optional icon. |
| `reference[]` | `relation` | Array of resolved references, possibly empty. |

Use `reference` when the relation has exactly one value. Zero values omit the variable; two or more cause a Mapping Error. Use `reference[]` for legitimate multiple relations. References outside allowed relation sources or not shared with the connection cannot be resolved. `url`, `email`, `phone_number`, `people`, `files`, `formula`, and `rollup` are not v1 variable mappings and are not silently converted.

| Variable field | Meaning |
| --- | --- |
| `propertyId` / `propertyName` | ID or exact name of the Notion Property; specify one. |
| `type` | Normalized Reader type from the table above. |
| `required` | Defaults to `false`. In v1 it documents template intent; a missing article value alone does not reject the article. |
| `fallback` | Replacement when the Property is empty or missing; only valid for `type: string`. |

Without a value or fallback, the variable is omitted from the API response and UI. Even `required: true` does not currently make a missing value a startup or rendering error. A present value that conflicts with `type` is a Mapping Error; there is no implicit conversion.

### `filters`

Filter keys are Reader field IDs allowed in browser search requests. The browser cannot choose arbitrary Notion Property IDs or endpoints.

```yaml
filters:
  tags:
    propertyName: "Tags"
    type: string[]
    sourceType: multi_select
    operators: [contains, isEmpty]
  mainClass:
    propertyName: "Main class"
    type: reference
    sourceType: relation
    operators: [equals, isEmpty]
```

`type` is a Reader type and must agree with any variable mapping of the same Property. `sourceType` is the actual Notion Property type. `operators` lists only permitted operations; `isEmpty` takes no value. Relation filters use a known page's Reader ID, resolved to a Notion ID only by the backend.

| `sourceType` | Reader `type` | Allowed operators | `value` |
| --- | --- | --- | --- |
| `title`, `rich_text` | `string` | `equals`, `contains`, `isEmpty` | Non-empty string |
| `select`, `status` | `string` | `equals`, `isEmpty` | Non-empty string |
| `multi_select` | `string[]` | `contains`, `isEmpty` | Non-empty option string |
| `checkbox` | `boolean` | `equals` | Boolean |
| `number` | `number` | `equals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `isEmpty` | Finite number |
| `date` | `date` | `equals`, `before`, `after`, `isEmpty` | ISO date or ISO datetime with an offset |
| `relation` | `reference` / `reference[]` | `equals`, `contains`, `isEmpty` | Known page Reader ID |

Omit `value` entirely for `isEmpty`; all other operators require the value type shown. Incompatible YAML `type`/`sourceType`, operator, or request value is rejected before contacting Notion.

### Equations and pagination

KaTeX renders Notion equation blocks in display mode and inline equations inside rich text. This includes paragraphs, headings, quotes, callouts, lists, table cells, captions, and the main article-detail title. List and search titles and template metadata remain plain text. Chemical equations can use `mhchem`'s `\ce{...}`. Invalid TeX falls back to text only, without execution. KaTeX HTML/MathML and fonts are served by the app; article API responses are not saved by the normal Service Worker. During a PWA update, an older screen may briefly show TeX text until the new version takes over.

The `nextCursor` for article lists and search is a random Reader-owned handle beginning with `cur_`. Upstream Notion cursors never reach the browser. The server keeps at most 1,024 handles in process memory for at most 30 minutes, bound to their endpoint, Reader database, search conditions, and page size. Tampered, expired, cross-context, or pre-restart cursors return HTTP 400 `invalid_request`. Cursors are not saved in SQLite.

### Callouts, child databases, and relation icons

- Callouts render their text, supported nested blocks, and Notion background color. Icons may be emoji, Notion-hosted images, or workspace custom emoji. Content beyond five nested levels or 500 blocks per article fails safely instead of being silently truncated.
- A database created directly inside an article is rendered automatically as a read-only table. The first 50 rows load with the article; **Load more** requests another 50. Linked database views are not supported.
- Every Property readable through the connection is shown. Hidden columns, filters, and sorts from a Notion view are not reproduced, so do not put a child database with private columns inside the Reader's shared scope. Unsupported values render as `—`, relations render as counts, and rows do not link to Notion pages.
- The read-only connection must be able to read the child database. A failure affects that table rather than the whole article. Opaque table tokens and cursors live in memory for 30 minutes; reload the article after expiry or a server restart.
- `reference` / `reference[]` icons come from the related page. Emoji, Notion-hosted images, and custom emoji are supported in article headers when the field uses `showIcon: true` or is selected as an `emblemVariable`. Add the target Data Source to `relationSources` and share it with the same read-only connection.

### Complete example and preflight check

See `config/reader.notion.example.yaml` for a combined example. After setting real IDs locally, run the read-only production-image check before startup:

```sh
docker compose --profile production run --rm production npm run config:check
```

This validates YAML, hash, Data Source schemas, and Property mappings, but cannot verify individual articles or relation pages. Check health and an article after startup using the [setup guide](setup.md). If the check fails, share only its safe category and path—not `.env/reader.yaml`, Notion IDs, or tokens.

### Presentation customization

Optional `presentation` settings control copy, colors, and header definitions in both the normal reader and static demo. Omitting them preserves existing copy, colors, and the `simple`/`compact-emblem` template IDs. `cactus-study` appears only if added to the database's `templates`. See the [design guide](design-customization.md) for a short example.

```yaml
presentation:
  version: 1
  locale: ja-JP
  brand:
    name: My Reader
    shortName: Reader
    eyebrow: Personal reference
    tagline: Notes, shaped for reading.
  theme:
    colorScheme: dark
    colors:
      accent: "#D8FF5F"
  messages:
    navHome: Home
    templateLabel: Template
  articleHeaders:
    reading-grid:
      name: Reading Grid
      renderer: field-grid
      title: { placement: header, alignment: start }
      tone: accent
      density: comfortable
      fields:
        - { variable: mainClass, label: Domain, width: half, showIcon: true }
        - { variable: subClass, label: Topic, width: half, showIcon: true }
```

- `brand` affects the UI, document title, and Web App Manifest. `locale` must be a valid language tag such as `ja-JP` or `en-US`; invalid values fail startup or demo build. `colorScheme: light` selects the light defaults, and `colors` can override them individually.
- Colors accept only `#RRGGBB`. HTML, JavaScript, CSS, and external font/stylesheet URLs are not configurable. `messages` overrides only allowlisted plain text; it cannot change API error bodies.
- Template IDs contain only lowercase ASCII letters, digits, and hyphens, up to 64 characters. Database `templates` and `defaultTemplate` must reference defined headers.
- `field-grid` supports `third`/`half`/`full` width and `normal`/`strong` emphasis. A field with no article value is omitted.
- `compact-emblem` has `emblemVariable`, `headlineVariable`, optional `headlineLabel`, metadata `fields`, and optional `caption`. It falls back to the article title when its headline value is empty. Existing YAML remains valid.
- `cactus-study` is a light classification bar with `headlineVariable`, `headlineLabel`, `seriesMark`, `seriesLabel`, optional `caption`, and up to three ordered `fields`. Its first available field becomes the large cell; remaining fields fill the small cells. With no headline value, the rich-text/equation article title appears once in the header.
- `title.placement` is `header` or `content`. The rich-text title, including inline equations, appears exactly once. Custom header variable references must exist in that database's `variables` or validation fails.

To try the built-in Cactus Study on an existing `.env/reader.yaml`, add `cactus-study` to the selected database's `templates`. Its built-in definition reads `codeName`, `mainClass`, `subClass`, and `tags`; missing article values are omitted. Override `presentation.articleHeaders.cactus-study` to change labels or series text. See `config/reader.notion.example.yaml` for the full configuration. Never commit real settings or Notion IDs. To implement a new trusted renderer, use the [renderer development guide](header-renderers.md).

### Security boundaries

- `contentDatabases`: Data Sources exposed as Reader libraries, search results, and articles.
- `relationSources`: Data Sources used only for relation title/icon resolution.
- `variables`: mappings between template variables and Notion Properties.
- `filters`: allowlist of Reader field IDs that browser search may use.

Do not commit real data, tokens, passwords, sessions, or the SQLite database.
