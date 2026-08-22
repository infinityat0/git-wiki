/**
 * F7 — Markdown pipeline core.
 *
 * Assembles the remark → rehype plugin chain from ADR-0002 and enforces the
 * iframe embed policy. The ordering here is a security contract:
 *
 *   remark: gfm → frontmatter → callouts → math
 *   rehype: raw → **iframe-policy** → **sanitize** → katex → slug → toc
 *
 * `rehype-raw` first turns the small set of allowed raw-HTML blocks (iframes)
 * into real hast nodes. `rehype-iframe-policy` then forces `sandbox`/`loading`,
 * drops `srcdoc`, and swaps any non-allowlisted host for a placeholder — so by
 * the time `rehype-sanitize` (the allowlist boundary) runs, every iframe is
 * already safe, and sanitize is the backstop. `rehype-katex` runs *after*
 * sanitize (its output is trusted, CSS-only). `rehype-slug` + the TOC extractor
 * run last so heading ids are clean (sanitize's `clobberPrefix` never touches
 * them).
 *
 * This module owns the plugin arrays and the iframe transform; it deliberately
 * carries no JSX. The React seam lives in `Markdown.tsx` / `components.tsx`.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import { visit, SKIP } from 'unist-util-visit';
import type { PluggableList, Plugin } from 'unified';
import type { Root, Element, ElementContent, Properties } from 'hast';

import { remarkCallouts } from './callouts.js';
import { rehypeToc, type TocCollector, type TocEntry } from './toc.js';
import {
  sanitizeSchema,
  FORCED_SANDBOX,
  FORCED_LOADING,
  isAllowedIframeSrc,
} from './sanitize.js';

/** Why an iframe was replaced by a placeholder — surfaced to the R5 renderer. */
export type IframeBlockReason = 'host' | 'srcdoc';

function asString(value: Properties[string]): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Build the placeholder card node shown in place of a blocked iframe. */
function placeholder(
  src: string | undefined,
  reason: IframeBlockReason,
): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['iframe-placeholder'],
      dataIframePlaceholder: 'true',
      dataIframeSrc: src ?? '',
      dataIframeReason: reason,
    },
    children: src ? [{ type: 'text', value: src }] : [],
  };
}

/**
 * Rebuild an allowlisted iframe's attributes from scratch: keep only the safe
 * surface, force `sandbox` + `loading`, and drop everything else (`srcdoc`,
 * any `on*` handler, author-widened sandbox, styles). Mutates in place.
 */
function normalizeAllowedIframe(node: Element): void {
  const p: Properties = node.properties ?? {};
  const src = asString(p.src);
  const clean: Properties = {
    src: src ?? '',
    loading: FORCED_LOADING,
    // hast stores space-separated tokens as arrays; renders as the joined
    // `sandbox="allow-scripts allow-same-origin allow-popups"`.
    sandbox: FORCED_SANDBOX.split(' '),
    className: ['iframe-embed'],
  };
  if (p.title != null) clean.title = p.title;
  if (p.width != null) clean.width = p.width;
  if (p.height != null) clean.height = p.height;
  if (p.allow != null) clean.allow = p.allow;
  if (p.referrerPolicy != null) clean.referrerPolicy = p.referrerPolicy;
  node.properties = clean;
}

/**
 * The iframe embed policy — the runtime half of the security boundary that a
 * static sanitize allowlist cannot express (host allowlist, forced attribute
 * values, srcdoc rejection). Runs after `rehype-raw`, before `rehype-sanitize`.
 */
export const rehypeIframePolicy: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'iframe') return;
      if (!parent || typeof index !== 'number') return;

      // `srcdoc` (arbitrary inline document) is rejected entirely.
      if (node.properties?.srcDoc != null) {
        (parent.children as ElementContent[])[index] = placeholder(
          asString(node.properties?.src),
          'srcdoc',
        );
        return [SKIP, index];
      }

      const src = asString(node.properties?.src);
      if (!isAllowedIframeSrc(src)) {
        (parent.children as ElementContent[])[index] = placeholder(src, 'host');
        return [SKIP, index];
      }

      normalizeAllowedIframe(node);
      return SKIP;
    });
  };
};

/** The remark (mdast) half of the chain, in order. */
export function buildRemarkPlugins(): PluggableList {
  return [
    remarkGfm,
    // Parse but do not render YAML frontmatter (title/order live in §7).
    [remarkFrontmatter, ['yaml']],
    remarkCallouts,
    remarkMath,
  ];
}

/**
 * The rehype (hast) half of the chain, in order. `toc` is a caller-owned
 * accumulator that the extractor fills as a side effect of rendering.
 */
export function buildRehypePlugins(toc: TocCollector): PluggableList {
  return [
    rehypeRaw,
    rehypeIframePolicy,
    [rehypeSanitize, sanitizeSchema],
    rehypeKatex,
    rehypeSlug,
    [rehypeToc, toc],
  ];
}

/** Convenience: a fresh TOC collector for one render pass. */
export function createTocCollector(): TocCollector {
  return { toc: [] };
}

/**
 * Extract the H2/H3 table of contents from markdown **without** rendering React
 * (for U2 and server-side use). Runs the exact same remark → rehype chain as
 * `<Markdown>` — including `rehype-slug` — so the ids returned are identical to
 * the ids the component renders onto the headings.
 */
export function extractToc(markdown: string): TocEntry[] {
  const collector = createTocCollector();
  const processor = unified()
    .use(remarkParse)
    .use(buildRemarkPlugins())
    // `allowDangerousHtml` lets raw HTML reach rehype-raw, matching the
    // rendered pipeline; the sanitize + iframe-policy stages still run.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(buildRehypePlugins(collector));
  const tree = processor.runSync(processor.parse(markdown));
  // `runSync` executes the rehype transforms (including the TOC collector).
  void tree;
  return collector.toc;
}
