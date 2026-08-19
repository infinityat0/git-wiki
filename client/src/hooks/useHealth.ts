/*
 * `GET /api/health` (features spec §6). Powers the header sync/index status
 * indicator (U5) and the "index warming up" search hint (features spec §10).
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HealthResponse } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useHealth(): UseQueryResult<HealthResponse, unknown> {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiClient.getHealth(signal),
  });
}
