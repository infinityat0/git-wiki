/**
 * F7 — The `<Markdown>` React component.
 *
 * Thin wrapper over react-markdown that wires the F7 remark/rehype chain and
 * the component-map seam. Callers pass raw markdown `content` and, optionally,
 * `slots` (the `R*` renderers) and an `onTocChange` callback that receives the
 * H2/H3 table of contents extracted during render.
 *
 * The security boundary is fixed here — `slots` can only change presentation,
 * never the plugin chain or the sanitize allowlist.
 */

import { useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  buildRemarkPlugins,
  buildRehypePlugins,
  createTocCollector,
} from './pipeline.js';
import { buildComponents, type MarkdownSlots } from './components.js';
import type { TocEntry } from './toc.js';

export interface MarkdownProps {
  /** Raw markdown source (unrendered). */
  content: string;
  /** Optional presentation overrides supplied by the `R*` tasks. */
  slots?: MarkdownSlots;
  /**
   * Called after each render with the current H2/H3 TOC (a fresh array). For
   * synchronous, React-free extraction use `extractToc` from `pipeline.js`.
   */
  onTocChange?: (toc: TocEntry[]) => void;
  /** Optional wrapper class for the rendered container. */
  className?: string;
}

/** Render sanitized markdown with the F7 pipeline. */
export function Markdown({
  content,
  slots,
  onTocChange,
  className,
}: MarkdownProps) {
  const collector = useMemo(() => createTocCollector(), []);
  const remarkPlugins = useMemo(() => buildRemarkPlugins(), []);
  const rehypePlugins = useMemo(
    () => buildRehypePlugins(collector),
    [collector],
  );
  const components = useMemo(() => buildComponents(slots), [slots]);

  // The collector is filled while ReactMarkdown (a child) renders; this parent
  // effect runs afterwards, so `collector.toc` is current here.
  useEffect(() => {
    onTocChange?.(collector.toc.slice());
  }, [content, collector, onTocChange]);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
