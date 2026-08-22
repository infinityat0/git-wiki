/**
 * Canonical error contract.
 *
 * Every non-2xx API response uses this shape (features spec §6.0 / §10):
 *
 * ```json
 * { "error": { "code": "NOT_FOUND", "message": "<human readable>" } }
 * ```
 *
 * Clients map `code` to the error UI states in features spec §10.
 */

/** Machine-readable error codes returned by the API (features spec §6.0). */
export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'SYNC_FAILED'
  | 'VALIDATION'
  | 'INTERNAL';

/**
 * The exhaustive, ordered list of {@link ErrorCode}s as a runtime value.
 * Useful for validation and for iterating in tests. Kept in sync with the
 * {@link ErrorCode} union above.
 */
export const ERROR_CODES = [
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'SYNC_FAILED',
  'VALIDATION',
  'INTERNAL',
] as const satisfies readonly ErrorCode[];

/** The consistent error envelope for all non-2xx responses (features spec §6.0). */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
  };
}
