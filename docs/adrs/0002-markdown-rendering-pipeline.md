# ADR 0002: Markdown Rendering Pipeline (incl. Embeds, Diagrams & Math)

## Status
Accepted — 2026-08-17.

## Context
The wiki must render markdown with custom callouts, a generated table of contents, syntax-highlighted code, **embedded iframes**, diagrams (mermaid), and math. The renderer choice constrains all of these. We evaluated two families:

- **`markdown-it`** — fast, plugin-rich, but emits an HTML string that React then dangerously sets. Plugin ecosystem is imperative.
- **`react-markdown` + `remark`/`rehype`** — parses to an AST (mdast → hast) and renders to React components. Plugins are composable AST transforms, and we can map any node (e.g. a callout, a mermaid block) to a real React component with no `dangerouslySetInnerHTML` on our own content.

## Decision
Use **`react-markdown`** driven by a **remark → rehype** plugin chain, rendering to React components.

Pipeline:

| Stage | Plugin | Purpose |
| :--- | :--- | :--- |
| remark | `remark-gfm` | Tables, task lists, strikethrough, autolinks |
| remark | `remark-frontmatter` | Parse YAML frontmatter (title, order, etc. — see spec §7) |
| remark | custom `remark-callouts` | Transform `> [!NOTE]`-style blockquotes into callout nodes |
| remark | `remark-math` | Parse `$…$` / `$$…$$` math |
| rehype | `rehype-raw` | Allow the small set of raw-HTML blocks we support (iframes) into the hast tree |
| rehype | `rehype-sanitize` | **Allowlist-based** sanitize — the security boundary (see below) |
| rehype | `rehype-katex` | Render math to KaTeX (CSS-only, no runtime script) |
| rehype | `rehype-slug` + custom TOC extractor | Stable heading ids + TOC data for the right sidebar |
| render | `react-syntax-highlighter` (or Shiki) | Code-block highlighting with language tag + copy button |
| render | `mermaid` (lazy, **`securityLevel: strict`**) | `code.language-mermaid` blocks rendered client-side into sanitized SVG (separate trust boundary — see below) |

### Iframe embedding (explicit requirement)
Authors may embed iframes in markdown (video, dashboards, live examples). Raw `<iframe>` HTML is preserved by `rehype-raw` but must pass `rehype-sanitize` configured to:
- **Allow** `<iframe>` with attributes `src`, `title`, `width`, `height`, `allow`, `loading`, `referrerpolicy`, and a forced `sandbox` value.
- **Force** `sandbox="allow-scripts allow-same-origin allow-popups"` (no `allow-top-navigation`, no `allow-forms` unless explicitly widened) and `loading="lazy"`.
- **Restrict `src` to an allowlist of hosts** (e.g. youtube.com, youtube-nocookie.com, codesandbox.io, and the org's own domains), configured via `IFRAME_ALLOWED_HOSTS`. Non-allowlisted sources render as a placeholder card with the URL, not a live frame.
- **Reject** `srcdoc` (arbitrary inline document) entirely.

The same sanitize pass strips `<script>`, event-handler attributes (`onclick`, …), and `javascript:` URLs everywhere. Because docs content is authored in git by trusted-ish contributors but *rendered for everyone*, we treat it as untrusted at render time. See [security-and-safety spec](../specs/security-and-safety.md).

### Mermaid & client-rendered diagrams (a separate trust boundary)
A ` ```mermaid ` block reaches `rehype-sanitize` as an inert text code block — sanitize sees the *source*, not the SVG. The **mermaid library turns that text into SVG in the browser, after and outside the sanitize pass**, so mermaid is its own trust boundary and must be locked down independently:
- Initialize mermaid with **`securityLevel: 'strict'`** and **`htmlLabels: false`** (no raw HTML in node labels / no `<foreignObject>` HTML injection).
- **Disable interaction directives** — `click`, `callback`, and inline `%%{init}%%` script-ish config that could bind handlers or navigate.
- **Sanitize the generated SVG** before insertion (mermaid bundles DOMPurify at strict level; we additionally never `dangerouslySetInnerHTML` unsanitized diagram output).
- **Diagrams are rendered, never trusted for navigation**: any link a diagram emits is subject to the same URL policy as markdown links.
- **Determinism/theming**: mermaid theme is chosen at render time from the active light/dark palette; a theme toggle **re-renders** affected diagrams. A pinned theme + fixed seed keeps visual baselines stable (testing spec).
- **Errors don't crash the page**: an invalid diagram renders an inline error state, not a thrown exception.

This policy lives in [security-and-safety spec §3.1](../specs/security-and-safety.md), which the mermaid component ([R2](../plans/tasks/R2-mermaid.md)) must satisfy.

## Rationale
- AST + component mapping lets callouts, mermaid, and embeds be real components with our own styling and no ad-hoc string HTML.
- One centralized `rehype-sanitize` config is the single, auditable place where the iframe/embed policy lives.
- KaTeX and mermaid cover the "engineering docs" content we actually publish.

## Consequences
- The sanitize allowlist is security-critical; changes to it require review and a test.
- Mermaid is a heavier client dependency — load it lazily, only when a `mermaid` block is present.
- Mermaid bypasses `rehype-sanitize`, so its `securityLevel: 'strict'` config **is** the security control for diagrams; a config change there needs the same scrutiny (and a test) as a sanitize-allowlist change.
- `react-syntax-highlighter` vs Shiki is left to implementation; Shiki gives VS Code-grade themes at a larger bundle cost. Either satisfies the Design.md code-block spec.
