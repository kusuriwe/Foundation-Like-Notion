# License scope / ライセンスの適用範囲

[日本語](#日本語) · [English](#english)

## 日本語

このリポジトリは複数のライセンスと権利区分を含みます。ルートの
[`LICENSE`](../LICENSE)だけをすべてのファイルへ一律に適用しないでください。

| 対象 | 条件 |
| --- | --- |
| 下記の例外を除くソースコード、文書、設定例、公開デモの架空fixture | Apache License 2.0（[`LICENSE`](../LICENSE)） |
| `CactusStudyHeader.tsx` と `cactus-study.module.css` | Creative Commons Attribution-ShareAlike 3.0 Unported（[`CC-BY-SA-3.0.txt`](CC-BY-SA-3.0.txt)）。帰属と変更内容は[`NOTICE`](../NOTICE)を参照 |
| SDQの記事本文 | 通常の著作権。個別表示がない限り再利用許諾はありません |
| `Tusmujimagari` / `Kojire` class icon | [ICOOON MONO](https://icooon-mono.com/)の素材。著作権はTopeconHeroesに帰属し、[同サイトの利用条件](https://icooon-mono.com/license/)に従います |
| その他のclass icon | Notion公式icon。権利はNotion Labs, Inc.またはそのlicensorに帰属し、このrepositoryは素材単体を再許諾しません |
| project独自のapp icon・demo画像 | 通常の著作権。個別表示がない限り再利用許諾はありません |

現在「project独自のapp icon・demo画像」に含める追跡対象は、`apps/web/public/icon.svg`、
`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`、および
`apps/web/public/demo/`内の画像です。これらはソフトウェアを実行・表示するために
同梱されていますが、Apache-2.0による独立した再利用許諾は行いません。

ICOOON MONOはWeb・app内での素材利用を認めていますが、素材そのものの再配布や販売を
禁止しています。`Tusmujimagari` / `Kojire`の表示は提供元の条件に従って利用し、素材を
repositoryの汎用icon packとして配布しないでください。Notion公式iconも利用者のNotionから
実行時に表示される第三者素材であり、このrepositoryのApache-2.0対象ではありません。

公開デモ用YAMLに含まれる架空の記事fixtureはSDQ本文ではなく、Apache-2.0の対象です。
利用者自身が`.env/`やNotionへ保存した文章・画像の権利は、このリポジトリのライセンスに
よって変更されません。

### Cactus Study headerを再配布・改変する場合

CC BY-SA 3.0に従い、少なくとも次を維持してください。

- 作品名、作者、出典URL、CC BY-SA 3.0へのリンク（TASL）
- 変更した場合は、その旨と変更内容
- 改変物へのCC BY-SA 3.0または互換ライセンスの適用
- 原作者やSCP Wikiが利用者を支持していると誤認させない表示

このリポジトリでは必要な情報を[`NOTICE`](../NOTICE)にまとめています。配布時に
`NOTICE`も含めてください。

この文書はライセンス範囲を説明するもので、法的助言ではありません。

## English

This repository contains multiple licensing and rights categories. Do not
assume that the root [`LICENSE`](../LICENSE) applies uniformly to every file.

| Material | Terms |
| --- | --- |
| Source code, documentation, configuration examples, and fictional public-demo fixtures, except as listed below | Apache License 2.0 ([`LICENSE`](../LICENSE)) |
| `CactusStudyHeader.tsx` and `cactus-study.module.css` | Creative Commons Attribution-ShareAlike 3.0 Unported ([`CC-BY-SA-3.0.txt`](CC-BY-SA-3.0.txt)); see [`NOTICE`](../NOTICE) for attribution and modifications |
| SDQ article text | Standard copyright; no reuse license is granted unless a specific notice says otherwise |
| `Tusmujimagari` / `Kojire` class icons | Material from [ICOOON MONO](https://icooon-mono.com/); copyright is retained by TopeconHeroes and use is subject to its [license terms](https://icooon-mono.com/license/) |
| Other class icons | Official Notion icons; rights remain with Notion Labs, Inc. or its licensors, and this repository does not relicense the standalone assets |
| Project-owned app icons and demo images | Standard copyright; no reuse license is granted unless a specific notice says otherwise |

Tracked “project-owned app icons and demo images” currently include
`apps/web/public/icon.svg`, `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, and images under `apps/web/public/demo/`. They are
distributed so the software can run and be displayed, but they are not
separately offered for reuse under Apache-2.0.

ICOOON MONO permits use in websites and applications but prohibits
redistributing or selling the icon material itself. Use the `Tusmujimagari`
and `Kojire` displays under the provider's terms; do not distribute the
source assets as a general-purpose icon pack. Official Notion icons are also
third-party material displayed at runtime from a user's Notion, not material
offered under this repository's Apache-2.0 license.

The fictional article fixtures in the public-demo YAML are not SDQ article
text and remain under Apache-2.0. This repository's licenses do not alter the
rights in text or images that a user stores in `.env/` or Notion.

### Redistributing or modifying the Cactus Study header

To comply with CC BY-SA 3.0, retain at least:

- the title, author, source URL, and CC BY-SA 3.0 link (TASL);
- a notice that changes were made, with a description of those changes;
- CC BY-SA 3.0 or a compatible license for adaptations; and
- wording that does not imply endorsement by the original authors or SCP Wiki.

This repository collects those details in [`NOTICE`](../NOTICE). Include the
`NOTICE` file when redistributing the Cactus Study header.

This document explains repository licensing scope and is not legal advice.
