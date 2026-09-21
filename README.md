# Foundation Like Notion

個人用の read-only Notion Reader です。Browser は Reader 固有 API だけを利用し、Notion token、
Notion object ID、raw API response を受け取りません。

## Prerequisites

- Docker Desktop（起動はユーザーが行います）
- 実 Notion 接続時のみ、Read Only の Notion Internal Connection
- iOS から確認する段階のみ、Windows host 上の Tailscale

ホストへの Node.js 導入は不要です。開発・build・test は Node.js 24.21.0 の container 内で行います。

## First setup

```powershell
New-Item -ItemType Directory .env -Force
Copy-Item config/reader.env.example .env/reader.env
Copy-Item config/reader.example.yaml .env/reader.yaml
docker compose build app
docker compose run --rm app npm run auth:hash --workspace @foundation-like-notion/api
```

表示された Argon2id hash は、Docker Compose に `$` を変数展開させないよう、全体を単一引用符で
囲んで `.env/reader.env` の `READER_PASSWORD_HASH` に設定します。

```dotenv
READER_PASSWORD_HASH='$argon2id$v=19$m=...$...$...'
NOTION_TOKEN=ntn_...
```

`$argon2id$` から最後までが1つの hash です。`p=1` など一部分だけを設定しないでください。Password
自体を command line、設定ファイル、Git に保存しないでください。

最初は fixture 設定で動作します。実 Notion へ切り替えるときは
`config/reader.notion.example.yaml` を `.env/reader.yaml` へコピーし、placeholder を実際の Data
Source / Property ID に置き換え、`.env/reader.env` に `NOTION_TOKEN` を設定します。

## Reader YAML reference

アプリが読む実設定は `.env/reader.yaml` です。`config/reader.notion.example.yaml` を雛形として使い、
Notion の Data Source ID と Property ID は API が返した文字列をそのまま引用符で囲んで記述します。
Property 名ではなく Property ID を指定してください。設定は厳格に検証されるため、未知の field、
重複した Reader ID、未許可の filter operator があると起動に失敗します。

Property ID を Notion UI から集めにくい場合は、最初だけ各 `propertyId` と `titlePropertyId` に
Property の表示名を正確に記述してから、次の resolver を実行できます。

```powershell
docker compose run --rm app npm run config:resolve
```

resolver は各 `contentDatabases[]` の選択済み Data Source 内だけを検索します。同名 Property が別の
Data Source にあっても衝突しません。既存の ID を優先し、それ以外は大文字・小文字を含む完全一致の
名前だけを候補にします。全 mapping の Notion type が設定と互換である場合に限り、名前を実 ID へ
一括置換します。

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
    titlePropertyId: "title-property-id"
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
| `titlePropertyId` | Notion の `title` Property ID。記事タイトルと title search に使います。 |
| `defaultTemplate` | 初期 template。必ず `templates` にも含めます。 |
| `templates` | 許可する同梱 template。現在は `simple` と `compact-emblem` だけです。 |
| `sort` | Notion query に渡す既定 sort。1件以上必要です。 |
| `variables` | Template が参照できる Reader variable の allowlist です。 |
| `filters` | Browser から指定可能な検索 filter の allowlist です。 |

`sort[].field` は `created_time`、`last_edited_time`、または `variables` / `filters` に定義した Reader
field 名です。Notion Property ID を直接書きません。`direction` は `ascending` または `descending`
です。複数指定時は記載順で Notion query に渡されます。

### `variables` と `type`

`variables` の key は Reader 内の名前です。組み込み template は `mainClass`、`subClass`、
`codeName` を参照します。`type` は Notion の Property type そのものではなく、Notion value を安全な
Reader value へ正規化した後の型です。

```yaml
variables:
  codeName:
    propertyId: "code-name-property-id"
    type: string
    required: true
    fallback: Untitled
  mainClass:
    propertyId: "main-class-relation-property-id"
    type: reference
    required: true
  tags:
    propertyId: "tags-property-id"
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
| `propertyId` | Notion API が返す Property ID。Property 名ではありません。 |
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
    propertyId: "tags-property-id"
    type: string[]
    sourceType: multi_select
    operators: [contains, isEmpty]
  mainClass:
    propertyId: "main-class-relation-property-id"
    type: reference
    sourceType: relation
    operators: [equals, isEmpty]
```

- `type` は上表の Reader type です。同じ Property を `variables` にも定義する場合は同じ型にします。
- `sourceType` は実際の Notion Property type です。
- `operators` は Browser に許可する操作だけを列挙します。`isEmpty` は検索値を必要としません。
- Relation filter の検索値には Browser が保持する Reader ID を使い、backend が Notion ID に解決します。

| `sourceType` | 推奨 Reader `type` | 許可可能な operator |
| --- | --- | --- |
| `title`, `rich_text` | `string` | `equals`, `contains`, `isEmpty` |
| `select`, `status` | `string` | `equals`, `isEmpty` |
| `multi_select` | `string[]` | `contains`, `isEmpty` |
| `checkbox` | `boolean` | `equals` |
| `number` | `number` | `equals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `isEmpty` |
| `date` | `date` | `equals`, `before`, `after`, `isEmpty` |
| `relation` | `reference` / `reference[]` | `equals`, `contains`, `isEmpty` |

### Complete Notion example

全 field を組み合わせた例は `config/reader.notion.example.yaml` にあります。実 ID を入力した後は
production container の起動時に YAML 全体が検証されます。実値を表示せずに構文と設定を確認するには、
次を実行して `/api/health` が `source: notion` で起動することを確認してください。

```powershell
docker compose --profile production up --build production
```

エラーになった場合も `.env/reader.yaml`、Notion ID、token の内容は issue やチャットへ貼らないで
ください。validation path と error message だけで確認します。

## Development

```powershell
docker compose up app
```

- PWA: <http://localhost:5173>
- API health: <http://localhost:3000/api/health>

Vite は `/api` を Fastify へ proxy します。API response は `no-store` で、Service Worker も API を
cache しません。

## Quality gate

```powershell
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
```

PWA icon の元データは `apps/web/public/icon.svg` です。変更した場合は Playwright browser を含む開発
container 内で `npm run icons:render` を実行し、180 / 192 / 512 px の raster fallback を更新します。

## Production-like localhost

`.env/reader.yaml` を実設定に更新した後、次を実行します。

```powershell
docker compose --profile production up --build production
```

Production container は `127.0.0.1:3000` のみへ公開します。iOS 検証時は host 上の Tailscale Serve
からこの endpoint へ HTTPS proxy し、一般 Internet へは公開しません。

Development の fixture DB と production の Notion ID/session DB は、それぞれ独立した Docker named
volume に保存されます。`docker compose down` では削除されません。明示的に `--volumes` を付けると
Reader ID mapping と session も失われるため、通常の停止では使用しないでください。

Tailscale を host に導入・login した後、tailnet 内だけへ公開します。Funnel は使用しません。

```powershell
tailscale serve --bg 3000
tailscale serve status
# 公開設定を解除する場合
tailscale serve reset
```

表示された `https://<device>.<tailnet>.ts.net` を iOS Safari で開き、Reader Login が引き続き必要な
ことを確認します。

## Configuration boundaries

- `contentDatabases`: Reader の library/search/article として公開可能な Data Source
- `relationSources`: Relation の title/icon 解決にだけ利用可能な Data Source
- `variables`: Template variable と Notion Property ID の mapping
- `filters`: Browser が Reader field ID として指定できる filter の allowlist

実データ、token、password、session、SQLite DB は commit しません。
