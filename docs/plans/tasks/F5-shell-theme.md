# F5 — Design Tokens, App Shell Layout, Theme Provider

**Area:** foundation · **Milestone:** M0 · **Depends on:** F1 · **Blocks:** all `U*`

## Scope
- Implement the CSS custom properties (light + `.dark`) exactly from [Design.md §1](../../designs/Design.md); bundle Inter + JetBrains Mono **locally** (needed for deterministic visual tests, F8/L3).
- App shell: the four-zone grid (header / left sidebar / content / right TOC) with the dimensions and breakpoints in [Design.md §2](../../designs/Design.md). Zones are empty slots that `U*` fill.
- Theme provider: persist to `localStorage`, apply `.dark` on `<html>` **before first paint** (no flash), honor `prefers-reduced-motion` globally (Design §4.3).

## Out of scope
- Contents of any zone (U1–U7).

## Owns
- `client/src/styles/tokens.css`, `client/src/app/Shell.tsx`, `client/src/theme/**`, bundled font assets.

## Acceptance
- Shell renders responsive across the three breakpoints (Playwright smoke, both themes).
- No network font requests at runtime (asserted).

## Read first
- [Design.md §1, §2, §4, §8](../../designs/Design.md).
