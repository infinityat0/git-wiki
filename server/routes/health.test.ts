import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ReadinessRegistry } from '../boot/readiness.js';
import { createHealthRouter } from './health.js';

/** Mount the health router on a bare app wired to a fresh registry. */
function appWith(registry: ReadinessRegistry): Express {
  const app = express();
  app.use(createHealthRouter(registry));
  return app;
}

/**
 * Issue `GET /api/health` on a fresh app for `registry`. `Connection: close`
 * forces a new socket per request so a keep-alive socket can never be reused
 * across the ephemeral test servers (which under concurrent load can surface a
 * spurious transport-level `400` from the HTTP parser).
 */
function getHealth(registry: ReadinessRegistry) {
  return request(appWith(registry))
    .get('/api/health')
    .set('Connection', 'close');
}

describe('GET /api/health', () => {
  it('reports building and 503 before the index is ready', async () => {
    const registry = new ReadinessRegistry();
    registry.markRepoPresent(); // clone present, but index still building

    const res = await getHealth(registry);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'ok',
      searchIndex: 'building',
      docsRepo: 'clean',
    });
  });

  it('reports ready and 200 once clone is present and index is built', async () => {
    const registry = new ReadinessRegistry();
    registry.markRepoPresent();
    registry.setSearchIndex('ready');

    const res = await getHealth(registry);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      searchIndex: 'ready',
      docsRepo: 'clean',
    });
  });

  it('stays not-ready (503) when the clone is absent even if the index is built', async () => {
    const registry = new ReadinessRegistry();
    registry.setSearchIndex('ready'); // no clone yet

    const res = await getHealth(registry);

    expect(res.status).toBe(503);
    expect(res.body.searchIndex).toBe('ready');
  });

  it('surfaces a syncing docs repo', async () => {
    const registry = new ReadinessRegistry();
    registry.markRepoPresent();
    registry.setSearchIndex('ready');
    registry.setDocsRepo('syncing');

    const res = await getHealth(registry);

    expect(res.status).toBe(200);
    expect(res.body.docsRepo).toBe('syncing');
  });

  it('requires no auth (responds without any session cookie)', async () => {
    const registry = new ReadinessRegistry();
    const res = await getHealth(registry);
    // No 401/403 — the probe endpoint is always reachable.
    expect([200, 503]).toContain(res.status);
  });
});
