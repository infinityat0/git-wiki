# F2 — Shared API Contract Types (`@wiki/contracts`)

**Area:** foundation · **Milestone:** M0 · **Depends on:** F1 · **Blocks:** all `B*`, F6

This is the linchpin of parallel work: **the frozen interface** both sides build against. Get it right; changing it later ripples.

## Scope
- Define and export TS types for every API payload in [features spec §6](../../specs/wiki-features-specification.md):
  - `TreeNode` (`name`, `path`, `title`, `type`, `order?`, `hidden?`, `children?`).
  - `DocResponse` (`path`, `content`, `lastModified`).
  - `HistoryEntry` (`hash`, `author`, `date`, `message`).
  - `SearchResult` (`path`, `title`, `matches: string[]`).
  - `AuthMe` (`authenticated`, `user?: { name, email, provider: 'github'|'firebase'|'dev', canWrite: boolean }`).
  - `HealthResponse`, `SyncResult`.
  - `ApiError` = `{ error: { code: 'NOT_FOUND'|'UNAUTHORIZED'|'FORBIDDEN'|'CONFLICT'|'SYNC_FAILED'|'VALIDATION'|'INTERNAL', message: string } }`.
- Export route path constants + query/body shapes so client and server can't drift.
- No runtime logic (types + small const maps only).

## Out of scope
- Implementations. Validation schemas *may* be added here as zod if the team wants runtime validation shared — decide and document.

## Owns
- `packages/contracts/**`.

## Acceptance
- Package builds and is importable as `@wiki/contracts` from both `client` and `server`.
- Types exactly match the JSON examples in features spec §6 (reviewer diff-checks).

## Read first
- [features spec §6, §7, §10, §12](../../specs/wiki-features-specification.md).
