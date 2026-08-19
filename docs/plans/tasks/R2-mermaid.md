# R2 — Mermaid Diagram Component

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*`

## Scope
- Render ` ```mermaid ` fences to inline SVG, **lazy-loading** the mermaid lib only when a mermaid block is present. Map mermaid theme vars to the active light/dark palette. Centered, `max-width:100%`.
- **Security (this is the diagram sanitize boundary — mermaid runs after `rehype-sanitize`):** init with `securityLevel: 'strict'`, `htmlLabels: false`; disable `click`/`callback`; ignore author `%%{init}%%` attempts to widen security/labels; ensure emitted SVG has no script/`foreignObject` HTML. See [security §3.1](../../specs/security-and-safety.md).
- **Theme toggle re-renders** affected diagrams. Use a pinned theme + fixed seed so L3 baselines are deterministic (coordinate with F8 config).
- **Error isolation**: a syntax error renders an inline error card (Design §7), never throws to the page. **Loading**: fixed-height placeholder while the chunk resolves.
- **A11y**: SVG gets `role="img"` + accessible `<title>`/`aria-label`.

## Owns
- `client/src/markdown/components/Mermaid.tsx` (+ tests + baseline).

## Acceptance
- L1: `mermaid.md` fences produce `<svg>`; invalid fixture → error card, page still renders; SVG has `role="img"`+title. L3 light/dark baseline stable across runs. Coverage guard `mermaid` green. Mermaid chunk absent from the initial bundle.
- **Security L1 (required):** the `security/mermaid-injection.md` fixture (HTML label + `click` handler + `%%{init}%%` downgrade) renders safe SVG — no `<script>`, no `on*`, no `foreignObject` HTML, no click/navigation binding.

## Read first
- [ADR-0002 "Mermaid & client-rendered diagrams"](../../adrs/0002-markdown-rendering-pipeline.md) · [security-and-safety.md §3.1](../../specs/security-and-safety.md) · [Design.md §7](../../designs/Design.md) · fixtures `mermaid.md`, `security/mermaid-injection.md`.
