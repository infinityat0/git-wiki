/*
 * Centralized React Query key factory. Single source of truth for cache keys so
 * hooks and invalidation (e.g. `useSync`) can never drift. Keys are `as const`
 * tuples for exact typing.
 */

export const queryKeys = {
  health: ['health'] as const,
  authMe: ['auth', 'me'] as const,
  tree: ['tree'] as const,
  /** All docs (prefix) — used for bulk invalidation after a sync. */
  docs: ['doc'] as const,
  doc: (path: string) => ['doc', path] as const,
  history: (path: string) => ['history', path] as const,
  search: (q: string) => ['search', q] as const,
} as const;
