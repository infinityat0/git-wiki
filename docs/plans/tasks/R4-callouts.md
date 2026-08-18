# R4 — Callout / Alert Components

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*`

## Scope
- Render the callout nodes emitted by F7's `remark-callouts` into styled blocks: NOTE (blue), TIP (green), WARNING (amber), CAUTION (red) — left border, tinted background, icon, title — with correct light/dark tints per Design.md §3.3.

## Owns
- `client/src/markdown/components/Callout.tsx` + icons (+ test + baseline).

## Acceptance
- L1: each type renders its color/icon/title; nested inline content works. L3 light/dark baseline for `callouts.md`. Coverage guard `callouts` green. (This is F8's worked example — align with it.)

## Read first
- [Design.md §3.3](../../designs/Design.md) · [features spec §3.1](../../specs/wiki-features-specification.md) · fixture `callouts.md`.
