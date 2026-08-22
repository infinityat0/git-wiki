/**
 * JWT verification primitives + claim mapping (B8).
 *
 * Two verification paths share the same `iss`/`aud`/`exp` enforcement:
 *
 *  - **SSO (production):** the signature is checked against SSO's JWKS
 *    (`config.sso.jwksUrl`, cached by `kid` — {@link createRemoteJWKSet} owns
 *    that cache). Only asymmetric algorithms are accepted; `alg: none` and any
 *    symmetric alg (e.g. `HS256`) are rejected — the wiki holds no signing key
 *    and must never be tricked into accepting a token it could have forged
 *    (ADR-0005, security spec §4).
 *  - **Dev (local only):** a locally-signed `HS256` token verified with
 *    `DEV_JWT_SIGNING_KEY`. This path is deliberately symmetric and is only
 *    ever consulted when `AUTH_DEV_MODE` is on and non-production (see the
 *    middleware); it is never a substitute for the SSO path.
 *
 * `claimsToUser` maps verified claims to the {@link AuthUser} the app consumes,
 * deriving `canWrite` defensively: a `firebase` provider is always read-only
 * regardless of any `canWrite` claim (features spec §12).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { AuthProvider } from '@wiki/contracts';

import type { AuthUser } from './types.js';

/** Key material accepted by {@link jwtVerify} (a static key or a JWKS resolver). */
export type VerifyKey = Parameters<typeof jwtVerify>[1];

/**
 * Allowlisted signature algorithms for the SSO path — asymmetric only. This is
 * the security boundary: `none` and every symmetric MAC (`HS*`) are absent, so
 * {@link jwtVerify} rejects them outright.
 */
export const ASYMMETRIC_ALGS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
] as const;

/** The dev path's single symmetric algorithm. */
const DEV_ALG = 'HS256';

/**
 * Build the cached, `kid`-keyed JWKS resolver for the SSO issuer. Construction
 * is lazy — no network call happens until the first verification.
 */
export function createSsoKeySet(jwksUrl: string): VerifyKey {
  return createRemoteJWKSet(new URL(jwksUrl));
}

export interface SsoVerifyParams {
  keySet: VerifyKey;
  issuer: string;
  audience: string;
}

/**
 * Verify an SSO-issued token: asymmetric signature via JWKS, plus `iss`/`aud`/
 * `exp`. Throws (rejects) on any failure — the caller treats a throw as
 * "no valid session".
 */
export async function verifySsoToken(
  token: string,
  params: SsoVerifyParams,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, params.keySet, {
    issuer: params.issuer,
    audience: params.audience,
    algorithms: [...ASYMMETRIC_ALGS],
  });
  return payload;
}

export interface DevVerifyParams {
  secret: Uint8Array;
  issuer: string;
  audience: string;
}

/** Verify a locally-signed dev token (`HS256`), enforcing `iss`/`aud`/`exp`. */
export async function verifyDevToken(
  token: string,
  params: DevVerifyParams,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, params.secret, {
    issuer: params.issuer,
    audience: params.audience,
    algorithms: [DEV_ALG],
  });
  return payload;
}

const PROVIDERS = new Set<AuthProvider>(['github', 'firebase', 'dev']);

/** Narrow an unknown `provider` claim; unknown values fall back to read-only. */
function toProvider(value: unknown): AuthProvider {
  return typeof value === 'string' && PROVIDERS.has(value as AuthProvider)
    ? (value as AuthProvider)
    : 'firebase';
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Map verified JWT claims to an {@link AuthUser}.
 *
 * `canWrite` is derived, not copied blindly: `firebase` sessions are always
 * read-only (features spec §12); for `github`/`dev` the `canWrite` claim is
 * honoured (strictly `=== true`). The wiki still enforces this server-side on
 * every write endpoint via `requireWrite`.
 */
export function claimsToUser(payload: JWTPayload): AuthUser {
  const provider = toProvider(payload.provider);
  const canWrite = provider === 'firebase' ? false : payload.canWrite === true;

  const user: AuthUser = {
    name: toStringOrEmpty(payload.name),
    email: toStringOrEmpty(payload.email),
    provider,
    canWrite,
  };
  if (typeof payload.sub === 'string') user.sub = payload.sub;
  if (Array.isArray(payload.roles)) {
    user.roles = payload.roles.filter(
      (role): role is string => typeof role === 'string',
    );
  }
  return user;
}

/**
 * Extract a single cookie value from a raw `Cookie` header. Avoids pulling in
 * `cookie-parser` for the one cookie the wiki reads.
 */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
