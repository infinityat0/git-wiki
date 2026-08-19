/*
 * Bridges the `useAuthMe` server query into the Zustand auth store (ADR-0004).
 * Mount once near the app root (U7); every other component then reads identity
 * and `canWrite` synchronously from the store. Returns the underlying query so
 * the mount point can render the auth loading/error states (features spec §10).
 */

import { useEffect } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AuthMe } from '@wiki/contracts';
import { useAuthMe } from './useAuthMe';
import { useAuthStore } from '../stores/authStore';

export function useHydrateAuth(): UseQueryResult<AuthMe, unknown> {
  const query = useAuthMe();
  const setFromAuthMe = useAuthStore((s) => s.setFromAuthMe);

  useEffect(() => {
    if (query.data) setFromAuthMe(query.data);
  }, [query.data, setFromAuthMe]);

  return query;
}
