# Notion Reader v1 Implementation Plan

**Status:** Active

**Approved:** 2026-09-20

**Source requirements:** `dev-docs/notion_reader_v1_requirements.md`

**Implementation status (2026-09-21):** Automated implementation and fixture acceptance are complete.
Credentialed Notion, physical iOS/Home Screen, and Tailscale Serve acceptance passed. The first independent
review returned three medium boundary findings concerning SDK logging, upstream cursors, and typed filter
values. Corrective implementation and the short live smoke are complete; the plan remains active pending a
fresh independent final review.

## Goal

Build a single-user, read-only Notion Reader delivered as a Windows/iOS PWA. The backend is the security
boundary and converts allowlisted Notion data into Reader-owned contracts. Notion content is never persisted.

## Stages

1. Establish the Docker-first TypeScript workspace, quality gates, config validation, SQLite migrations,
   documentation, and health endpoint.
2. Complete an authenticated fixture-backed vertical slice from login through Simple article rendering.
3. Add the official Notion adapter, Reader IDs, property/relation resolution, structured blocks, and assets.
4. Add list navigation, configured sorting, Simple and Compact Emblem templates, switching, and responsive UI.
5. Add allowlisted title/property search and device-local recent history.
6. Add static-only PWA caching, production image, Tailscale instructions, and the v1 security/acceptance pass.

## Fixed decisions

- Node.js 24.21.0, npm workspaces, strict TypeScript, Fastify, React/Vite, Zod, SQLite.
- Docker/Dev Container first; no automated host software installation.
- Fixture adapter before live Notion; Notion API version `2026-03-11`.
- YAML configuration plus SQLite for opaque IDs and 24-hour server-side sessions only.
- Same-origin production delivery; no generic Notion proxy and no persistent content cache.

## Completion rule

Keep this plan active until implementation, quality gates, manual device checks, and an independent final review
are complete. Record evidence and unresolved limitations in `docs/worklogs/notion-reader-v1.md`.
