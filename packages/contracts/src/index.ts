/**
 * `@wiki/contracts` — the frozen shared API contract for git-wiki.
 *
 * This package is the single source of truth for every API payload exchanged
 * between the Express server and the React client. It is **types + small const
 * maps only** — no runtime logic and no third-party dependencies (types-only;
 * no zod). See features spec §6 (contracts), §7 (frontmatter/title), §10
 * (error shape), §12 (authz/canWrite) and ADR-0005 (auth).
 *
 * Every type here is diff-checked against the JSON examples in features spec §6.
 * Consumers must import from `@wiki/contracts` rather than redefining locally.
 */

export type { ErrorCode, ApiError } from './errors.js';
export { ERROR_CODES } from './errors.js';

export type {
  AuthProvider,
  SessionUser,
  AuthMe,
  DevLoginRequest,
  DevLoginResponse,
  LogoutResponse,
} from './auth.js';

export type { TreeNodeType, TreeNode, TreeResponse } from './tree.js';

export type {
  DocResponse,
  HistoryEntry,
  HistoryResponse,
  SearchResult,
  SearchResponse,
} from './docs.js';

export type {
  SearchIndexStatus,
  DocsRepoStatus,
  HealthResponse,
  SyncResult,
} from './health.js';

export { API_ROUTES } from './routes.js';
export type {
  ApiRouteKey,
  ApiRoutePath,
  DocQuery,
  HistoryQuery,
  SearchQuery,
  AssetQuery,
} from './routes.js';

/**
 * Package version marker. Retained from the F1 scaffold so existing consumers
 * (`client`, `server`) that import it keep resolving unchanged. Value tracks
 * the package.json version.
 */
export const contractsVersion = '0.0.0';
