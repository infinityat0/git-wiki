# U6 — Git History Drawer

**Area:** ui · **Milestone:** M2 · **Depends on:** F5, F6 · **Parallel-safe with:** other `U*`

## Scope
- A drawer/panel showing `useHistory(currentDoc)` — timestamp, author, message per commit. Skeleton / "No history" / error+retry (§10). Opened from a control in the doc view or header.

## Owns
- `client/src/components/HistoryDrawer/**`.

## Acceptance
- Lists commits for the active doc; empty and error states render; keyboard-dismissible; focus handled.

## Read first
- [features spec §4.1 (Git History), §6.2, §10](../../specs/wiki-features-specification.md).
