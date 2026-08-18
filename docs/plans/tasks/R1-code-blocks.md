# R1 — Code Block Component

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*`

## Scope
- Provide the `code`/`pre` renderer for the F7 pipeline's component map: syntax highlighting (Shiki or react-syntax-highlighter — pick per ADR-0002 note), a language tag, a hover "Copy" button with "Copied!" feedback, always-dark frame, custom scrollbars.

## Owns
- `client/src/markdown/components/CodeBlock.tsx` (+ its test + baseline).

## Acceptance
- L1: language tag + copy button present; block has the dark frame class. L2 snapshot. L3 light/dark baseline for `code-blocks.md`. Coverage guard `code-blocks` green.

## Read first
- [Design.md §3.2](../../designs/Design.md) · fixture `test/fixtures/markdown/code-blocks.md` · manifest entry `code-blocks`.
