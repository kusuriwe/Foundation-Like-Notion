# Foundation Like Notion

個人用のread-only Notion Readerです。BrowserにはReader固有APIだけを公開し、Notion token・object ID・raw responseを渡しません。ホストへのNode.js導入は不要です。

## 目的別の入口

| やりたいこと | 手順 |
| --- | --- |
| 公開ダミーデモを見る | GitHub Pages公開後はURLを開くだけです。**現在は実Pages公開前**です。 |
| 自分のNotionを接続する | [初回セットアップ](docs/setup.md)を上から進めてください。Windows・macOS・Linuxに対応します。 |
| ダミーデモを編集・配布する | [デモ配布ガイド](docs/demo-publishing.md)を参照してください。実NotionはPagesへ含めません。 |

最小Notion設定例は `config/reader.notion.minimal.example.yaml`、全機能を使う例は `config/reader.notion.example.yaml` です。Property type、filter、header、presentationの詳細は[設定リファレンス](docs/reader-configuration.md)にまとめています。

## 開発と検証

開発には起動済みのDocker Desktop、またはDocker EngineとCompose pluginが必要です。fixtureで開発する場合は、`.env/reader.yaml`に`config/reader.example.yaml`をコピーし、`.env/reader.env`にログイン用hashを設定してから`docker compose up app`を実行します。画面は <http://localhost:5173>、API healthは <http://localhost:3000/api/health> です。ファイルコピーとhash生成は[初回セットアップ](docs/setup.md)の手順2～3と同様です。実Notion用の秘密情報は`.env/`内だけに置き、Gitへ追加しないでください。

```sh
docker compose run --rm app npm run check
docker compose run --rm app npm run e2e
```

新しい記事header rendererの追加方法は[Header renderer guide](docs/header-renderers.md)にあります。実Notionを一般Internetへ公開しないでください。iOSなど別端末から利用する場合は、[セットアップガイド](docs/setup.md)のtailnet限定HTTPS手順を使います。
