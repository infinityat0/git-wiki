/**
 * U3 — the application route table (features spec §9).
 *
 * A single catch-all route feeds the entire URL space to `DocView`: because the
 * SPA path mirrors the doc path at arbitrary depth (`/adr/0001-x`,
 * `/guide/nested/page`), `DocView` derives the doc from `useLocation()` rather
 * than from fixed path params, and renders the in-app 404 itself for unknown
 * routes. This keeps the route table trivial and every document deep-linkable.
 *
 * The integrator mounts this as the Shell's content zone, wrapping the app in a
 * Router + the F6 `DataProvider` (see this task's report for the exact snippet).
 * `AppRoutes` deliberately does NOT render its own `<Router>` — the host owns
 * that so a single history/router instance spans the whole app (header links,
 * sidebar, search all navigate through it).
 */

import { Routes, Route } from 'react-router-dom';
import { DocView } from '../components/DocView/DocView.js';
import type { TocEntry } from '../markdown/index.js';

export interface AppRoutesProps {
  /**
   * Passthrough TOC sink handed to `DocView` → `<Markdown>`; the integrator
   * routes the extracted H2/H3 entries to the U2 table-of-contents zone.
   */
  onTocChange?: (toc: TocEntry[]) => void;
}

/** The route element mounted inside the Shell's content zone. */
export function AppRoutes({ onTocChange }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="*" element={<DocView onTocChange={onTocChange} />} />
    </Routes>
  );
}

export default AppRoutes;
