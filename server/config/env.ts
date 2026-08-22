/**
 * Pure parsing helpers for environment variables.
 *
 * These are intentionally dependency-free and side-effect-free so they can be
 * unit-tested in isolation and reused by {@link ./config.ts}.
 */

export type RawEnv = Record<string, string | undefined>;

/** Returns a trimmed non-empty string, or `undefined` when unset/blank. */
export function readString(env: RawEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Parses a boolean. Accepts (case-insensitively) `true/1/yes/on` as true and
 * `false/0/no/off` as false. Unset → `fallback`. Any other value throws.
 */
export function parseBool(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  throw new Error(`expected a boolean (got "${value}")`);
}

/**
 * Parses a base-10 integer. Unset → `fallback`. Enforces optional `min`.
 * Throws with a caller-friendly message on invalid input.
 */
export function parseInteger(
  value: string | undefined,
  fallback: number,
  opts: { min?: number } = {},
): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new Error(`expected an integer (got "${value}")`);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new Error(`expected an integer >= ${opts.min} (got ${n})`);
  }
  return n;
}

/** Splits a comma-separated list, trimming and dropping empty entries. */
export function parseList(
  value: string | undefined,
  fallback: string[],
): string[] {
  if (value === undefined) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Validates that `value` is one of `allowed`; unset → `fallback`. */
export function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`expected one of ${allowed.join(', ')} (got "${value}")`);
}
