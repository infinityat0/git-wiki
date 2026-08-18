# Markdown Rendering Fixtures

Canonical corpus for verifying markdown rendering. This is the **source of truth** referenced by
[docs/specs/testing-markdown-rendering.md](../../../docs/specs/testing-markdown-rendering.md).

- One `.md` per element from features-spec §3 (plus `internal-links.md`, `frontmatter.md`).
- `kitchen-sink.md` — all elements on one page (full-page visual baseline + composition smoke test).
- `security/` — malicious inputs that must be **neutralized** by the sanitizer (asserted with inverse expectations).
- `manifest.json` — maps each element → fixture → assertions; drives the coverage-guard test so a new
  element cannot be added without a fixture (and a visual baseline where `visual: true`).

These fixtures are **renderer-agnostic** and exist before the app does. The Vitest (L1/L2) and Playwright
(L3) harnesses that consume them are wired in milestone M1.

To add an element: update features-spec §3 → add its entry to `manifest.json` → add the fixture here →
add L1 assertions + L2 snapshot → generate the L3 baseline. CI's coverage guard fails until all exist.
