# B6 — `GET /api/search?q=` (MiniSearch)

**Area:** backend · **Milestone:** M2 · **Depends on:** F2 · **Parallel-safe with:** all other `B*`

## Scope
- Build an in-memory MiniSearch index over `REPO_CACHE_DIR`: index `{ path, title, headings, body }` with field boosts (title>headings>body). Strip markdown to text for the body.
- `GET /api/search` → `SearchResult[]` with highlighted `matches` snippets. Cap query length.
- Expose index state (`ready`/`building`) via the shared readiness flag (B1 health) and a `rebuild()` the sync worker (B7) calls on startup + after each pull.

## Owns
- `server/search/index.ts`, `server/routes/search.ts`.

## Acceptance
- Query returns ranked results with snippets; respects `hidden`. Reindex is invoked on startup and exposed for B7. Server-side only (no corpus shipped to client).

## Read first
- [ADR-0003](../../adrs/0003-search-engine.md) · [features spec §6.2](../../specs/wiki-features-specification.md).
