/*
 * Public API surface of the data-transport layer. Consumers import the client,
 * error type, and provider from here: `import { apiClient, ApiClientError } from '@/api'`.
 */

export { apiClient, createApiClient } from './client';
export type { ApiClient, FetchLike } from './client';
export { ApiClientError, isApiError } from './errors';
export { createQueryClient } from './queryClient';
export { DataProvider } from './DataProvider';
