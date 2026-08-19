/*
 * `POST /api/sync/pull` (features spec §6.2). Triggers an immediate git pull and,
 * on success, invalidates the tree and every doc query so the UI background-
 * refetches the refreshed content (ADR-0004 — "background refetch after a sync").
 * Failures surface as an {@link ApiClientError} for the non-blocking sync toast
 * (features spec §10).
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { SyncResult } from '@wiki/contracts';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';

export function useSync(): UseMutationResult<SyncResult, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.syncPull(),
    onSuccess: () => {
      // Refresh sidebar + any open document. Active queries refetch in the
      // background; inactive ones are marked stale for their next mount.
      void queryClient.invalidateQueries({ queryKey: queryKeys.tree });
      void queryClient.invalidateQueries({ queryKey: queryKeys.docs });
    },
  });
}
