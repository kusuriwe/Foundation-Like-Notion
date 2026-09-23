# Notion static demo export

Status: completed and independently reviewed on 2026-09-23

## Goal

Export the Reader view produced by the ignored local Notion configuration into the tracked static demo without publishing Notion credentials, source identifiers, signed URLs, or private mapping configuration.

## Implementation contract

- Run the export locally through Docker. GitHub Actions continues to build only committed static demo files and receives no Notion secrets.
- Resolve the current Notion configuration with the same read-only client and mapping rules as the server.
- Enumerate configured databases and articles, exhaust embedded-table pagination, download assets, and produce validated public Reader DTOs.
- Keep a dedicated ignored SQLite mapping under `.data/demo-export/` so repeated exports retain stable opaque public IDs without changing the operational Reader database.
- Rewrite every database, article, relation, asset, and embedded-table identifier to a `demo_` identifier.
- Keep the complete publishable input under `demo/published/`, including article YAML and assets. Vite emits those assets into the static bundle, so an ignored candidate can replace one tracked directory atomically.
- Generate an ignored candidate first. Apply it to `demo/published/` only with an explicit `--apply` flag and only after schema and leak validation succeeds.
- Re-encode display images to remove metadata and active SVG content. Store general file blocks as inert `.bin` downloads.
- Fail closed on limits, partial pagination, unavailable required content, unsafe assets, or any detected secret/source identifier.
- Preserve the existing public contract limit of 500 rows per embedded table; do not widen the DTO solely for export.
- Preserve the normal API, Reader DTOs, SQLite schema, read-only boundary, and Pages workflow without adding GitHub Secrets.

## Acceptance

- Unit coverage includes pagination, ID rewriting and stability, recursive assets, embedded tables, limits, failed atomic apply, and redacted diagnostics.
- The source snapshot and final bundle contain no local secrets, Notion API markers, source identifiers, or signed URLs.
- Normal and demo checks/E2E, Pages workflow verification, Compose validation, and npm audit pass.
- A read-only live export and local Pages-equivalent preview succeed without changing Notion or the normal Reader database.
- An independent reviewer approves the final diff and evidence before this plan is archived.

## Publication

Implementation is committed locally on `main`. A human may then fast-forward `release` and push it; coding agents do not push branches or tags.
