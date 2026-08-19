/*
 * `GET /api/tree` (features spec §6.2). Powers the left sidebar (U1). Invalidated
 * by `useSync` so a pull that changes the docs refreshes the tree in the
 * background.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TreeResponse } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useTree(): UseQueryResult<TreeResponse, unknown> {
  return useQuery({
    queryKey: queryKeys.tree,
    queryFn: ({ signal }) => apiClient.getTree(signal),
  });
}
