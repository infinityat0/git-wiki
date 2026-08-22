/*
 * `GET /api/history?path=` (features spec §6.2). Powers the history drawer (U6).
 * Disabled for an empty path.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HistoryResponse } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useHistory(
  path: string,
): UseQueryResult<HistoryResponse, unknown> {
  return useQuery({
    queryKey: queryKeys.history(path),
    queryFn: ({ signal }) => apiClient.getHistory(path, signal),
    enabled: path.length > 0,
  });
}
