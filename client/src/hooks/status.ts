/*
 * Async-surface status derivation (features spec §10).
 *
 * Collapses a React Query result into the four UI states every async surface
 * must handle — loading / empty / error / ready — plus the underlying
 * {@link ApiClientError} for error rendering. UI components branch on `state`
 * instead of juggling raw React Query flags.
 */

import type { UseQueryResult } from '@tanstack/react-query';
import { ApiClientError } from '../api/errors';
import type { HistoryResponse, SearchResponse, TreeResponse } from '@wiki/contracts';

/** The mutually-exclusive display state of an async surface. */
export type AsyncState = 'loading' | 'empty' | 'error' | 'ready';

export interface AsyncStatus {
  state: AsyncState;
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
  isReady: boolean;
  /** Normalized error when `state === 'error'`, else `null`. */
  error: ApiClientError | null;
}

/** The React Query fields {@link deriveAsyncStatus} reads. */
type QuerySlice<T> = Pick<
  UseQueryResult<T, unknown>,
  'data' | 'isPending' | 'isError' | 'isFetching' | 'error'
>;

/** Normalize an unknown React Query error into an {@link ApiClientError} (or null). */
function toApiError(error: unknown): ApiClientError | null {
  if (error instanceof ApiClientError) return error;
  if (error instanceof Error) return ApiClientError.fromNetwork(error);
  return null;
}

/**
 * Derive the {@link AsyncStatus} for a query. `isEmpty` decides the empty state
 * once data has arrived (e.g. an empty tree or zero search hits).
 */
export function deriveAsyncStatus<T>(
  query: QuerySlice<T>,
  isEmpty?: (data: T) => boolean,
): AsyncStatus {
  let state: AsyncState;
  if (query.isError) {
    state = 'error';
  } else if (query.data !== undefined) {
    state = isEmpty?.(query.data) ? 'empty' : 'ready';
  } else if (query.isPending || query.isFetching) {
    state = 'loading';
  } else {
    // Disabled query with no cached data yet — treat as loading (nothing to show).
    state = 'loading';
  }

  return {
    state,
    isLoading: state === 'loading',
    isEmpty: state === 'empty',
    isError: state === 'error',
    isReady: state === 'ready',
    error: state === 'error' ? toApiError(query.error) : null,
  };
}

/** Emptiness predicates for the collection-returning surfaces (features spec §10). */
export const isTreeEmpty = (tree: TreeResponse): boolean => tree.length === 0;
export const isSearchEmpty = (results: SearchResponse): boolean =>
  results.length === 0;
export const isHistoryEmpty = (history: HistoryResponse): boolean =>
  history.length === 0;
