/*
 * Typed API client (features spec §6).
 *
 * A thin, dependency-free wrapper over `fetch` that:
 *  - builds request URLs from the frozen {@link API_ROUTES} + `*Query` shapes,
 *    so the client can never drift from the contract on paths or query keys;
 *  - returns strongly-typed `@wiki/contracts` payloads;
 *  - normalizes every failure into an {@link ApiClientError} (features spec §10).
 *
 * The transport is injectable ({@link createApiClient}) so tests can supply a
 * stub `fetch` — the real endpoints (B* tasks) do not exist yet.
 */

import { API_ROUTES } from '@wiki/contracts';
import type {
  AuthMe,
  DevLoginRequest,
  DevLoginResponse,
  DocResponse,
  HealthResponse,
  HistoryResponse,
  LogoutResponse,
  SearchResponse,
  SyncResult,
  TreeResponse,
} from '@wiki/contracts';
import { ApiClientError } from './errors';

/** The subset of the `fetch` signature this client relies on. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Query params appended to the route path; values are URL-encoded. */
  query?: Record<string, string>;
  /** JSON request body (POST). */
  body?: unknown;
  /** Abort signal wired through from React Query. */
  signal?: AbortSignal;
}

/** Append a query string to a route path, encoding every value. */
function withQuery(path: string, query?: Record<string, string>): string {
  if (!query) return path;
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Best-effort JSON parse; returns `undefined` for empty/non-JSON bodies. */
async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * A typed API client bound to a specific `fetch` implementation. Every method
 * resolves with a `@wiki/contracts` payload or rejects with {@link ApiClientError}.
 */
export interface ApiClient {
  getHealth(signal?: AbortSignal): Promise<HealthResponse>;
  getAuthMe(signal?: AbortSignal): Promise<AuthMe>;
  devLogin(body: DevLoginRequest): Promise<DevLoginResponse>;
  logout(): Promise<LogoutResponse>;
  getTree(signal?: AbortSignal): Promise<TreeResponse>;
  getDoc(path: string, signal?: AbortSignal): Promise<DocResponse>;
  getHistory(path: string, signal?: AbortSignal): Promise<HistoryResponse>;
  search(q: string, signal?: AbortSignal): Promise<SearchResponse>;
  syncPull(): Promise<SyncResult>;
}

/** Create an {@link ApiClient} over the given transport (defaults to global `fetch`). */
export function createApiClient(
  // Late-bound so a reassigned/mocked global `fetch` is always respected.
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): ApiClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body, signal } = options;
    const init: RequestInit = {
      method,
      // Cookie-based SSO session (ADR-0005): always send credentials.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    };

    let response: Response;
    try {
      response = await fetchImpl(withQuery(path, query), init);
    } catch (cause) {
      throw ApiClientError.fromNetwork(cause);
    }

    const payload = await parseJson(response);
    if (!response.ok) {
      throw ApiClientError.fromResponse(response.status, payload);
    }
    return payload as T;
  }

  return {
    getHealth: (signal) => request<HealthResponse>(API_ROUTES.health, { signal }),
    getAuthMe: (signal) => request<AuthMe>(API_ROUTES.authMe, { signal }),
    devLogin: (body) =>
      request<DevLoginResponse>(API_ROUTES.authDev, { method: 'POST', body }),
    logout: () => request<LogoutResponse>(API_ROUTES.authLogout, { method: 'POST' }),
    getTree: (signal) => request<TreeResponse>(API_ROUTES.tree, { signal }),
    getDoc: (path, signal) =>
      request<DocResponse>(API_ROUTES.doc, { query: { path }, signal }),
    getHistory: (path, signal) =>
      request<HistoryResponse>(API_ROUTES.history, { query: { path }, signal }),
    search: (q, signal) =>
      request<SearchResponse>(API_ROUTES.search, { query: { q }, signal }),
    syncPull: () => request<SyncResult>(API_ROUTES.syncPull, { method: 'POST' }),
  };
}

/** Default client bound to the global `fetch`. Consumed by the React Query hooks. */
export const apiClient: ApiClient = createApiClient();
