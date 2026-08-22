/*
 * `GET /api/search?q=` (features spec §6.2). Powers the ⌘K search modal (U4).
 * Disabled for a blank query; results stay cached briefly so re-opening the
 * modal for the same term is instant.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { SearchResponse } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useSearch(q: string): UseQueryResult<SearchResponse, unknown> {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed),
    queryFn: ({ signal }) => apiClient.search(trimmed, signal),
    enabled: trimmed.length > 0,
  });
}
