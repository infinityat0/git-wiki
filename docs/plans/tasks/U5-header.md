# U5 — Global Header

**Area:** ui · **Milestone:** M1 · **Depends on:** F5, F6 · **Parallel-safe with:** other `U*`

## Scope
- Sticky frosted header (Design.md §2.1): logo/repo title (left), search trigger with ⌘K hint (center, opens U4), sync status + "Sync Now" button (right, `useHealth`/sync), theme toggle (Sun/Moon with rotate/scale transition, reduced-motion aware), mobile menu button that opens U1's drawer.
- Sync button reflects syncing/error (toast on failure, §10).

## Owns
- `client/src/components/Header/**`.

## Acceptance
- Theme toggle flips `.dark` + persists; sync button triggers pull and shows state; icon-only buttons have `aria-label`s; mobile menu opens the sidebar drawer.

## Read first
- [Design.md §2.1, §4.1, §8](../../designs/Design.md) · [features spec §4.1, §10](../../specs/wiki-features-specification.md).
