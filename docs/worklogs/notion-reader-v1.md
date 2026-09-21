# Notion Reader v1 Worklog

## 2026-09-20 — Implementation started

**Status:** In progress

The approved plan was translated into a Docker-first TypeScript workspace design. The repository initially
contained only agent administration files; Node.js is not installed on the host, Docker Desktop is installed
but its daemon is stopped, and Tailscale CLI is not currently available on `PATH`.

Decisions fixed for implementation:

- Use a fixture-backed secure vertical slice before live Notion access.
- Track planning and worklog documents under `docs/`.
- Keep actual YAML, secrets, and SQLite data outside Git.
- Use a fixed 24-hour session lifetime and same-origin production delivery.

Next: implement contracts, backend security/data boundaries, PWA views, and automated tests; then run the
available quality gates and record validation evidence.

## 2026-09-21 — v1 implementation ready for external checks

**Status:** Automated implementation complete; active plan retained for manual checks and independent review.

The six implementation stages are present as one Docker-first TypeScript workspace. The fixture path now
supports the complete reader flow, while the production adapter uses the official Notion SDK with API version
`2026-03-11`. Browser-facing contracts contain only Reader IDs and normalized values; source object IDs,
credentials, and raw Notion responses remain behind the API.

Implemented scope:

- Added Node 24.21.0, npm workspaces, strict TypeScript, Docker Compose, Dev Container, Biome, Vitest,
  Testing Library, and Playwright infrastructure.
- Added strict YAML configuration, startup validation for templates/sorts/filters, example fixture and Notion
  configurations, SQLite migrations, opaque Reader IDs, and content-free persistence.
- Added Argon2id password verification, hashed 256-bit sessions with fixed 24-hour expiry, production
  `__Host-` cookies, same-origin mutation checks, rate limiting, security headers, redacted structured logs,
  and `no-store` API responses.
- Added fixture and Notion adapters, Data Source query pagination, relation allowlists and request
  deduplication, property/cardinality resolution, structured block conversion, expiring asset refresh/proxy,
  configured sort/filter handling, and public-safe upstream error categories.
- Added the React reader flow, Simple and Compact Emblem headers, shared article renderer, responsive and
  reduced-motion behavior, title/tag search, Reader-ID-only template preference and recent history, and
  logout cleanup.
- Added a static-only service worker, explicit API `NetworkOnly`, 192/512 PNG manifest icons, Apple touch
  icon, same-origin production serving, and local-only Tailscale Serve instructions.

Security judgment calls:

- Relation failures outside configured content/relation sources are omitted instead of exposing existence or
  upstream error details. Top-level Notion 404, rate limit, timeout, and availability errors are converted to
  Reader-owned categories.
- The browser never chooses a Notion endpoint, object ID, or property ID. Search accepts only configured
  Reader database/field IDs and operators.
- SQLite stores resource mappings, asset mappings, and session token hashes only. Automated inspection
  confirms fixture titles and property values are absent from the database.
- A production audit initially found vulnerable `@fastify/static` and development Vitest versions. They were
  upgraded to `@fastify/static` 10.1.4 and Vitest 5.0.1; the final npm audit reports zero vulnerabilities.
- PWA raster assets are mechanical Chromium renders of the tracked SVG emblem, so raster fallbacks remain
  visually aligned with the editable source.

Validation evidence:

- `npm run check`: passed format check, lint, strict typecheck, 27 unit/component/contract tests, and
  production builds on the portable Node 24.21.0 toolchain.
- `npm run e2e`: passed the login → library → article → template switch → tag search → recent → logout flow
  in Chromium desktop and WebKit iPhone profile.
- `docker compose config --quiet`: passed.
- Docker Desktop became available during final validation; development and production images both built
  successfully with Docker Server 29.6.1.
- `docker compose run --rm app npm run check`: passed in the Node 24.21.0 development container.
- `docker compose run --rm app npm run e2e`: passed in containerized Chromium and WebKit.
- Production multi-stage image build: passed, including its internal quality gate and production dependency
  prune. A localhost smoke returned 200 for `/api/health`, `/`, and `/manifest.webmanifest`; API responses
  used `Cache-Control: no-store`; login returned a Secure, HttpOnly, SameSite=Strict, Path=/,
  `__Host-reader_session` cookie with Max-Age 86400.
- `npm audit` and `npm audit --omit=dev`: zero known vulnerabilities after dependency updates.
- Generated icon dimensions were inspected as 180×180, 192×192, and 512×512. The built manifest declares
  standalone display, raster fallbacks, and a maskable 512×512 icon.

Remaining external checks:

- Run a read-only live smoke with a real Notion Internal Connection and configured Data Source/Property IDs.
  No credentials were available during implementation.
- Verify Windows Edge/Chrome installation and physical iOS Safari/Home Screen behavior over HTTPS. The
  WebKit mobile profile is automated evidence, not a substitute for physical-device acceptance.
