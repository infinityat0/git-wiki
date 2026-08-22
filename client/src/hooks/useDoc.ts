/*
 * `GET /api/doc?path=` (features spec §6.2). Powers the content view (U3). The
 * query is disabled for an empty path (e.g. the index route) so it never fires
 * a malformed request; invalidated by `useSync`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { DocResponse } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useDoc(path: string): UseQueryResult<DocResponse, unknown> {
  return useQuery({
    queryKey: queryKeys.doc(path),
    queryFn: ({ signal }) => apiClient.getDoc(path, signal),
    enabled: path.length > 0,
  });
}
