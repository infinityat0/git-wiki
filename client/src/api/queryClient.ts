/*
 * React Query client configuration (ADR-0004).
 *
 * Docs content is git-backed and changes only on sync, so we favour cached
 * reads with explicit background refetch after a pull (see `useSync`) over
 * aggressive polling. {@link ApiClientError} codes drive retry policy: auth and
 * client errors are not retried, transient/server errors are.
 */

import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './errors';

/** Error codes that must never be retried (retrying cannot change the outcome). */
const NON_RETRYABLE = new Set([
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION',
]);

/** Build a {@link QueryClient} with the wiki's shared defaults. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Content is stable between syncs; avoid refetch storms on focus.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiClientError &&
            NON_RETRYABLE.has(error.code)
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
