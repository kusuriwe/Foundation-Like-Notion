# Published demo snapshot / 公開demo snapshot

[日本語](#日本語) · [English](#english)

## 日本語

`published/`は、公開SDQ NotionをReader DTOへ変換したGitHub Pages用の静的snapshotです。Notion token、Data Source・Property・Page・Block ID、署名付きasset URL、ignored設定は含みません。記事本文と画像はoffline用Service Workerにも保存される公開物です。

これらの生成fileは直接編集せず、[デモ配布ガイド](../docs/demo-publishing.md)の`demo:export`で再生成してください。候補はまずignoredの`.data/demo-export/candidate/`へ作られ、`--apply`を指定した場合だけ`published/`を置き換えます。

`published/articles/`のSDQ本文は通常の著作権で保護され、Apache-2.0による再利用許諾はありません。`published/assets/`にはNotion公式icon、ICOOON MONO由来素材、記事画像などが含まれ得ます。各素材の権利は提供元または著作権者に帰属します。詳細は[ライセンス範囲](../LICENSES/README.md)と[`NOTICE`](../NOTICE)を参照してください。

## English

`published/` is a static GitHub Pages snapshot of the public SDQ Notion converted to Reader DTOs. It contains no Notion token, Data Source, Property, Page, or Block IDs, signed asset URLs, or ignored settings. Article text and images are public material and are also stored by the offline Service Worker.

Do not hand-edit generated files. Regenerate them with `demo:export` as documented in the [demo publishing guide](../docs/demo-publishing.md). The command first writes an ignored candidate under `.data/demo-export/candidate/`; only `--apply` replaces `published/`.

SDQ text under `published/articles/` remains under standard copyright and is not offered under Apache-2.0. `published/assets/` may include official Notion icons, material derived from ICOOON MONO, and article images. Rights remain with their respective providers or copyright holders. See the [license scope](../LICENSES/README.md) and [`NOTICE`](../NOTICE).
