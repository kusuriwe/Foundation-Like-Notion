# Foundation Like Notion

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

個人用の読み取り専用Notion Readerです。ブラウザにはReader固有のAPIだけを公開し、Notion token・object ID・raw responseを渡しません。ホストへのNode.js導入は不要です。

本文は数式、色付き・入れ子のcallout、通常table、記事内で作成した子databaseを表示できます。Relation先ページの絵文字・Notion-hosted画像・カスタム絵文字は記事headerのclass iconとして利用できます。詳しい制約は[設定リファレンス](docs/reader-configuration.md)を参照してください。

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

### ライセンスと著作権

このリポジトリは混在ライセンスです。原則としてソースコード・文書・設定例は
[Apache License 2.0](LICENSE)ですが、次の例外があります。

- `Cactus Study header`のReact/CSSは、SCP Wikiの
  [Anomaly Classification System (ACS) Guide](https://scp-wiki.wikidot.com/anomaly-classification-system-guide)
  （Woedenaz、協力者は[`NOTICE`](NOTICE)に記載）を翻案したもので、
  [CC BY-SA 3.0](LICENSES/CC-BY-SA-3.0.txt)です。レスポンシブなReader用headerとして
  再実装し、layout・label・色・typography・field・icon入力を変更しています。
- SDQの記事本文は通常の著作権で保護され、個別表示がない限り再利用許諾はありません。
- Readerに表示するclass iconのうち、`Tusmujimagari` / `Kojire` classには
  [ICOOON MONO](https://icooon-mono.com/)の素材を使用し、それ以外にはNotion公式iconを
  使用しています。著作権は各提供元に帰属し、このrepositoryから素材単体の再利用許諾は行いません。
- project独自のapp icon・demo画像は通常の著作権で保護され、個別表示がない限り再利用許諾はありません。

ファイルごとの適用範囲、Cactus headerの作品名・作者・出典・ライセンス（TASL）、
変更表示、再配布条件は[ライセンス一覧](LICENSES/README.md)と[`NOTICE`](NOTICE)を
確認してください。SCP Wikiや原作者が本プロジェクトを支持していることを示すものではありません。

<a id="english"></a>

## English

Foundation Like Notion is a personal, read-only Notion reader. The browser uses Reader-owned APIs; it never receives Notion tokens, object IDs, or raw API responses. You do not need Node.js on the host.

Article bodies support equations, colored nested callouts, plain tables, and child databases created inside an article. Emoji, Notion-hosted images, and custom emoji on related pages can serve as class icons in article headers. See the [configuration reference](docs/reader-configuration.md) for limits and security notes.

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

### License and copyright

This is a mixed-license repository. Source code, documentation, and
configuration examples are generally under the [Apache License 2.0](LICENSE),
with these exceptions:

- The React/CSS for the `Cactus Study header` adapts the SCP Wiki
  [Anomaly Classification System (ACS) Guide](https://scp-wiki.wikidot.com/anomaly-classification-system-guide)
  by Woedenaz, with assistance credited in [`NOTICE`](NOTICE), and is licensed
  under [CC BY-SA 3.0](LICENSES/CC-BY-SA-3.0.txt). It was reimplemented as a
  responsive Reader header; layout, labels, colors, typography, fields, and
  icon inputs were changed.
- SDQ article text remains under standard copyright, with no reuse license
  granted unless a specific notice says otherwise.
- The `Tusmujimagari` and `Kojire` class icons displayed by the Reader use
  material from [ICOOON MONO](https://icooon-mono.com/); other class icons are
  official Notion icons. Copyright remains with the respective providers, and
  this repository does not grant a standalone reuse license for those assets.
- Project-owned app icons and demo images remain under standard copyright,
  with no reuse license granted unless a specific notice says otherwise.

See the [license scope](LICENSES/README.md) and [`NOTICE`](NOTICE) for the
file-level boundaries, Cactus header title/author/source/license (TASL),
change notice, and redistribution requirements. No endorsement by SCP Wiki or
the original authors is implied.