- Install/login to Tailscale on the Windows host and verify `tailscale serve --bg 3000` inside the intended
  tailnet. Tailscale was intentionally not installed automatically.
- Obtain an independent final diff/evidence review. Under the agile-review policy, this primary implementing
  agent must not archive the plan; it remains under `docs/plans/active/` until that review and the manual
  checks approve completion.

Next: perform the credentialed Notion and physical-device checks, then hand the final diff and this evidence
to an independent reviewer. The next stage should stay in PLAN mode because live data or device evidence may
change deployment/security priorities.

## 2026-09-21 — Checkpoint committed

**Status:** Awaiting local Notion and Tailscale prerequisites.

The approved live-acceptance plan was started from a clean secrets boundary. The `.env/` directory was absent,
and a pattern scan of the complete staged diff found no populated Notion token, password hash, bearer token, or
known Notion token prefix. The implementation was committed locally as
`9cd8d8836abba42e35640ed05a5eb89624ff4cea` (`feat: implement read-only Notion Reader v1`). No remote publication
was performed.

Checkpoint validation:

- `git diff --cached --check`: passed after replacing two Markdown hard-break spaces with paragraph breaks.
- `docker compose config --quiet`: passed.
- `docker compose run --rm app npm run check`: passed all formatting, lint, strict type checking, 27 tests, and
  production builds.
- `docker compose run --rm app npm run e2e`: passed Chromium desktop and WebKit mobile profiles.
- `docker compose run --rm app npm audit`: reported zero vulnerabilities.
- Branch `main` was clean and one commit ahead of `origin/main` immediately after the checkpoint.

Next: the user creates the read-only Notion connection and ignored `.env/` configuration, and installs and logs
in to Tailscale on Windows and iOS. Once the user reports only that these prerequisites are ready, the bounded,
documented production smoke can proceed directly without another planning pass. The active plan must remain
unarchived until the live/device evidence and independent review both pass.

## 2026-09-21 — Configuration reference added

**Status:** Awaiting correction of the local password-hash quoting before further Compose runs.

README now documents every Reader YAML section, the distinction between normalized Reader `type` and Notion
filter `sourceType`, supported Property mappings, relation cardinality, filter operators, sort fields, strict
validation, and the current non-enforcing behavior of `required`.

While checking the documentation, Docker Compose warned that dollar-prefixed segments of the locally supplied
Argon2id hash were being interpreted as environment-variable references. The ignored secret file was not read,
and no complete hash or password was copied into tracked files. The tracked environment example and README now
require the complete hash to be enclosed in single quotes so Compose passes each `$` literally. Because warning
output contained partial hash material, the user should generate a fresh hash locally after correcting the
quoting and before the production smoke.

Validation:

- `git diff --check`: passed.
- The repository Biome configuration does not process Markdown or `.env` examples; the earlier full format gate
  passed before this documentation-only change.

Next: the user replaces the local `READER_PASSWORD_HASH` with a freshly generated, single-quoted full Argon2id
hash. After the user confirms that correction without sharing its value, the production smoke can proceed
directly.

## 2026-09-21 — Credentialed production startup

**Status:** Production is running on loopback; authenticated Notion UI verification remains.

The user completed the ignored Notion YAML and environment settings. Structural checks confirmed that both
files are ignored, the Argon2id hash is complete and single-quoted, and Compose parses the configuration without
interpolation warnings. Secret values and configured Notion IDs were not printed.

The first production start exposed a Docker storage defect rather than a YAML defect: development and
production shared one named SQLite volume, which had been initialized with permissions incompatible with the
production image's unprivileged `node` user. Startup failed with `SQLITE_CANTOPEN`. Compose now uses separate
development and production named volumes. The existing development volume was retained, no volume was deleted,
and README explains the persistence boundary and the effect of `docker compose down --volumes`.

Validation after the fix:

- Production image build passed the complete formatting, lint, strict type checking, 27-test, build, prune, and
  zero-vulnerability audit gates.
- The production container remains running with port 3000 bound only to `127.0.0.1`.
- `GET /api/health` returned 200, `source: notion`, and `Cache-Control: no-store`.
- Unauthenticated `GET /api/databases` returned 401 with `Cache-Control: no-store`.
- `/`, `/manifest.webmanifest`, and `/sw.js` returned 200 with their expected content types.
- Read-only SQLite inspection found only `resources` and `sessions`; both were empty before login. The temporary
  audit script was removed from both the workspace and container.
- Exact-match inspection found no configured token, password hash, Data Source ID, or Property ID in production
  logs.

Next: the user opens `http://127.0.0.1:3000`, logs in locally, and checks whether the configured Notion database
and an article load successfully. This bounded live smoke can proceed directly; any Property type/cardinality or
connection-scope mismatch must be reported without sharing source IDs or content.

## 2026-09-21 — Live Notion configuration diagnosis

**Status:** Blocked on two local YAML corrections and relation-source access.

