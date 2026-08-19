import { describe, expect, it } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  deriveAsyncStatus,
  isHistoryEmpty,
  isSearchEmpty,
  isTreeEmpty,
} from './status';
import { ApiClientError } from '../api/errors';

/** Minimal query-result stub for the fields deriveAsyncStatus reads. */
function query<T>(
  over: Partial<UseQueryResult<T, unknown>>,
): UseQueryResult<T, unknown> {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    ...over,
  } as UseQueryResult<T, unknown>;
}

describe('deriveAsyncStatus (features spec §10)', () => {
  it('reports loading while pending with no data', () => {
    expect(deriveAsyncStatus(query<number[]>({ isPending: true })).state).toBe(
      'loading',
    );
  });

  it('reports ready when data is present and non-empty', () => {
    const s = deriveAsyncStatus(query({ data: [1, 2] }), isTreeEmpty as never);
    expect(s.state).toBe('ready');
    expect(s.isReady).toBe(true);
  });

  it('reports empty when the emptiness predicate matches', () => {
    const s = deriveAsyncStatus(query({ data: [] }), isTreeEmpty as never);
    expect(s.state).toBe('empty');
  });

  it('reports error and surfaces the ApiClientError', () => {
    const err = new ApiClientError('NOT_FOUND', 'gone', 404);
    const s = deriveAsyncStatus(query({ isError: true, error: err }));
    expect(s.state).toBe('error');
    expect(s.error).toBe(err);
    expect(s.error?.code).toBe('NOT_FOUND');
  });
});

describe('emptiness predicates', () => {
  it('detect empty collections', () => {
    expect(isTreeEmpty([])).toBe(true);
    expect(isSearchEmpty([])).toBe(true);
    expect(isHistoryEmpty([])).toBe(true);
  });
});
