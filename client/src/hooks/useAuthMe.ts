/*
 * `GET /api/auth/me` (features spec §6.1). Reflects the verified session. The
 * Zustand auth store is hydrated from this via `useHydrateAuth`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AuthMe } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useAuthMe(): UseQueryResult<AuthMe, unknown> {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: ({ signal }) => apiClient.getAuthMe(signal),
    // Identity rarely changes within a session; keep it fresh but un-chatty.
    staleTime: 5 * 60_000,
  });
}
