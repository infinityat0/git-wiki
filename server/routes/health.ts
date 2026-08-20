/**
 * `GET /api/health` — liveness/readiness probe (features spec §6, ADR-0005).
 *
 * Exposes an Express {@link Router} the integrator mounts on the app. **No
 * auth**: this is what the Kubernetes probes hit (deployment-kubernetes.md).
 *
 * The JSON body is always a {@link HealthResponse} with `status: 'ok'` — the
 * process is alive and serving. Readiness is signalled by the **HTTP status
 * code** so the `readinessProbe` can gate traffic:
 *
 *  - `200` once the docs clone is present **and** the search index is built.
 *  - `503` while still `building` (missing clone, or B6's index not yet ready).
 *
 * Both states carry the same contract shape, with `searchIndex` /`docsRepo`
 * reflecting live state from the shared {@link ReadinessRegistry}.
 */

import { Router } from 'express';

import {
  readiness as defaultReadiness,
  ReadinessRegistry,
} from '../boot/readiness.js';

/**
 * Build the health router. Accepts a registry for testing; defaults to the
 * process-wide singleton the boot sequence updates.
 */
export function createHealthRouter(
  registry: ReadinessRegistry = defaultReadiness,
): Router {
  const router = Router();

  router.get('/api/health', (_req, res) => {
    res.status(registry.isReady() ? 200 : 503).json(registry.snapshot());
  });

  return router;
}

/** Ready-to-mount router wired to the shared readiness singleton. */
export const healthRouter = createHealthRouter();

export default healthRouter;
