/**
 * F7 — Table-of-contents extractor.
 *
 * A rehype (hast) transform that collects H2/H3 headings and their slug `id`s
 * into a caller-supplied accumulator, for the right-hand TOC + scroll-spy (U2).
 * It runs *after* `rehype-slug` so the ids it records are exactly the ids
 * rendered onto the headings — the anchors the TOC links to.
 *
 * The pipeline exposes this as data, not UI: `renderMarkdown`/`<Markdown>`
 * return the `TocEntry[]` alongside the rendered element.
 */

import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import type { Plugin } from 'unified';
import type { Root, Element } from 'hast';

/** One entry in the generated table of contents. */
export interface TocEntry {
  /** The heading slug id (matches the rendered element's `id`). */
  id: string;
  /** The heading's plain-text content. */
  text: string;
  /** Heading depth — 2 for H2, 3 for H3. */
  depth: 2 | 3;
}

/** Mutable accumulator handed to {@link rehypeToc}. */
export interface TocCollector {
  toc: TocEntry[];
}

const HEADING_DEPTH: Record<string, 2 | 3> = { h2: 2, h3: 3 };

/**
 * rehype plugin factory. Pass a `{ toc: [] }` collector; after the tree runs,
 * `collector.toc` holds the ordered H2/H3 entries. Headings without an `id`
 * (should not happen post-`rehype-slug`) are skipped.
 */
export function rehypeToc(
  collector: TocCollector,
): ReturnType<Plugin<[], Root>> {
  return (tree: Root) => {
    // Reset so re-renders with the same collector don't accumulate stale rows.
    collector.toc.length = 0;
    visit(tree, 'element', (node: Element) => {
      const depth = HEADING_DEPTH[node.tagName];
      if (!depth) return;
      const id = node.properties?.id;
      if (typeof id !== 'string' || id.length === 0) return;
      collector.toc.push({ id, text: hastToString(node), depth });
    });
  };
}

export default rehypeToc;
