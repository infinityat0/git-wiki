# F6 — Data Layer (React Query + Zustand) + Typed API Client

**Area:** foundation · **Milestone:** M0 · **Depends on:** F2 · **Blocks:** all `U*`

## Scope
- Typed `apiClient` wrapping fetch, returning `@wiki/contracts` types and normalizing `ApiError`.
- React Query hooks: `useTree`, `useDoc(path)`, `useHistory(path)`, `useSearch(q)`, `useAuthMe`, `useHealth` — with query keys, and background refetch of tree/doc after a successful sync.
- Zustand stores: `theme` (coordinates with F5), `authUser` (from `useAuthMe`), `searchOpen`. v1 `editor` store stubbed.
- Expose `status` flags so UI can render loading/empty/error (features spec §10).

## Out of scope
- Rendering (U tasks). Endpoints (B tasks) — mock in tests via MSW or fetch stubs.

## Owns
- `client/src/api/**`, `client/src/stores/**`, `client/src/hooks/**`.

## Acceptance
- Hooks typecheck against `@wiki/contracts`; unit tests cover success + `ApiError` mapping with a mocked transport.

## Read first
- [ADR-0004](../../adrs/0004-frontend-state-management.md) · [features spec §6, §10](../../specs/wiki-features-specification.md).
