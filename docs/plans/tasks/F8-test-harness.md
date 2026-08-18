# F8 — Vitest + Playwright + Coverage-Guard Wiring

**Area:** foundation · **Milestone:** M1 · **Depends on:** F1 · **Blocks:** all `R*` (baselines)

Turns the existing fixture corpus + manifest into running gates.

## Scope
- Vitest config (jsdom) for L1 (DOM) + L2 (snapshot); a helper that renders a fixture through the F7 pipeline.
- The **coverage-guard test** (`test/unit/render/coverage.test.ts`) reading `test/fixtures/markdown/manifest.json` and `SPEC_ELEMENTS` — fails if any element lacks a fixture, or `visual:true` without a baseline. (Decide with maintainer: hand-maintained `SPEC_ELEMENTS` vs deriving it by parsing features-spec §3.)
- Playwright config for L3 with the determinism rules from the testing spec: bundled fonts, fixed `1280×800`, `deviceScaleFactor:1`, forced reduced-motion, pinned mermaid theme, timestamp masking, light+dark screenshots. Baselines under `test/visual/__screenshots__/`.
- CI: `vitest run` job + `playwright test` job (uploads diff artifacts on failure).

## Out of scope
- Per-element assertions/baselines — each `R*` adds its own; this card provides the machinery + one worked example (e.g. `callouts`).

## Owns
- `vitest.config.ts`, `playwright.config.ts`, `test/unit/render/harness.ts`, `test/unit/render/coverage.test.ts`, `test/unit/render/spec-elements.ts`, `test/visual/**` scaffolding, CI job files.

## Acceptance
- With F7 present, the `callouts` worked example passes at L1+L2+L3.
- Coverage guard currently **red** for not-yet-built elements is expected and documents remaining `R*` work; it goes green as `R*` land.

## Read first
- [testing-markdown-rendering.md](../../specs/testing-markdown-rendering.md) · `test/fixtures/markdown/manifest.json`.
