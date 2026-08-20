/**
 * Shared helper for emitting the canonical {@link ApiError} envelope
 * (features spec §6.0) from the auth layer.
 */

import type { Response } from 'express';
import type { ApiError, ErrorCode } from '@wiki/contracts';

/** Write a `{ error: { code, message } }` body with the given HTTP status. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
): void {
  const body: ApiError = { error: { code, message } };
  res.status(status).json(body);
}
