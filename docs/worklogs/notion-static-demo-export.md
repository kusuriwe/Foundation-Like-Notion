# Notion static demo export worklog

## Status

Implementation and validation completed on 2026-09-23 from `main` at `a41ddb5`. The existing `release` branch remains unchanged. The change is ready for independent review and has not been pushed.

## Goal

Create a local, read-only export path that turns the current ignored Notion configuration into a reviewed static Pages demo while excluding credentials, source identifiers, signed URLs, and private mappings.

## Progress

- Confirmed that `main`, local `release`, `origin/main`, and `origin/release` all began at `a41ddb5`.
- Confirmed the worktree was clean before switching from `release` to `main`.
- Recorded the approved implementation contract in `docs/plans/active/notion-static-demo-export.md`.
- The existing public DTO permits at most 500 rows per embedded table. The exporter will fail above that limit instead of implementing the initially discussed 2,000-row export ceiling, preserving the approved no-contract-change boundary.
- The original demo kept YAML under `demo/` and assets under `apps/web/public/demo/`. The implementation will consolidate both under `demo/published/` and let Vite emit the validated assets. This keeps the public URL unchanged while making `--apply` a single-directory, rollback-safe replacement.
- The first read-only candidate export stopped before apply because a short Property ID also appeared as ordinary public text. Structural schemas already prohibit Property-ID fields, so exact value matching now follows the existing bundle verifier threshold of eight characters; long identifiers and all source-shaped UUIDs remain fail-closed.
- Added a local-only `demo:export` command. It resolves the ignored Notion configuration with the production read-only adapter, uses an isolated mapping database, exhausts Reader and embedded-table pagination, rewrites public IDs, sanitizes assets, and validates an ignored candidate before optional apply.
- Consolidated publishable input under `demo/published/`. Vite validates this directory and emits only its declared assets; GitHub Actions still receives no Notion credential or ignored configuration.
- Replaced hard-coded demo E2E content assertions with public-snapshot-independent flows while retaining Chromium desktop, WebKit mobile, and Chromium offline coverage.
- Created implementation commit `2747d98` (`feat: export Notion snapshot to static demo`). The pre-commit diff check exposed 11 trailing-space lines created by YAML folding of public text segments.
- Changed YAML serialization to quote strings so meaningful trailing spaces remain part of the parsed Reader DTO without becoming file-level trailing whitespace. Added a round-trip regression assertion, regenerated the snapshot, and committed the correction as `5aff6d3` (`fix: preserve demo text without trailing whitespace`).

## Validation evidence

- Live read-only export: passed with 2 databases, 22 articles, 15 assets, and 1,014,274 output bytes. No Notion write operation or operational Reader database was used.
- Determinism check: a second candidate export matched `demo/published/` exactly with `diff -qr` and exit code 0.
- Focused exporter tests: 6 passed, covering stable ID rewriting, pagination, embedded tables, private-value rejection, SVG rasterization, rollback-safe apply, schema round-trip, and observed identifier tracking.
- `docker compose config --quiet`: passed.
- `npm run check`: passed; 106 tests passed across API, web, and contracts, and all production builds completed.
- Normal E2E: passed in Chromium and WebKit (2 passed).
- Demo E2E: Chromium online/offline and WebKit mobile passed (3 passed); WebKit offline remains intentionally skipped by the existing test matrix.
- `npm run demo:build`, `npm run demo:verify`, and `npm run pages:verify`: passed. Source and built bundle scans found no forbidden API marker, source-shaped Notion ID, signed URL, ignored local value, or secret marker.
- Final post-documentation checks: `git diff --check`, `npm run format:check`, API typecheck, and the 6 focused exporter tests passed.
- `npm audit`: 0 vulnerabilities.
- Non-blocking limitation: Vite reports an approximately 994 kB JavaScript chunk warning. It does not change correctness or the publication boundary.

## Judgment

The tracked snapshot is intentionally public and offline-cacheable. Source credentials, internal Notion identifiers, signed URLs, and ignored mapping configuration remain local. Removing content from Notion later does not remove it from Git history or an already published Pages artifact, so future exports require a rights and scope review before `--apply`.

## Next step

Create local implementation and evidence commits on `main`, then request an independent final review. Archive the active plan only if that reviewer finds no blocking issue. A human may then fast-forward and push `release`.
