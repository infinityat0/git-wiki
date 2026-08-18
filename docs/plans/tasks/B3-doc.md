# B3 — `GET /api/doc?path=`

**Area:** backend · **Milestone:** M1 · **Depends on:** F2, F4 · **Parallel-safe with:** all other `B*`

## Scope
- Validate `path` via F4 (`isDoc` + containment). Read the file; return `DocResponse` (`path`, `content`, `lastModified`).
- `404 NOT_FOUND` for missing; `400 VALIDATION` for traversal/non-`.md`.
- Cap response size (config); oversize → friendly `VALIDATION`/`413` with message.

## Owns
- `server/routes/doc.ts`.

## Acceptance
- Path-traversal rejection test (required). Missing file → `NOT_FOUND`. Happy path returns content + mtime.

## Read first
- [features spec §6.0, §6.2](../../specs/wiki-features-specification.md) · [security-and-safety.md §1, §6](../../specs/security-and-safety.md).
