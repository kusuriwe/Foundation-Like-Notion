# Distribution, Licensing, and Setup Worklog

Date: 2026-09-23

## Summary / 概要

User-created article header files are now ignored by default while every
bundled header remains tracked. The repository now states its mixed-license
boundaries explicitly: Apache-2.0 for the general code and documentation,
CC BY-SA 3.0 for the two-file Cactus Study header adaptation, and reserved or
provider-specific rights for article text and images. The first-time Notion
setup guide now follows the current desktop/browser UI through Developer Mode,
connection creation, scoped sharing, and Data Source ID retrieval.

利用者が追加する記事header fileは既定でignoreし、同梱済みheaderはすべて追跡を維持した。
一般code・文書はApache-2.0、2 fileからなるCactus Study header翻案はCC BY-SA 3.0、
記事本文と画像は通常の著作権または提供元の条件という混在範囲を明文化した。初回Notion
setupは現行desktop/browser UIのDeveloper Mode、connection作成、限定共有、Data Source ID
取得までを日英で説明する。

## Decisions / 判断

- `.gitignore` ignores the whole article-header renderer directory. Git keeps
  existing tracked files tracked, while a new untracked renderer stays local.
  Intentional upstream contributions require `git add -f` after a license check.
- The root `LICENSE` contains the unmodified official Apache-2.0 text.
- `LICENSES/CC-BY-SA-3.0.txt` contains the unmodified official CC BY-SA 3.0
  Unported legal code. Only `CactusStudyHeader.tsx` and
  `cactus-study.module.css` carry that SPDX identifier.
- `NOTICE` supplies the Cactus adaptation's title, original author and helpers,
  source, license, change statement, and non-endorsement notice.
- SDQ article text is not relicensed. Project-owned app/demo imagery has no
  reuse grant unless individually marked.
- The `Tusmujimagari` and `Kojire` class icons use ICOOON MONO material. Other
  class icons are official Notion icons. These runtime third-party assets are
  not described as original project art or relicensed by this repository.
- Official screenshots were not copied. The setup guide links to Notion's
  current illustrated help and gives a safe project-owned screenshot checklist
  with required redactions.

## Sources / 参照

- Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.html
- CC BY-SA 3.0 deed and legal code:
  https://creativecommons.org/licenses/by-sa/3.0/ and
  https://creativecommons.org/licenses/by-sa/3.0/legalcode.txt
- Creative Commons attribution practices:
  https://wiki.creativecommons.org/wiki/Best_practices_for_attribution
- ACS source and SCP licensing guidance:
  https://scp-wiki.wikidot.com/anomaly-classification-system-guide and
  https://scp-wiki.wikidot.com/licensing-guide
- ICOOON MONO terms: https://icooon-mono.com/license/
- Notion Developer Mode, connection creation, and connection management:
  https://www.notion.com/help/turn-on-developer-mode-to-use-developer-tools-in-notion,
  https://www.notion.com/help/create-integrations-with-the-notion-api, and
  https://www.notion.com/help/add-and-manage-connections-with-the-api

## Validation / 検証

- `git diff --check`: passed.
- `docker compose config --quiet`: passed.
- `git check-ignore -v --no-index
  apps/web/src/components/article-headers/UserHeader.tsx`: matched the new
  directory rule.
- `git ls-files apps/web/src/components/article-headers`: confirmed all nine
  bundled header files remain tracked.
- Official Apache-2.0 and CC BY-SA 3.0 legal texts were downloaded to a
  temporary directory and compared with `git diff --no-index`; both repository
  copies matched exactly.
- `docker compose run --rm app npm run check`: passed. This included format,
  lint, typecheck, 100 unit/component tests, and the normal production build.
- `docker compose run --rm app npm run demo:build`: passed.
- `docker compose run --rm app npm run demo:verify`: passed; no API or secret
  boundary violation was found in the static artifact.
- `docker compose run --rm app npm run pages:verify`: passed.
- Browser E2E was not rerun because this change affects comments,
  repository-tracking policy, licenses, and documentation only; no runtime
  behavior or generated asset content changed.

## Limitations / 制約

- This repository documentation records the intended license scope but is not
  legal advice.
- Notion can change UI labels. The official help links are the source of truth
  when the written path differs.
- No third-party screenshot was bundled. Project-owned redacted screenshots can
  be added later without changing the setup flow.
