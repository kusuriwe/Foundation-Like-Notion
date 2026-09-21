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

表示された Argon2id hash を `.env/reader.env` の `READER_PASSWORD_HASH` に設定します。Password 自体を
command line、設定ファイル、Git に保存しないでください。

最初は fixture 設定で動作します。実 Notion へ切り替えるときは
`config/reader.notion.example.yaml` を `.env/reader.yaml` へコピーし、placeholder を実際の Data
Source / Property ID に置き換え、`.env/reader.env` に `NOTION_TOKEN` を設定します。

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
