# U4 — Search Modal

**Area:** ui · **Milestone:** M2 · **Depends on:** F5, F6 · **Parallel-safe with:** other `U*`

## Scope
- ⌘K / `/` opens a centered modal (glass backdrop). Debounced `useSearch`; results with highlighted snippets; "index warming up" when `searchIndex=building`; empty + error states (§10).
- Keyboard: arrows navigate, Enter selects (→ route via U3 mapping), Esc closes. **Focus trap** on open; restore focus to trigger on close.

## Owns
- `client/src/components/SearchModal/**`.

## Acceptance
- Full keyboard flow; focus trap verified; selecting a result navigates. Warming/empty/error states render.

## Read first
- [Design.md §4.2](../../designs/Design.md) · [features spec §6.2, §10, §13](../../specs/wiki-features-specification.md).
