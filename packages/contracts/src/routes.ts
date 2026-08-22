/**
 * Route path constants + query-parameter shapes (features spec §6).
 *
 * Shared so the client and server cannot drift on URLs or query keys. These
 * are the only runtime values in the package besides {@link ERROR_CODES} and
 * `contractsVersion`.
 */

/**
 * Canonical API route paths. Keys are stable identifiers; values are the exact
 * paths from features spec §6. Query strings are not encoded here — see the
 * `*Query` shapes below.
 */
export const API_ROUTES = {
  /** `GET` — liveness/readiness probe (features spec §6). */
  health: '/api/health',
  /** `GET` — reflect current verified session claims (features spec §6.1). */
  authMe: '/api/auth/me',
  /** `POST` — clear local session + SSO logout redirect (features spec §6.1). */
  authLogout: '/api/auth/logout',
  /** `POST` — local-dev-only login (features spec §6.1). */
  authDev: '/api/auth/dev',
  /** `GET` — hierarchical docs tree (features spec §6.2). */
  tree: '/api/tree',
  /** `GET` — single document content + metadata; requires `?path=` (features spec §6.2). */
  doc: '/api/doc',
  /** `GET` — git history for a file; requires `?path=` (features spec §6.2). */
  history: '/api/history',
  /** `GET` — full-text search; requires `?q=` (features spec §6.2). */
  search: '/api/search',
  /** `GET` — stream a non-markdown asset; requires `?path=` (features spec §6.2). */
  asset: '/api/asset',
  /** `POST` — trigger an immediate git pull (features spec §6.2). */
  syncPull: '/api/sync/pull',
} as const;

/** Stable identifier for an API route (keys of {@link API_ROUTES}). */
export type ApiRouteKey = keyof typeof API_ROUTES;

/** Literal path string of an API route (values of {@link API_ROUTES}). */
export type ApiRoutePath = (typeof API_ROUTES)[ApiRouteKey];

/** Query for `GET /api/doc` — path relative to `repo-cache/`. */
export interface DocQuery {
  path: string;
}

/** Query for `GET /api/history` — path relative to `repo-cache/`. */
export interface HistoryQuery {
  path: string;
}

/** Query for `GET /api/search` — the search string. */
export interface SearchQuery {
  q: string;
}

/** Query for `GET /api/asset` — path relative to `repo-cache/`. */
export interface AssetQuery {
  path: string;
}
