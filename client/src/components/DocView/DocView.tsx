/**
 * U3 — the content view (features spec §9 routing, §10 states).
 *
 * Renders the document addressed by the current route through the F7
 * `<Markdown>` pipeline with the assembled R* slots. The route path mirrors the
 * doc path (`/adr/0001-x` ↔ `adr/0001-x.md`); this component reads the location,
 * loads `useDoc`, and branches on the async state:
 *
 *   loading → content skeleton   (features spec §10)
 *   404     → in-app not-found   (unknown route OR server NOT_FOUND — never blank)
 *   error   → "Couldn't load" + retry
 *   ready   → the rendered markdown
 *
 * Deep links work because the route *is* the doc path; heading anchors (`#slug`
 * from rehype-slug) are honored by scrolling the matching element into view once
 * the content is present. Doc-to-doc link clicks are intercepted into
 * client-side navigations (see `useInternalLinkNav`).
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Markdown, type TocEntry } from '../../markdown/index.js';
import { useDoc } from '../../hooks/useDoc.js';
import { useTree } from '../../hooks/useTree.js';
import { ApiClientError } from '../../api/errors.js';
import { routeToDocPath, docDirname } from '../../routes/paths.js';
import { makeDocExists, isKnownMissing } from '../../routes/docExists.js';
import { useInternalLinkNav } from '../../routes/useInternalLinkNav.js';
import { useDocSlots } from './slots.js';
import { DocSkeleton, DocNotFound, DocError } from './DocStates.js';
import './DocView.css';

export interface DocViewProps {
  /**
   * Optional TOC sink. `<Markdown>` extracts the H2/H3 table of contents on each
   * render; the integrator routes it to U2 (right-hand TOC). U3 does not own the
   * TOC UI, so this is a passthrough — omit it and TOC extraction is a no-op.
   */
  onTocChange?: (toc: TocEntry[]) => void;
}

/** True when a `useDoc` error is a "document not found" (server 404). */
function isNotFound(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 404 || error.code === 'NOT_FOUND')
  );
}

export function DocView({ onTocChange }: DocViewProps) {
  const location = useLocation();
  const docPath = routeToDocPath(location.pathname);
  const basePath = docDirname(docPath);

  const tree = useTree();
  const docExists = useMemo(() => makeDocExists(tree.data), [tree.data]);
  const slots = useDocSlots(basePath, docExists);
  const onContainerClick = useInternalLinkNav();

  const doc = useDoc(docPath);
  const content = doc.data?.content;

  // Deep-link heading anchors: once the content is in the DOM, scroll the
  // element whose id matches the URL fragment into view (features spec §9).
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (content === undefined) return;
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'start' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [content, location.hash, location.pathname]);

  // Index route (`/`): nothing addressed yet — a benign landing, not an error.
  if (docPath.length === 0) {
    return (
      <div className="docview" ref={containerRef}>
        <div className="docview-status" data-testid="docview-index">
          <h1 className="docview-status__title">git-wiki</h1>
          <p className="docview-status__detail">
            Select a document from the navigation to get started.
          </p>
        </div>
      </div>
    );
  }

  // Unknown route: the tree has loaded and has no such file → in-app 404
  // (features spec §9) without waiting on a doomed `/api/doc` request.
  if (isKnownMissing(tree.data, docPath)) {
    return (
      <div className="docview" ref={containerRef}>
        <DocNotFound path={docPath} />
      </div>
    );
  }

  let body: ReactNode;
  if (doc.isError) {
    body = isNotFound(doc.error) ? (
      <DocNotFound path={docPath} />
    ) : (
      <DocError
        message={
          doc.error instanceof ApiClientError ? doc.error.message : undefined
        }
        onRetry={() => void doc.refetch()}
      />
    );
  } else if (content === undefined) {
    body = <DocSkeleton />;
  } else {
    body = (
      <Markdown content={content} slots={slots} onTocChange={onTocChange} />
    );
  }

  return (
    <div
      className="docview"
      ref={containerRef}
      onClick={onContainerClick}
      data-doc-path={docPath}
    >
      {body}
    </div>
  );
}

export default DocView;
