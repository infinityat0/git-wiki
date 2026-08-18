# R3 — Math (KaTeX) Rendering

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*`

## Scope
- Wire `rehype-katex` (CSS-only, no runtime script) into the F7 pipeline for inline `$…$` and block `$$…$$`. Bundle KaTeX CSS locally. Block math centered; wide math scrolls horizontally.

## Owns
- `client/src/markdown/components/Math.tsx` (or pipeline glue) + KaTeX CSS asset (+ test + baseline).

## Acceptance
- L1: inline + block math render KaTeX markup, no `<script>`. L3 light/dark baseline for `math.md`. Coverage guard `math` green.

## Read first
- [ADR-0002](../../adrs/0002-markdown-rendering-pipeline.md) · [Design.md §7](../../designs/Design.md) · fixture `math.md`.
