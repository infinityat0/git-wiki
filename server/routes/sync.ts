/**
 * `POST /api/sync/pull` — trigger an immediate git pull of the docs cache
 * (features spec §6.2, §4.1).
 *
 * Thin HTTP wrapper over the shared {@link runPull} routine in
 * `server/sync/pull.ts` (the same routine the background poller runs). On
 * success it returns the {@link SyncResult} `{ success, changesPulled, log }`;
 * on failure it maps the outcome to the canonical {@link ApiError} envelope —
 * `409 CONFLICT` when a local edit blocks the pull, `502 SYNC_FAILED` for a
 * transient network/remote failure or timeout (features spec §6.0).
 *
 * The readiness `syncing`→`clean` window, the git timeout, and the tree-cache /
 * search-index refresh all live in {@link runPull}; this module only serialises
 * the result.
 *
 * Mounted by the integrator (see the mount snippet in the task report); this
 * module never touches `src/index.ts`.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { API_ROUTES } from '@wiki/contracts';
import type { ApiError, SyncResult } from '@wiki/contracts';

import { runPull, type PullDeps } from '../sync/pull.js';

/**
 * Build a router serving `POST /api/sync/pull`. Dependencies default to the
 * process-wide wiring; tests inject a mocked git runner + hooks to exercise the
 * full HTTP path without touching a real repo. See {@link syncRouter} for the
 * default-wired instance the integrator mounts.
 */
export function createSyncRouter(deps: PullDeps = {}): Router {
  const router = Router();

  router.post(API_ROUTES.syncPull, async (_req: Request, res: Response) => {
    const outcome = await runPull(deps);

    if (outcome.ok) {
      res.json(outcome.result satisfies SyncResult);
      return;
    }

    const body: ApiError = {
      error: { code: outcome.code, message: outcome.message },
    };
    res.status(outcome.status).json(body);
  });

  return router;
}

/**
 * Express router serving `POST /api/sync/pull`, wired to the process-wide
 * defaults. Exported (named + default) so the integrator can `app.use()` it.
 */
export const syncRouter: Router = createSyncRouter();

export default syncRouter;
