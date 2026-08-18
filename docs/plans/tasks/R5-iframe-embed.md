# R5 — Iframe Embed + Disallowed-Host Placeholder

**Area:** render · **Milestone:** M1 · **Depends on:** F7, F8 · **Parallel-safe with:** other `R*`

Security-sensitive. The **policy** (allowlist, forced sandbox, srcdoc rejection) lives in F7's sanitize; this card is the **visual** layer for what survives sanitize + the placeholder for what doesn't.

## Scope
- Render allowlisted iframes inside a responsive 16:9 container (Design.md §7), preserving the forced `sandbox` + `loading=lazy` set by F7.
- Render a **placeholder card** (link icon + URL + "External embed not on allowlist") for sources F7 flagged as disallowed.

## Owns
- `client/src/markdown/components/Embed.tsx`, `EmbedPlaceholder.tsx` (+ test + baseline).

## Acceptance
- L1: allowlisted → live iframe with sandbox + lazy; disallowed-host + srcdoc fixtures → placeholder/absent (assert against `security/iframe-*` fixtures too). L3 baseline for `iframes.md`. Coverage guard `iframes` green.

## Read first
- [ADR-0002](../../adrs/0002-markdown-rendering-pipeline.md) · [security-and-safety.md §3](../../specs/security-and-safety.md) · [Design.md §7](../../designs/Design.md) · fixtures `iframes.md`, `security/iframe-*.md`.
