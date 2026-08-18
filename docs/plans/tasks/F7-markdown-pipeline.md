# F7 — Markdown Pipeline Core (sanitize/iframe policy, callouts, slug/TOC)

**Area:** foundation · **Milestone:** M1 · **Depends on:** F2 · **Blocks:** all `R*`, U2, U3

Owns the **security boundary** for rendered content. The `R*` components plug component renderers into this pipeline; they do **not** re-implement parsing or sanitize.

## Scope
- `react-markdown` + remark/rehype chain per [ADR-0002](../../adrs/0002-markdown-rendering-pipeline.md): `remark-gfm`, `remark-frontmatter`, custom `remark-callouts`, `remark-math`, `rehype-raw`, **`rehype-sanitize` (central allowlist)**, `rehype-slug`, TOC extractor.
- The **sanitize allowlist is the single source of truth** for the iframe policy: allow `<iframe>` with `src` restricted to `IFRAME_ALLOWED_HOSTS`, forced `sandbox`, `loading=lazy`; reject `srcdoc`; strip `<script>`/`on*`/`javascript:`.
- Expose extension points (a component map) so `R*` can supply `code`, `iframe`, `callout`, `img`, `a` renderers, and a `mermaid`/`math` hook — without touching sanitize.
- Emit TOC data (H2/H3 + slugs) for U2.

## Out of scope
- The visual components themselves (R1–R6) — this card provides the seams + default passthrough.

## Owns
- `client/src/markdown/pipeline.ts`, `client/src/markdown/sanitize.ts`, `client/src/markdown/callouts.ts`, `client/src/markdown/toc.ts`.

## Acceptance
- Runs the **entire** `security/` fixture set green (script/handler/js-url/disallowed-host/srcdoc/missing-sandbox) via L1 assertions.
- Produces slug ids + TOC for `headings.md`.
- The sanitize config change requires a test to change (guarded).

## Read first
- [ADR-0002](../../adrs/0002-markdown-rendering-pipeline.md) · [security-and-safety.md §3](../../specs/security-and-safety.md) · [testing-markdown-rendering.md](../../specs/testing-markdown-rendering.md).
