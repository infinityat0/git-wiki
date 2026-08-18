# R6 — Images (Asset Resolution) + Internal-Link Rewriting

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*` · **Pairs with:** B4 (asset), U3 (routing)

## Scope
- `img` renderer: relative `src` → `GET /api/asset?path=…`; absolute URLs passed through; centered, rounded, max-width 100%, caption styling.
- `a` renderer: relative `.md` links → SPA routes (§9), preserve `#anchor`; external links untouched; links to nonexistent docs get a **broken-link** affordance (needs the tree to know existence — accept a `docExists(path)` predicate injected by U3/F6).

## Owns
- `client/src/markdown/components/MdImage.tsx`, `MdLink.tsx` (+ tests + baseline).

## Acceptance
- L1: relative img → `/api/asset` URL; relative `.md` link → route; broken link → affordance; anchor preserved. L3 baseline for `images.md`. Coverage guard `images` + `internal-links` green.

## Read first
- [features spec §8, §9](../../specs/wiki-features-specification.md) · fixtures `images.md`, `internal-links.md`.
