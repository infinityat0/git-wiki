// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { AuthMe, TreeResponse } from '@wiki/contracts';
import { DataProvider } from '../api/DataProvider';
import { useTree } from './useTree';
import { useSearch } from './useSearch';
import { useSync } from './useSync';
import { useHydrateAuth } from './useHydrateAuth';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/authStore';

/** JSON Response helper. */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A QueryClient with retries off so error states resolve deterministically. */
function testClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(DataProvider, { client, children });
}

afterEach(() => vi.unstubAllGlobals());

describe('useTree', () => {
  it('resolves with the typed tree on success', async () => {
    const tree: TreeResponse = [
      { name: 'a.md', path: 'a.md', title: 'A', type: 'file' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, tree)),
    );

    const { result } = renderHook(() => useTree(), {
      wrapper: wrapper(testClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(tree);
  });

  it('surfaces an ApiClientError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(500, { error: { code: 'INTERNAL', message: 'boom' } }),
      ),
    );

    const { result } = renderHook(() => useTree(), {
      wrapper: wrapper(testClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'INTERNAL',
      status: 500,
    });
  });
});

describe('useSearch', () => {
  it('does not fetch for a blank query', () => {
    const fetchImpl = vi.fn(async () => json(200, []));
    vi.stubGlobal('fetch', fetchImpl);

    const { result } = renderHook(() => useSearch('   '), {
      wrapper: wrapper(testClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('useSync', () => {
  it('invalidates tree + docs after a successful pull', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(200, { success: true, changesPulled: true, log: 'Updated.' }),
      ),
    );
    const client = testClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSync(), {
      wrapper: wrapper(client),
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tree });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.docs });
  });
});

describe('useHydrateAuth', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('pushes the fetched session into the auth store', async () => {
    const authMe: AuthMe = {
      authenticated: true,
      user: {
        name: 'Eng',
        email: 'e@x.com',
        provider: 'github',
        canWrite: true,
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, authMe)),
    );

    renderHook(() => useHydrateAuth(), { wrapper: wrapper(testClient()) });

    await waitFor(() =>
      expect(useAuthStore.getState().authenticated).toBe(true),
    );
    expect(useAuthStore.getState().user?.canWrite).toBe(true);
  });
});
