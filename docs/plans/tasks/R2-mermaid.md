# R2 — Mermaid Diagram Component

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*`

## Scope
- Render ` ```mermaid ` fences to inline SVG, **lazy-loading** the mermaid lib only when a mermaid block is present. Map mermaid theme vars to the active light/dark palette. Centered, `max-width:100%`.
- Use a **pinned theme + fixed seed + `securityLevel`** so L3 baselines are deterministic (coordinate with F8 config).

## Owns
- `client/src/markdown/components/Mermaid.tsx` (+ test + baseline).

## Acceptance
- L1: `mermaid.md` fences produce `<svg>`. L3 light/dark baseline stable across runs. Coverage guard `mermaid` green. Mermaid chunk is not in the initial bundle.

## Read first
- [ADR-0002](../../adrs/0002-markdown-rendering-pipeline.md) · [Design.md §7](../../designs/Design.md) · fixture `mermaid.md`.
