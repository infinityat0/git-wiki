/**
 * F8 — the canonical markdown-element checklist.
 *
 * This is a HAND-MAINTAINED mirror of the element table in
 * `docs/specs/wiki-features-specification.md` §3 (plus internal links §8 and
 * frontmatter §7). It is deliberately independent of `manifest.json`: the
 * coverage guard (`coverage.test.ts`) cross-checks the two, so if the spec grows
 * a new element here but nobody adds its fixture + manifest entry, CI goes red.
 *
 * When the features spec's element table grows, add the id here first; the guard
 * then forces the fixture and manifest entry to follow.
 */
export const SPEC_ELEMENTS = [
  'headings',
  'paragraphs',
  'text-formatting',
  'unordered-lists',
  'ordered-lists',
  'inline-code',
  'code-blocks',
  'tables',
  'blockquotes',
  'images',
  'callouts',
  'iframes',
  'mermaid',
  'math',
  'internal-links',
  'frontmatter',
] as const;

export type SpecElement = (typeof SPEC_ELEMENTS)[number];
