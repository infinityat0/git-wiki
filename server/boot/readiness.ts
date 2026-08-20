/**
 * Shared operational-readiness state for the backend.
 *
 * A single process-wide registry that tracks the two signals `GET /api/health`
 * reports (features spec §6, ADR-0005 "How git operations work"):
 *
 *  - **docs clone present** — set once {@link module:boot/repo-cache} finishes the
 *    initial clone/pull (B1).
 *  - **search index status** — `building` until B6's MiniSearch index signals
 *    `ready`.
 *  - **docs working-tree state** — `clean` normally, flipped to `syncing` by B1's
 *    bootstrap and by B7's manual/background pulls.
 *
 * The registry is a small mutable singleton so the boot sequence, the health
 * route, and the (future) search/sync tasks share one source of truth without an
 * import cycle. Tests may construct a fresh {@link ReadinessRegistry} to assert
 * transitions in isolation.
 */

import type {
  DocsRepoStatus,
  HealthResponse,
  SearchIndexStatus,
} from '@wiki/contracts';

/**
 * Mutable holder for the health signals. All mutation goes through the small
 * verbs below so callers never poke fields directly — that keeps the valid
 * transitions (and their meaning) in one place.
 */
export class ReadinessRegistry {
  #searchIndex: SearchIndexStatus = 'building';
  #docsRepo: DocsRepoStatus = 'clean';
  #repoPresent = false;

  /** B6 calls this — `'ready'` once the search index is built, back to
   * `'building'` if it is ever rebuilt from scratch. */
  setSearchIndex(status: SearchIndexStatus): void {
    this.#searchIndex = status;
  }

  /** B1/B7 call this — `'syncing'` around a clone/pull, `'clean'` otherwise. */
  setDocsRepo(status: DocsRepoStatus): void {
    this.#docsRepo = status;
  }

  /** B1 calls this once the docs clone exists on disk (after clone/pull). */
  markRepoPresent(): void {
    this.#repoPresent = true;
  }

  get searchIndex(): SearchIndexStatus {
    return this.#searchIndex;
  }

  get docsRepo(): DocsRepoStatus {
    return this.#docsRepo;
  }

  /** Whether the docs clone has been materialised at least once. */
  get repoPresent(): boolean {
    return this.#repoPresent;
  }

  /**
   * Overall readiness for the Kubernetes `readinessProbe`
   * (deployment-kubernetes.md): traffic should only arrive once the docs clone
   * is present **and** the search index is built.
   */
  isReady(): boolean {
    return this.#repoPresent && this.#searchIndex === 'ready';
  }

  /**
   * Current state as the {@link HealthResponse} body. `status` is always `'ok'`
   * (the process is alive and serving); {@link isReady} drives the HTTP status
   * code the probe keys off, not this field.
   */
  snapshot(): HealthResponse {
    return {
      status: 'ok',
      searchIndex: this.#searchIndex,
      docsRepo: this.#docsRepo,
    };
  }
}

/** Process-wide singleton shared by the boot sequence and the health route. */
export const readiness = new ReadinessRegistry();
