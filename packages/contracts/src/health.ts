/**
 * Health / sync operational contracts (features spec §6, §6.2).
 */

/** Search index readiness reported by `GET /api/health`. */
export type SearchIndexStatus = 'ready' | 'building';

/** Docs working-tree state reported by `GET /api/health`. */
export type DocsRepoStatus = 'clean' | 'syncing';

/**
 * Response of `GET /api/health` (features spec §6). Liveness/readiness probe
 * for Kubernetes; never requires auth.
 */
export interface HealthResponse {
  status: 'ok';
  searchIndex: SearchIndexStatus;
  docsRepo: DocsRepoStatus;
}

/**
 * Response of a successful `POST /api/sync/pull` (features spec §6.2). On
 * failure the endpoint returns {@link ApiError} with `409 CONFLICT` or
 * `502 SYNC_FAILED` instead.
 */
export interface SyncResult {
  success: boolean;
  /** Whether the pull brought in new commits. */
  changesPulled: boolean;
  /** Human-readable git output, e.g. `Already up to date.`. */
  log: string;
}