The user successfully logged in and loaded the Reader shell. Session creation and `GET /api/databases` returned
success, while the first Notion-backed article-list and search requests returned 500. Route-only log inspection
confirmed that the failure begins at the upstream query boundary rather than in authentication or public
database configuration.

A temporary read-only schema diagnostic found that the content `sourceDataSourceId` and `titlePropertyId` still
contain example placeholders. It also found that the configured relation source is not accessible to the
Internal Connection. The likely relation causes are a missing **Add connections** share, use of a Database ID
instead of its Data Source ID, or selection of the wrong source. No token, article body, Property value, or full
password hash was printed or persisted. The diagnostic scripts were deleted from both workspace and container.

The Notion SDK emitted one configured relation source ID in its own warning before the temporary diagnostic
could redact it. The ID is not an authentication credential and the token was not exposed, but it is treated as
a privacy-boundary deviation and will not be reproduced in tracked evidence. Future live diagnostics must
suppress or capture the SDK logger before invoking it.

Next: the user replaces the two remaining placeholders with the actual content Data Source ID and title Property
ID, verifies that every configured relation source is a Data Source ID, and adds the Internal Connection directly
to each required source. After a restart, the primary agent will rerun the live smoke using only redacted
application logs.

## 2026-09-21 — Data Source access verified

**Status:** Upstream query works; non-title Property mappings require correction.

After the user replaced Database/example identifiers with Data Source identifiers, production restarted cleanly
with no remaining placeholders. A read-only diagnostic with the Notion SDK logger disabled verified all of the
following without printing source IDs, Property names, or content:

- The configured content Data Source is retrievable by the Internal Connection.
- The configured title Property exists and has Notion type `title`.
- The content Data Source can be queried both without sort and with the configured sort.
- The configured relation Data Source is retrievable by the Internal Connection.

The same schema comparison found that every configured non-title Property ID is absent from the selected content
Data Source schema. It also found incorrect configured types: `mainClass` and `subClass` use `string` rather than
`reference`, `codeName` uses `reference` rather than `string`, and the `mainClass` filter uses `rich_text` rather
than `relation`. The temporary diagnostic script was removed from workspace and container after the check.

Next: the user copies the actual Property IDs from the selected content Data Source schema and restores the
Reader/Notion type mappings documented in README. After another restart, the primary agent will verify article
list, detail mapping, relation resolution, and search through the application boundary.

## 2026-09-21 — Property names resolved locally

**Status:** Production restarted with schema-verified Property IDs; browser recheck remains.

Manual Property ID collection proved unnecessarily difficult. A one-time local resolver therefore treated each
configured `propertyId` as either an existing ID or an exact Property name within its already selected content
Data Source. Names are scoped per Data Source, so identical names in another source cannot collide. The resolver
required both an exact name match and a compatible Notion type before writing; any issue would have prevented all
changes.

Six mappings were resolved successfully without printing names, IDs, token, or content. Schema verification
confirmed `mainClass` and `subClass` as `rich_text`, `codeName` as `relation`, and `tags` as `multi_select`, matching
the user's intentional Reader configuration. The previous ignored YAML was copied to `.env/reader.yaml.bak`.
The temporary resolver was then deleted rather than added as an undocumented production interface.

Compose validation passed, production restarted with zero placeholders, and `/api/health` again returned 200,
`source: notion`, and `Cache-Control: no-store` on the loopback-only listener.

Next: the user reloads the Reader and checks article list, one article detail, relation-backed `codeName`, tag
search, and logout. If the one-time resolver proves useful for additional databases, promote it separately to a
tested, documented setup command rather than retaining ad hoc scripts.

## 2026-09-21 — Property resolver formalized

**Status:** Resolver complete and live data retrieval confirmed; device acceptance remains.

The user confirmed that the Reader could retrieve and display the configured Notion data after local name
resolution. The temporary approach was promoted to the documented `npm run config:resolve` setup command without
changing the production YAML schema or browser API.

The command scopes exact, case-sensitive Property-name matching to each selected content Data Source, preserves
existing IDs, validates all Reader/Notion type pairs, and performs no write if any mapping is missing or
incompatible. A successful change creates `.env/reader.yaml.bak` and atomically replaces the ignored YAML. SDK
logging is suppressed, and command summaries contain only Reader field paths, types, counts, and safe error
categories—not names, IDs, token, or content.

Validation evidence:

- Focused resolver tests cover identical names in separate Data Sources, type mismatch redaction, atomic write
  with backup, and all-or-nothing failure behavior.
- Running `docker compose run --rm app npm run config:resolve` against the already resolved live configuration
  returned zero changes and zero issues, confirming idempotence without printing source identifiers.
- `docker compose run --rm app npm run check` passed formatting, lint, strict type checking, 31 tests, and all
  production builds.
- `docker compose run --rm app npm run e2e` passed the Chromium desktop and WebKit mobile reader flows.

Next: continue the approved Windows browser, Tailscale HTTPS, and physical iOS/Home Screen acceptance. The active
plan remains unarchived until those checks and the independent final review pass.
