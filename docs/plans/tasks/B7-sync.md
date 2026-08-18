# B7 — `POST /api/sync/pull` + Background Poller

**Area:** backend · **Milestone:** M2 · **Depends on:** F3, B1 (git provider) · **Coordinates with:** B2 (tree invalidation), B6 (reindex)

## Scope
- `POST /api/sync/pull`: run `git pull` (machine credential, via B1's provider) in `REPO_CACHE_DIR`; return `SyncResult` (`success`, `changesPulled`, `log`). On failure → `502 SYNC_FAILED` (or `409 CONFLICT` if blocked by local edits in v1).
- On success, invoke tree-cache invalidation (B2) and search `rebuild()` (B6) via injected hooks — do **not** import their internals; use registered callbacks.
- Background poller every `SYNC_POLL_INTERVAL`s (`0` disables). Run git with a timeout so a hung pull can't wedge the request pool (worker/queue).

## Owns
- `server/routes/sync.ts`, `server/sync/poller.ts`, a small hook registry.

## Acceptance
- Manual pull returns a result; failure maps to the right error code. Poller respects interval and disable. Reindex/invalidation fire on change.

## Read first
- [features spec §4.1, §6.2, §11](../../specs/wiki-features-specification.md) · [ADR-0003](../../adrs/0003-search-engine.md).
