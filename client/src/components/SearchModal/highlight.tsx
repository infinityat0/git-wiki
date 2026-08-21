/**
 * U4 — snippet highlight rendering.
 *
 * The server emits search snippets with each matched term wrapped in markdown
 * bold (`**term**`, features spec §6.2 / `server/search/index.ts#buildSnippets`).
 * We never feed that through the full markdown pipeline — a snippet is plain
 * text plus these bold markers — so this tiny, pure parser turns the markers
 * into `<mark>` highlights and leaves everything else as literal text. Because
 * it renders as React text nodes (never `dangerouslySetInnerHTML`), any HTML in
 * the snippet is inert.
 */

import type { ReactNode } from 'react';

/** Matches a `**…**` bold run; the inner (non-greedy) group is the term. */
const BOLD = /\*\*(.+?)\*\*/g;

/**
 * Split a single snippet string into React nodes, wrapping each `**…**` run in
 * a `<mark>`. Returns an array of strings and `<mark>` elements suitable for
 * rendering directly as children.
 */
export function renderSnippet(snippet: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  BOLD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD.exec(snippet)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(snippet.slice(lastIndex, match.index));
    }
    nodes.push(
      <mark key={key++} className="search-modal__mark">
        {match[1]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < snippet.length) {
    nodes.push(snippet.slice(lastIndex));
  }
  return nodes;
}
