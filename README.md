# Foundation Like Notion

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

個人用の読み取り専用Notion Readerです。ブラウザにはReader固有のAPIだけを公開し、Notion token・object ID・raw responseを渡しません。ホストへのNode.js導入は不要です。

### 目的別の入口

| やりたいこと | 手順 |
| --- | --- |
| 公開ダミーデモを見る | 公開後のGitHub Pages URLを開きます。公開状況を確認するまでは、URLが稼働中とは想定しないでください。 |
| 自分のNotionを接続する | [初回セットアップ](docs/setup.md)を上から進めます。Windows・macOS・Linuxに対応します。 |
| ダミーデモを編集・配布する | [デモ配布ガイド](docs/demo-publishing.md)を参照します。実NotionはPagesへ含めません。 |
| 文言・色・記事headerを変更する | [デザイン追加ガイド](docs/design-customization.md)から始めます。 |

最小Notion設定例は `config/reader.notion.minimal.example.yaml`、全機能の例は `config/reader.notion.example.yaml` です。Property type、filter、header、presentationの詳細は[設定リファレンス](docs/reader-configuration.md)を参照してください。

### 開発と検証

Docker Desktop、またはDocker EngineとCompose pluginが必要です。`app`サービスは追跡対象の`config/reader.example.yaml`をfixture設定として直接使うため、`.env/reader.yaml`へのコピーは不要です。[初回セットアップ](docs/setup.md)を参考に`.env/reader.env`へログイン用hashを設定し、`docker compose up app`を実行します。画面は <http://localhost:5173>、API healthは <http://localhost:3000/api/health> です。

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
```

実Notion用の秘密情報は`.env/`内だけに置き、Gitへ追加しないでください。一般Internetへ実Notionを公開しないでください。別端末から使う場合は[セットアップガイド](docs/setup.md)のtailnet限定HTTPS手順を参照してください。

<a id="english"></a>

## English

Foundation Like Notion is a personal, read-only Notion reader. The browser uses Reader-owned APIs; it never receives Notion tokens, object IDs, or raw API responses. You do not need Node.js on the host.

### Choose a path

| Goal | Guide |
| --- | --- |
| View the public dummy demo | Open its GitHub Pages URL once deployment is confirmed. Do not assume the URL is live beforehand. |
| Connect your own Notion | Follow the [first-time setup guide](docs/setup.md). It covers Windows, macOS, and Linux. |
| Edit or publish the dummy demo | Follow the [demo publishing guide](docs/demo-publishing.md). Real Notion data is never included in Pages. |
| Change copy, colors, or article headers | Start with the [design customization guide](docs/design-customization.md). |

Start with `config/reader.notion.minimal.example.yaml`; see `config/reader.notion.example.yaml` for a fuller example. The [configuration reference](docs/reader-configuration.md) explains Property types, filters, headers, and presentation settings.

### Development and checks

Start Docker Desktop, or Docker Engine with the Compose plugin. The `app` service reads the tracked fixture config at `config/reader.example.yaml` directly; you do not need to copy it to `.env/reader.yaml`. Set a login hash in `.env/reader.env` using the [setup guide](docs/setup.md), then run `docker compose up app`. Open <http://localhost:5173>; API health is at <http://localhost:3000/api/health>.

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
```

Keep real Notion credentials only in `.env/`, and never commit them. Do not expose a real Notion reader to the public Internet. For another device, use the tailnet-only HTTPS instructions in the [setup guide](docs/setup.md).
