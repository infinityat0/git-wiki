/**
 * `GET /api/search?q=<query>` — full-text search over the docs cache
 * (features spec §6.2, ADR-0003).
 *
 * Thin HTTP wrapper over the in-memory MiniSearch index built in
 * `server/search/index.ts`. The heavy lifting — walking `repo-cache/`,
 * stripping markdown, ranking, and snippet highlighting — lives there and runs
 * entirely server-side; this route only validates the query and serialises the
 * {@link SearchResult}[] response.
 *
 * Hidden docs are excluded at index-build time, so they can never appear in a
 * result regardless of the query. An empty (or whitespace-only) query returns
 * `[]`. The query string is length-capped before it reaches the index so an
 * over-long input can't drive a pathological search.
 *
 * Mounted by the integrator (see the mount snippet in the task report); this
 * module never touches `src/index.ts`.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { API_ROUTES } from '@wiki/contracts';
import type { SearchResult } from '@wiki/contracts';

import { searchDocs } from '../search/index.js';

/** Maximum accepted query length; longer inputs are truncated before search. */
export const MAX_QUERY_LENGTH = 256;

/** Read the raw `q` query param as a single string (ignores array/duplicates). */
function readQuery(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Express router serving `GET /api/search`. Exported (named + default) so the
 * integrator can mount it and B7 keeps the index fresh via `rebuildSearchIndex`.
 */
export const searchRouter: Router = Router();

searchRouter.get(API_ROUTES.search, (req: Request, res: Response) => {
  const q = readQuery(req.query.q).slice(0, MAX_QUERY_LENGTH).trim();
  if (q.length === 0) {
    res.json([] satisfies SearchResult[]);
    return;
  }
  res.json(searchDocs(q) satisfies SearchResult[]);
});

export default searchRouter;
