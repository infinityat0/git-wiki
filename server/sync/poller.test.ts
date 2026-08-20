/**
 * Tests for the background sync poller (features spec §4.1, §11).
 *
 * Uses fake timers + a mocked git runner to assert the poller pulls on its
 * interval, does nothing when disabled (interval 0), stops cleanly, and never
 * overlaps ticks while a slow pull is in flight.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReadinessRegistry } from '../boot/readiness.js';
import type { GitRunner, SyncHooks, SyncLogger } from './pull.js';
import { startSyncPoller } from './poller.js';

const silent: SyncLogger = { info: () => {}, error: () => {} };
const noopHooks: SyncHooks = {
  invalidateTree: () => {},
  rebuildIndex: () => {},
};

function baseDeps(runGit: GitRunner) {
  return {
    cacheDir: '/tmp/does-not-matter',
    branch: 'main',
    runGit,
    hooks: noopHooks,
    registry: new ReadinessRegistry(),
    logger: silent,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('startSyncPoller', () => {
  it('is inert when the interval is 0 (polling disabled)', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValue({ stdout: 'Already up to date.', stderr: '' });

    vi.useFakeTimers();
    const poller = startSyncPoller({ ...baseDeps(runGit), intervalSeconds: 0 });
    expect(poller.active).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runGit).not.toHaveBeenCalled();
    poller.stop();
  });

  it('is inert for a negative interval', () => {
    const runGit: GitRunner = vi.fn();
    const poller = startSyncPoller({
      ...baseDeps(runGit),
      intervalSeconds: -5,
    });
    expect(poller.active).toBe(false);
  });

  it('pulls once per interval and stops when told to', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValue({ stdout: 'Already up to date.', stderr: '' });

    vi.useFakeTimers();
    const poller = startSyncPoller({ ...baseDeps(runGit), intervalSeconds: 5 });
    expect(poller.active).toBe(true);

    // Not called immediately — first pull fires after one interval.
    expect(runGit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(runGit).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(runGit).toHaveBeenCalledTimes(2);

    poller.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(runGit).toHaveBeenCalledTimes(2);
  });

  it('does not overlap ticks while a pull is still running', async () => {
    // A pull that never resolves within the test window.
    let resolvePull: (() => void) | undefined;
    const runGit: GitRunner = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePull = () => resolve({ stdout: '', stderr: '' });
        }),
    );

    vi.useFakeTimers();
    const poller = startSyncPoller({ ...baseDeps(runGit), intervalSeconds: 5 });

    // First tick starts a pull and holds it open across several intervals.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(runGit).toHaveBeenCalledTimes(1);

    // Let the in-flight pull finish; the next interval may start a fresh one.
    resolvePull?.();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runGit).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it('keeps polling after a failed pull', async () => {
    const runGit: GitRunner = vi
      .fn()
      .mockRejectedValueOnce(new Error('fatal: network down'))
      .mockResolvedValue({ stdout: 'Already up to date.', stderr: '' });

    vi.useFakeTimers();
    const poller = startSyncPoller({ ...baseDeps(runGit), intervalSeconds: 5 });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(runGit).toHaveBeenCalledTimes(1);

    // A failure doesn't wedge the poller — the next tick still fires.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runGit).toHaveBeenCalledTimes(2);

    poller.stop();
  });
});
