# U3 — Content View + Routing/Deep Links + States

**Area:** ui · **Milestone:** M1 · **Depends on:** F5, F6, F7 · **Parallel-safe with:** other `U*` · **Provides:** `docExists` predicate to R6

## Scope
- Client router: URL path mirrors doc path (`/adr/0001-architecture-overview` ↔ `…​.md`); every doc deep-linkable; heading anchors deep-linkable.
- Content zone renders `useDoc(path)` through the F7 pipeline (with `R*` components). Loading skeleton / in-app 404 for unknown route / error+retry (§10).
- Map search-result `path` → route; provide a `docExists(path)` selector (from the tree) for R6 broken-link detection.

## Owns
- `client/src/routes/**`, `client/src/components/DocView/**`.

## Acceptance
- Deep link loads the right doc; unknown route → in-app 404 (not blank); anchor scroll works; states render.

## Read first
- [features spec §9, §10](../../specs/wiki-features-specification.md) · [ADR-0004](../../adrs/0004-frontend-state-management.md).
