/**
 * Tests for `POST /api/sync/pull` (features spec §6.2, §4.1).
 *
 * Mounts {@link createSyncRouter} with a mocked git runner + spy hooks and a
 * fresh {@link ReadinessRegistry}, so the full HTTP path runs without a real
 * repo or network. Asserts the {@link SyncResult} contract on success, that the
 * tree-invalidate + reindex hooks fire only when commits arrived, and the
 * failure→error-code mapping (`409 CONFLICT` / `502 SYNC_FAILED`).
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiError, SyncResult } from '@wiki/contracts';

import { ReadinessRegistry } from '../boot/readiness.js';
import type { GitRunner, PullDeps, SyncHooks } from '../sync/pull.js';
import { createSyncRouter } from './sync.js';

interface Harness {
  base: string;
  server: Server;
  hooks: {
    invalidateTree: ReturnType<typeof vi.fn>;
    rebuildIndex: ReturnType<typeof vi.fn>;
  };
  registry: ReadinessRegistry;
}

const servers: Server[] = [];

async function mount(runGit: GitRunner): Promise<Harness> {
  const hooks = {
    invalidateTree: vi.fn(),
    rebuildIndex: vi.fn(),
  } satisfies SyncHooks;
  const registry = new ReadinessRegistry();
  const deps: PullDeps = {
    cacheDir: '/tmp/does-not-matter',
    branch: 'main',
    runGit,
    hooks,
    registry,
  };
  const app = express();
  app.use(createSyncRouter(deps));

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, server, hooks, registry };
}

async function pull(base: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${base}/api/sync/pull`, { method: 'POST' });
  return { status: res.status, body: await res.json() };
}

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe('POST /api/sync/pull', () => {
  it('returns a SyncResult and fires invalidate + reindex when commits arrive', async () => {
    const runGit: GitRunner = vi.fn().mockResolvedValue({
      stdout: 'Updating a1b2c3d..d4e5f6a\nFast-forward\n docs/x.md | 2 +-\n',
      stderr: '',
    });
    const { base, hooks, registry } = await mount(runGit);

    const { status, body } = await pull(base);
    const result = body as SyncResult;

    expect(status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.changesPulled).toBe(true);
    expect(result.log).toContain('Fast-forward');
    expect(hooks.invalidateTree).toHaveBeenCalledTimes(1);
    expect(hooks.rebuildIndex).toHaveBeenCalledTimes(1);
    // Working tree flag is left clean after the pull.
    expect(registry.docsRepo).toBe('clean');
  });

  it('runs git pull --ff-only in the cache dir with a timeout', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValue({ stdout: 'Already up to date.', stderr: '' });
    const { base } = await mount(runGit);
    await pull(base);

    expect(runGit).toHaveBeenCalledTimes(1);
    const [args, opts] = (runGit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args).toEqual(['pull', '--ff-only', 'origin', 'main']);
    expect(opts.cwd).toBe('/tmp/does-not-matter');
    expect(opts.timeout).toBeGreaterThan(0);
  });

  it('reports no changes and skips the hooks when already up to date', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValue({ stdout: 'Already up to date.', stderr: '' });
    const { base, hooks } = await mount(runGit);

    const { status, body } = await pull(base);
    const result = body as SyncResult;

    expect(status).toBe(200);
    expect(result.changesPulled).toBe(false);
    expect(result.log).toBe('Already up to date.');
    expect(hooks.invalidateTree).not.toHaveBeenCalled();
    expect(hooks.rebuildIndex).not.toHaveBeenCalled();
  });

  it('maps a transient git failure to 502 SYNC_FAILED', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockRejectedValue(
        new Error('fatal: unable to access remote: timed out'),
      );
    const { base, hooks } = await mount(runGit);

    const { status, body } = await pull(base);
    const err = body as ApiError;

    expect(status).toBe(502);
    expect(err.error.code).toBe('SYNC_FAILED');
    // No stale refresh on failure.
    expect(hooks.rebuildIndex).not.toHaveBeenCalled();
  });

  it('maps a local-edit block to 409 CONFLICT', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'error: Your local changes to the following files would be overwritten by merge',
        ),
      );
    const { base } = await mount(runGit);

    const { status, body } = await pull(base);
    const err = body as ApiError;

    expect(status).toBe(409);
    expect(err.error.code).toBe('CONFLICT');
  });

  it('maps a killed (timed-out) pull to 502, not 409', async () => {
    const timedOut = Object.assign(
      new Error('spawn git ETIMEDOUT: conflict-ish text'),
      { killed: true },
    );
    const runGit: GitRunner = vi.fn().mockRejectedValue(timedOut);
    const { base, registry } = await mount(runGit);

    const { status, body } = await pull(base);
    const err = body as ApiError;

    expect(status).toBe(502);
    expect(err.error.code).toBe('SYNC_FAILED');
    // Even on failure the working-tree flag is restored to clean.
    expect(registry.docsRepo).toBe('clean');
  });
});
