## Repository Context

- This repository implements a personal, read-only Notion reader delivered as a PWA for Windows and iOS.
- Treat the documents under `dev-docs/` as the current product requirements and design references unless the user gives newer direction.
- Keep Notion access behind the backend. Never expose Notion integration tokens, page IDs, database IDs, or direct Notion API access to browser code.
- Preserve the read-only product boundary: do not add Notion write, comment, page-creation, or database-creation behavior without explicit user approval.
- Keep secrets and machine-local configuration under `.env/`; never commit their contents.
