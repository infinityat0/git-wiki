/*
 * Data-layer provider. Downstream (U* tasks / app shell) mounts this once near
 * the root so every React Query hook has a client. Owns the query cache only —
 * theme/layout providers are F5's concern and are composed separately.
 */

import { useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createQueryClient } from './queryClient';

interface DataProviderProps {
  children: ReactNode;
  /** Inject a pre-built client (tests, storybook). Defaults to a fresh one. */
  client?: QueryClient;
}

/** Provides the shared React Query client to the subtree. */
export function DataProvider({ children, client }: DataProviderProps) {
  // Stable across re-renders; a lazy initializer avoids rebuilding the cache.
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
