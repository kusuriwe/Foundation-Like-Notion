# 自分のNotionでReaderを使う / Set up your own Notion Reader

[日本語](#japanese) · [English](#english)

<a id="japanese"></a>

## 日本語

Windows・macOS・Linux共通で、ホスト側のNode.jsは不要です。Docker Desktop（LinuxではDocker EngineとCompose plugin）とGitを用意し、Dockerを起動してからこのリポジトリを取得してください。Readerは自分の端末の`127.0.0.1:3000`で動き、実Notionの内容をGitHub Pagesへ公開しません。

リポジトリを取得し、そのルートへ移動します。次の2行はWindows PowerShellとmacOS・LinuxのPOSIX shellで共通です。リポジトリが非公開の場合は、アクセス権のあるアカウントで認証してください。

```sh
git clone https://github.com/kusuriwe/Foundation-Like-Notion.git
cd Foundation-Like-Notion
```

### 1. Notionの読み取り接続を準備

読み取り専用のInternal Connectionを作り、利用する記事Data Sourceに接続してください。relationのタイトル・アイコンも表示する場合は、その参照先Data Source/Pageも必要な範囲だけ共有します。親ページやworkspace全体への接続拡大は不要です。token、記事Data Source ID、タイトルPropertyの正確な名前を手元で確認します。ここで使うのはDatabase IDではなく**Data Source ID**です。

token、Data Source ID、記事内容、パスワードをチャット・issue・コミットへ貼らないでください。Property名は選択したData Source内で大文字小文字まで完全一致させます。

### 2. ignored設定を作る

リポジトリのルートで実行します。Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .env
Copy-Item config/reader.env.example .env/reader.env
Copy-Item config/reader.notion.minimal.example.yaml .env/reader.yaml
```

macOS・LinuxのPOSIX shell:

```sh
mkdir -p .env
cp config/reader.env.example .env/reader.env
cp config/reader.notion.minimal.example.yaml .env/reader.yaml
```

`reader.yaml`の`sourceDataSourceId`を記事Data Source IDに、`titlePropertyName`を実際のtitle Property名に変更します。`id`はNotion IDではないReader側の名前（8～128文字）です。最小例ではrelation・検索filter・表示のカスタマイズは不要です。後から追加する場合は[設定リファレンス](reader-configuration.md)と詳細な`config/reader.notion.example.yaml`を使ってください。

### 3. パスワードhashとtokenを設定

次のコマンドは3つのOSで共通です。最初のbuildは依存packageの取得と品質チェックを含むため時間がかかりますが、Playwright browser入りの開発imageは作りません。

```sh
docker compose --profile production build production
docker compose --profile production run --rm production npm run setup:hash
```

2番目のコマンドはReaderへログインするためのパスワードを端末で非表示入力します。表示された**完全な**`$argon2id$...`を`.env/reader.env`の`READER_PASSWORD_HASH`へ、全体を単一引用符で囲んで保存してください。`p=1`など一部だけではありません。同じファイルの`NOTION_TOKEN`へconnection tokenを設定します。パスワード自体は保存せず、コマンド引数やshell履歴にも入れないでください。

### 4. 起動前に診断

```sh
docker compose --profile production run --rm production npm run config:check
```

成功時は`{"ok":true,"source":"notion",...}`のように件数だけが表示されます。このコマンドはYAMLとhashを検証し、Notionから設定済みData Sourceのschemaを**読み取り**ます。記事本文の取得、Notionへの書込み、SQLiteへの保存はしません。relation先の個別ページや記事の内容まで検証するものではないため、起動後に実際の記事も確認してください。

失敗時は次の安全な分類だけを表示します。実値を共有する必要はありません。

| `category` | 確認箇所 |
| --- | --- |
| `missing_config` / `invalid_config` | `.env/reader.yaml`の存在、YAML構文、必須field |
| `missing_password_hash` / `invalid_password_hash` | 完全なArgon2id hashと単一引用符 |
| `missing_notion_token` | `.env/reader.env`の`NOTION_TOKEN` |
| `source_unavailable` | Data Source ID、connection共有範囲、token、通信状態。`status`が出た場合もIDやtokenは表示しません。 |
| `property_no_match` / `property_type_mismatch` | 指定したProperty名・IDの完全一致とNotion Property type |

`config:resolve`はProperty名をIDへ固定したい場合だけの移行コマンドです。通常の`propertyName`設定では不要です。

### 5. 起動・停止

```sh
docker compose --profile production up -d production
```

Windowsでは`Invoke-RestMethod http://127.0.0.1:3000/api/health`、macOS・Linuxでは`curl http://127.0.0.1:3000/api/health`で`status: ok`と`source: notion`を確認します。その後、同じURLをブラウザで開いてログインし、記事一覧・詳細を確認してください。本番containerの公開先はloopbackの`127.0.0.1:3000`だけです。

停止するときは次を実行します。`.env/`とDocker named SQLite volumeは残ります。`down --volumes`はReader ID対応とsessionを消すので通常は使いません。

```sh
docker compose --profile production down
```

更新時は変更を取得してから`docker compose --profile production build production`、`config:check`、`docker compose --profile production up -d production`の順に実行します。既存のignored設定やvolumeは自動変更しません。

### 任意: 他端末からTailscale経由で使う

Tailscaleをホストと利用端末に本人がインストール・ログインしてから、ホストで`tailscale serve --bg 3000`を実行します。`tailscale serve status`に表示されるtailnet内HTTPS URLだけを使い、Funnelで一般公開しないでください。WindowsでCLIがPATHにない場合は`C:\Program Files\Tailscale\tailscale.exe`を指定します。終了時は既存の他のServe設定がないことを確認してから`tailscale serve reset`を実行します。

<a id="english"></a>

## English

This setup works on Windows, macOS, and Linux without installing Node.js on the host. Install Git and start Docker Desktop (or Docker Engine plus the Compose plugin on Linux). The reader runs locally at `127.0.0.1:3000`; this procedure does not publish your Notion content to GitHub Pages.

Clone the repository and enter its root directory. These commands work in PowerShell and POSIX shells. If the repository is private, authenticate with an account that has access.

```sh
git clone https://github.com/kusuriwe/Foundation-Like-Notion.git
cd Foundation-Like-Notion
```

### 1. Prepare a read-only Notion connection

Create an Internal Connection with read-only capabilities and connect it only to the article Data Source you intend to read. If you also want relation titles or icons, share only the required target Data Sources or pages. Do not broaden access to a parent page or the entire workspace. Keep the connection token, article **Data Source ID** (not Database ID), and exact title Property name at hand. Property names are case-sensitive within the selected Data Source.

Never paste tokens, IDs, article content, or passwords into chat, issues, or commits.

### 2. Create ignored local settings

Run these commands in the repository root. Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .env
Copy-Item config/reader.env.example .env/reader.env
Copy-Item config/reader.notion.minimal.example.yaml .env/reader.yaml
```

macOS/Linux POSIX shell:

```sh
mkdir -p .env
cp config/reader.env.example .env/reader.env
cp config/reader.notion.minimal.example.yaml .env/reader.yaml
```

In `.env/reader.yaml`, replace `sourceDataSourceId` with the article Data Source ID and `titlePropertyName` with the exact title Property name. The `id` is a Reader-owned name of 8–128 characters, not a Notion ID. The minimal example needs no relations, search filters, or presentation customization. Add those later using the [configuration reference](reader-configuration.md) and `config/reader.notion.example.yaml`.

### 3. Set a password hash and token

The following commands are the same on all three operating systems. The first build downloads dependencies and runs quality checks, so it may take time; it does not build the development image with Playwright browsers.

```sh
docker compose --profile production build production
docker compose --profile production run --rm production npm run setup:hash
```

The second command privately prompts for your Reader login password. Copy the **entire** resulting `$argon2id$...` string into `READER_PASSWORD_HASH` in `.env/reader.env`, enclosed in single quotes so Docker Compose treats each `$` literally. A fragment such as `p=1` is not enough. Set `NOTION_TOKEN` in the same file. Do not store the password itself or put it in a command argument or shell history.

### 4. Check configuration before startup

```sh
docker compose --profile production run --rm production npm run config:check
```

On success, output such as `{"ok":true,"source":"notion",...}` contains counts only. This command validates YAML and the hash, then **reads** configured Data Source schemas from Notion. It does not fetch article bodies, write to Notion, or store anything in SQLite. It cannot verify individual relation target pages or article content; open an article after startup as well.

Failures report safe categories, not the underlying values:

| `category` | What to check |
| --- | --- |
| `missing_config` / `invalid_config` | Presence and syntax of `.env/reader.yaml`, and required fields |
| `missing_password_hash` / `invalid_password_hash` | The complete Argon2id hash and its single quotes |
| `missing_notion_token` | `NOTION_TOKEN` in `.env/reader.env` |
| `source_unavailable` | Data Source ID, connection access, token, and network. An HTTP `status` may appear, but no ID or token is printed. |
| `property_no_match` / `property_type_mismatch` | Exact Property name or ID and its Notion Property type |

`config:resolve` is an optional migration command for pinning Property names to IDs; normal `propertyName` settings do not require it.

### 5. Start, check, and stop

```sh
docker compose --profile production up -d production
```

On Windows, run `Invoke-RestMethod http://127.0.0.1:3000/api/health`; on macOS/Linux, run `curl http://127.0.0.1:3000/api/health`. Confirm `status: ok` and `source: notion`, then open the same URL in a browser, log in, and check an article list and detail. The production container binds only to loopback `127.0.0.1:3000`.

To stop, run the following. `.env/` and the named SQLite volume remain. Avoid `down --volumes` in normal use: it removes Reader ID mappings and sessions.

```sh
docker compose --profile production down
```

For an update, obtain the code changes, then run `docker compose --profile production build production`, `config:check`, and `docker compose --profile production up -d production` in that order. Ignored settings and the volume are not changed automatically.

### Optional: use Tailscale from another device

Install and sign in to Tailscale yourself on both the host and the viewing device. Run `tailscale serve --bg 3000` on the host and use only the tailnet HTTPS URL shown by `tailscale serve status`. Do not enable Funnel or publish the real reader to the public Internet. On Windows, if the CLI is not on PATH, run `C:\Program Files\Tailscale\tailscale.exe`. Before `tailscale serve reset`, confirm you do not have another Serve configuration to preserve.
