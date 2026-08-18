# U1 — Left Sidebar Navigation Tree

**Area:** ui · **Milestone:** M1 · **Depends on:** F5, F6 · **Parallel-safe with:** other `U*`

## Scope
- Render the tree from `useTree` into the shell's left zone. **Labels are `title`, never filename** (features spec §7); truncate long titles with ellipsis + `title` tooltip.
- All-caps directory group headers; nested indentation per level; hover + active states (active uses text-shadow trick to avoid width shift) per Design.md §3.1.
- Loading skeleton / empty ("No documents yet") / error states (§10).

## Owns
- `client/src/components/Sidebar/**`.

## Acceptance
- Titles shown (asserted against a filename-y fixture). States render. Keyboard reachable, `:focus-visible` rings. Mobile: converts to the drawer (U5 triggers it) — expose an open/close store field.

## Read first
- [Design.md §3.1, §8](../../designs/Design.md) · [features spec §7, §10](../../specs/wiki-features-specification.md).
