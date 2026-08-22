/**
 * Background sync poller (features spec §4.1, §11).
 *
 * Runs the same {@link runPull} routine as `POST /api/sync/pull` every
 * `config.docs.syncPollInterval` seconds so the docs cache tracks the remote
 * without a manual trigger. An interval of `0` (or negative) disables polling
 * entirely — `startSyncPoller()` then returns an inert handle.
 *
 * Ticks never overlap: if a pull is still running when the next interval fires
 * the tick is skipped, so a slow pull can't stack up parallel `git` processes.
 * A failed poll is logged and swallowed — the poller keeps going and the next
 * tick retries. The interval timer is `unref`'d so it never keeps the process
 * alive on its own.
 *
 * The integrator calls {@link startSyncPoller} once on boot (see the task
 * report); this module never touches `src/index.ts`.
 */

import { config } from '../config/index.js';
import { runPull, type PullDeps, type PullOutcome } from './pull.js';

/** Handle for a running poller; call {@link SyncPoller.stop} to cancel it. */
export interface SyncPoller {
  /** Whether the poller is actively ticking (`false` when disabled). */
  readonly active: boolean;
  /** Stop future ticks. Idempotent. */
  stop(): void;
}

/** Options for {@link startSyncPoller}; extends the shared {@link PullDeps}. */
export interface StartSyncPollerOptions extends PullDeps {
  /** Seconds between pulls; defaults to `config.docs.syncPollInterval`. `0` disables. */
  intervalSeconds?: number;
  /** Observe each completed tick (tests); receives the pull outcome. */
  onTick?: (outcome: PullOutcome) => void;
}

/**
 * Start polling the docs remote on an interval. Returns a {@link SyncPoller}
 * handle. When the effective interval is `0`/negative the poller is disabled and
 * the handle is inert (`active === false`), matching the `SYNC_POLL_INTERVAL=0`
 * contract.
 */
export function startSyncPoller(
  options: StartSyncPollerOptions = {},
): SyncPoller {
  const intervalSeconds =
    options.intervalSeconds ?? config.docs.syncPollInterval;
  const logger = options.logger ?? {
    info: (m: string) => console.log(m),
    error: (m: string) => console.error(m),
  };

  if (!(intervalSeconds > 0)) {
    logger.info('[sync] background poller disabled (interval 0)');
    return { active: false, stop() {} };
  }

  let running = false;

  async function tick(): Promise<void> {
    // Skip if the previous pull hasn't finished — never stack git processes.
    if (running) {
      logger.info('[sync] poll skipped: previous pull still running');
      return;
    }
    running = true;
    try {
      const outcome = await runPull(options);
      if (!outcome.ok) {
        logger.error(`[sync] background poll failed (${outcome.code})`);
      }
      options.onTick?.(outcome);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void tick(), intervalSeconds * 1000);
  // Don't let the poll timer hold the event loop open by itself.
  timer.unref?.();
  logger.info(`[sync] background poller started (every ${intervalSeconds}s)`);

  return {
    active: true,
    stop() {
      clearInterval(timer);
    },
  };
}
