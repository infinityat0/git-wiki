/*
 * Client-side error normalization.
 *
 * Every non-2xx API response is expected to carry the `@wiki/contracts`
 * {@link ApiError} envelope (`{ error: { code, message } }`, features spec
 * §6.0 / §10). {@link ApiClientError} flattens that envelope into a throwable
 * `Error` subclass so React Query's `error` slot and the UI's error states
 * (features spec §10) can branch on a stable `code` without re-parsing bodies.
 */

import { ERROR_CODES } from '@wiki/contracts';
import type { ApiError, ErrorCode } from '@wiki/contracts';

/** Fallback code when the server did not send a recognizable envelope. */
const FALLBACK_CODE: ErrorCode = 'INTERNAL';

/** Narrow an arbitrary value to a known {@link ErrorCode}. */
function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Type guard for the frozen {@link ApiError} envelope shape. */
export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as { error?: unknown }).error;
  if (typeof err !== 'object' || err === null) return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  return isErrorCode(code) && typeof message === 'string';
}

/**
 * A normalized, throwable API error. Carries the contract `code`, the
 * server-provided `message`, and the HTTP `status` (0 for network/transport
 * failures that never produced a response).
 */
export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    // Restore the prototype chain for `instanceof` under transpiled targets.
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }

  /** Build from a parsed response body, preferring the {@link ApiError} envelope. */
  static fromResponse(status: number, body: unknown): ApiClientError {
    if (isApiError(body)) {
      return new ApiClientError(body.error.code, body.error.message, status);
    }
    return new ApiClientError(
      FALLBACK_CODE,
      `Request failed with status ${status}`,
      status,
    );
  }

  /** Build from a transport-level failure (fetch rejected; no HTTP response). */
  static fromNetwork(cause: unknown): ApiClientError {
    const message =
      cause instanceof Error ? cause.message : 'Network request failed';
    return new ApiClientError('INTERNAL', message, 0);
  }
}
