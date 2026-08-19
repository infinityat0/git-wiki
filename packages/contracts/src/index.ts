/**
 * @wiki/contracts — shared API contract types.
 *
 * PLACEHOLDER ONLY. The real payload types (TreeNode, DocResponse,
 * HistoryEntry, SearchResult, AuthMe, HealthResponse, SyncResult, ApiError)
 * and route-path constants are defined by task F2. Do not add real API types
 * here — F2 owns this package's contents going forward.
 *
 * The single runtime export below exists purely so both `client` and `server`
 * can prove that `@wiki/contracts` resolves (value + type) across the
 * workspace boundary during F1 scaffolding.
 */

/** Placeholder version marker; replaced/removed when F2 lands. */
export const contractsVersion = '0.0.0-placeholder';

/** Placeholder type; F2 replaces this module's exports with the real contract. */
export type Placeholder = typeof contractsVersion;
