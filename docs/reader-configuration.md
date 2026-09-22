# Reader YAML・表示設定リファレンス

以下のコマンドと`config/`・`.env/`のパスはリポジトリのルートを基準にしています。最小構成で始める場合は先に[初回セットアップ](setup.md)を参照してください。

## Reader YAML reference

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

### Top-level fields

| Field | 値 | 説明 |
| --- | --- | --- |
| `version` | `1` | 設定 schema の version。現在は `1` のみです。 |
| `source` | `fixture` / `notion` | 実データでは `notion` を指定します。 |
| `contentDatabases` | list | Library、記事一覧、検索で公開する Data Source の定義です。1件以上必要です。 |
| `relationSources` | Data Source ID の list | Relation の title/icon 解決だけを許可する参照先です。Library には公開されません。未使用なら `[]` にします。 |

`relationSources` には `mainClass` や `subClass` が参照する Data Source ID を指定します。参照先の
Data Source/Page は Notion Internal Connection にも共有されている必要があります。content source は
自動的に許可対象となるため、同じ ID を `relationSources` へ重ねて書く必要はありません。

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

### `variables` と `type`

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

### `filters`

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

### 数式

Notion の equation block は display 数式として、rich text 内の inline equation は文中数式として KaTeX で
描画します。本文の段落、見出し、引用、callout、list、table、caption と、記事詳細画面の主タイトルが
対象です。一覧・検索のタイトルと template metadata は plain text のままです。

化学式では `mhchem` の `\ce{...}` を使用できます。解釈できない TeX は実行せず元の式を text-only で
表示します。KaTeX の HTML/MathML と font はアプリ自身から配信されますが、記事 API response は従来どおり
Service Worker に保存されません。PWA 更新中の旧画面にはinline equationが一時的にTeX文字列として表示され、
新しい画面へ切り替わった後にKaTeX表示となります。

### Pagination cursor

記事一覧と検索の `nextCursor` は `cur_` で始まる Reader 固有の random handle です。Notion の cursor は
Browser へ返さず、最大30分間、最大1,024件だけ server process のメモリに保持します。cursor は発行元の
endpoint、Reader database、検索条件、page size に結び付けられます。改変、別条件での再利用、期限切れ、
server 再起動前に発行された cursor は400 `invalid_request`になります。cursorはSQLiteへ保存されません。

### Complete Notion example

全fieldを組み合わせた例は`config/reader.notion.example.yaml`にあります。実IDを入力した後は、先に本番imageのread-only診断でYAML・hash・Data Source schema・Property対応を確認します。

```sh
docker compose --profile production run --rm production npm run config:check
```

個別記事・relation先ページの閲覧可否までは検査しません。起動後のhealthと記事表示は[初回セットアップ](setup.md)に従って確認してください。エラーになっても`.env/reader.yaml`、Notion ID、tokenの内容はissueやチャットへ貼らず、診断のcategoryと安全なpathだけを使ってください。

## Presentation customization

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
- `compact-emblem` は `emblemVariable`、`headlineVariable`、任意の `headlineLabel`、metadata `fields` を持ちます。`headlineVariable` が空なら記事titleへfallbackします。
- `compact-emblem` はプロトタイプに合わせて額縁付きicon、中央配置の分類、任意の`caption`を表示します。旧設定のままでも動きます。
- `cactus-study` は明るい分類バーです。`headlineVariable`、`headlineLabel`、`seriesMark`、`seriesLabel`、任意の`caption`と、表示順に最大3つの`fields`を設定します。最初の表示可能なfieldが大枠、残りが小枠に詰められます。`headlineVariable`が空ならrich text/数式付き記事titleをheaderへ一度だけ表示します。
- `title.placement` は `header` または `content` です。rich textとinline equationを保ったtitleを必ず一度だけ表示します。
- custom headerが参照する `variable` は、そのdatabaseの `variables` に存在する必要があります。誤字は起動時に拒否されます。

新しいtrusted rendererをコードとして追加する場合は [Header renderer guide](header-renderers.md) を参照してください。

既存の`.env/reader.yaml`でカクタス風を試すだけなら、対象databaseの`templates`へ`cactus-study`を追加します。組み込み定義は`codeName`、`mainClass`、`subClass`、`tags`を参照し、記事で欠けた値は省略します。labelやシリーズ表記を変える場合は`presentation.articleHeaders.cactus-study`を上書きしてください。完全な設定例は`config/reader.notion.example.yaml`にあります。実設定やNotion IDはGitへ追加しないでください。

## Configuration boundaries

- `contentDatabases`: Reader の library/search/article として公開可能な Data Source
- `relationSources`: Relation の title/icon 解決にだけ利用可能な Data Source
- `variables`: Template variable と Notion Property ID の mapping
- `filters`: Browser が Reader field ID として指定できる filter の allowlist

実データ、token、password、session、SQLite DB は commit しません。
