# Testing Spec: Markdown Rendering Verification

This is the contract for proving that **every markdown element renders correctly** and that **new features are tested against the same standard set by construction**. It is referenced by [features spec §14](wiki-features-specification.md) and implements the pipeline in [ADR-0002](../adrs/0002-markdown-rendering-pipeline.md).

Tooling: **Vitest** (unit / DOM / snapshot) + **Playwright** (visual regression). No Storybook.

## Core principle: one fixture corpus is the source of truth

A single corpus of markdown fixtures (`test/fixtures/markdown/`) drives every level of rendering test. Each element in [features spec §3](wiki-features-specification.md) (plus internal links §8, frontmatter §7) has:
1. a fixture `.md` file,
2. one or more DOM/structure assertions,
3. a visual baseline (light + dark).

A machine-readable **manifest** (`test/fixtures/markdown/manifest.json`) enumerates every element and its fixture. A **coverage-guard test** fails CI if any manifest element lacks a fixture or a visual baseline — so adding a markdown feature *requires* adding its fixture and baseline. That is the mechanism that makes "any new feature tests against these" automatic rather than a matter of memory.

## The three levels

| Level | Tool | What it asserts | When it runs |
| :--- | :--- | :--- | :--- |
| **L1 — DOM structure** | Vitest + `@testing-library/react`, jsdom | Correct elements, classes, and attributes per fixture (e.g. code block has a language tag + copy button; every rendered `<iframe>` has `sandbox` and `loading="lazy"`; `h2/h3` have slug ids). | every commit |
| **L2 — Golden HTML snapshot** | Vitest inline/file snapshots | The rendered HTML for each fixture doesn't change unexpectedly; diffs are reviewed. | every commit |
| **L3 — Visual regression** | Playwright `toHaveScreenshot()` | Actual rendered pixels per element, in **light and dark**, at a fixed viewport. | CI (and on demand) |

L1 catches "structurally wrong," L2 catches "silently changed," L3 catches "looks wrong." All three read the same corpus.

## Security rendering is part of the corpus

`test/fixtures/markdown/security/` holds **malicious inputs** that must be neutralized by the sanitize pass ([security spec §3](security-and-safety.md)). These are asserted at L1 (DOM) with an **inverse expectation** — the dangerous node must be absent/neutralized:

- `<script>` and inline event handlers (`onclick=…`) are stripped.
- `javascript:` URLs are removed.
- An `<iframe>` whose `src` host is not in `IFRAME_ALLOWED_HOSTS` renders as the placeholder card, **not** a live frame.
- `<iframe srcdoc="…">` is rejected entirely.
- An `<iframe>` authored without `sandbox` renders **with** the forced sandbox value.

Each security fixture entry in the manifest carries `expectBlocked` with the specific assertion. These run at L1 only (no visual baseline needed — the point is a node's absence).

## Determinism (visual tests must not flake)

Playwright config for L3 pins everything that could vary:
- **Fonts bundled locally** (Inter, JetBrains Mono) — never fetched over the network during tests.
- Fixed viewport (e.g. `1280×800`) and `deviceScaleFactor: 1`.
- Force `prefers-reduced-motion: reduce` and disable transitions/animations via a test stylesheet.
- Pin the **mermaid** theme + `securityLevel` and a fixed render seed; mermaid output is otherwise nondeterministic.
- Mask dynamic regions (timestamps, git hashes) with Playwright screenshot `mask`.
- Two screenshots per fixture: `data-theme="light"` and `data-theme="dark"`.
- Baselines are committed under `test/visual/__screenshots__/`; updates are an explicit, reviewed `--update-snapshots` change, never automatic.

## Directory layout

```
test/
  fixtures/markdown/
    manifest.json            # element → fixture map; drives the coverage guard
    headings.md  paragraphs.md  text-formatting.md  lists.md
    inline-code.md  code-blocks.md  tables.md  blockquotes.md
    images.md  callouts.md  iframes.md  mermaid.md  math.md
    internal-links.md  frontmatter.md  kitchen-sink.md
    security/
      script-tag.md  event-handler-attr.md  javascript-url.md
      iframe-disallowed-host.md  iframe-srcdoc.md  iframe-missing-sandbox.md
  unit/render/               # L1 + L2 (Vitest)
  visual/                    # L3 (Playwright) + __screenshots__ baselines
```

## Coverage-guard test (illustrative)

```ts
// test/unit/render/coverage.test.ts
import manifest from "../../fixtures/markdown/manifest.json";
import { SPEC_ELEMENTS } from "./spec-elements"; // mirrors features-spec §3

for (const el of SPEC_ELEMENTS) {
  test(`element "${el}" has a fixture`, () => {
    const entry = manifest.elements.find(e => e.id === el);
    expect(entry, `no manifest entry for ${el}`).toBeDefined();
    expect(fs.existsSync(fixturePath(entry!.fixture))).toBe(true);
    if (entry!.visual) expect(hasBaseline(entry!.id)).toBe(true);
  });
}
```
`SPEC_ELEMENTS` is the checklist derived from features-spec §3; extend it when the spec's element table grows, and the guard forces the rest.

## How a new markdown feature is added (the workflow)

1. Add the element to features-spec §3 and to `SPEC_ELEMENTS` / `manifest.json`.
2. Add its fixture `.md` (and, if it can carry unsafe input, a `security/` counter-fixture).
3. Add L1 assertions; run `vitest` to capture the L2 snapshot.
4. Run Playwright to generate the light+dark baseline; commit it.
5. CI green means the new element is covered at all three levels. The coverage guard would have failed if any step were skipped.

## CI wiring (lands at M1, when the renderer exists)

- `vitest run` (L1 + L2 + coverage guard) on every push — fast, no browser.
- `playwright test` (L3) in CI with the bundled-font, reduced-motion, fixed-viewport config; baselines diffed, failures upload the diff image as an artifact.
- The fixture corpus and manifest exist **now** (renderer-agnostic); the harness is wired in milestone M1 ([implementation-plan.md](../plans/implementation-plan.md)).
