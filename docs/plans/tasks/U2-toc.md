# U2 — Right Table of Contents + Scroll-Spy

**Area:** ui · **Milestone:** M1 · **Depends on:** F5, F7 (TOC data) · **Parallel-safe with:** other `U*`

## Scope
- Render H2/H3 TOC (from F7's TOC extractor) in the shell's right zone; highlight the active section on scroll (IntersectionObserver). Hidden on mobile, sticky ≥1024px.
- Clicking an item deep-links to the heading slug; respects reduced-motion for smooth scroll.

## Owns
- `client/src/components/Toc/**`.

## Acceptance
- Active heading tracks scroll; clicking updates the URL hash and scrolls. Collapses per breakpoint.

## Read first
- [features spec §2.2 (TOC), §9](../../specs/wiki-features-specification.md) · [Design.md §2](../../designs/Design.md).
