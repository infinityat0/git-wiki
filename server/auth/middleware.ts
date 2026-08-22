/**
 * Auth middleware + authorization guards (B8).
 *
 * `createAuthMiddleware` returns an Express handler that reads the SSO session
 * cookie, verifies it (dev path first when enabled, else the SSO/JWKS path),
 * and attaches the verified {@link AuthUser} to `req.user`. It never blocks a
 * request on its own — an unauthenticated request simply carries no `req.user`;
 * the guards below decide what that means for a given route.
 *
 * Guards:
 *  - `requireWrite` — `401` when unauthenticated, `403 FORBIDDEN` when the
 *    session lacks `canWrite` (e.g. a `firebase` session). Applied to every
 *    write endpoint; the wiki never trusts the client's own capability claim.
 *  - `requireRead` / `createRequireRead` — honour `READ_ACCESS`: when
 *    `AUTHENTICATED`, an unauthenticated read gets `401`; when `PUBLIC`, reads
 *    pass through.
 */

import type { RequestHandler } from 'express';

import { config } from '../config/index.js';
import { sendError } from './errors.js';
import type { AuthConfig, AuthUser } from './types.js';
import {
  claimsToUser,
  createSsoKeySet,
  readCookie,
  verifyDevToken,
  verifySsoToken,
  type VerifyKey,
} from './verify.js';

export interface AuthMiddlewareOptions {
  /** Config slice to read (cookie name, issuer/audience, dev settings). */
  config: AuthConfig;
  /**
   * SSO verification key/JWKS resolver. Defaults to a remote JWKS set built
   * from `config.sso.jwksUrl`; injectable so tests can supply a local key.
   */
  ssoKeySet?: VerifyKey;
  /**
   * Dev-token secret. Defaults to `config.devAuth.jwtSigningKey` (UTF-8
   * encoded), or `null` when unset. `null` disables the dev verification path.
   */
  devSecret?: Uint8Array | null;
}

/** Encode the dev signing secret, or `null` when none is configured. */
function resolveDevSecret(options: AuthMiddlewareOptions): Uint8Array | null {
  if (options.devSecret !== undefined) return options.devSecret;
  const key = options.config.devAuth.jwtSigningKey;
  return key ? new TextEncoder().encode(key) : null;
}

/**
 * Build the session-reading middleware. The returned handler resolves the
 * session asynchronously (JWKS verification is async) and always calls `next`.
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions,
): RequestHandler {
  const { config: cfg } = options;
  const ssoKeySet = options.ssoKeySet ?? createSsoKeySet(cfg.sso.jwksUrl);
  const devSecret = resolveDevSecret(options);
  // The dev path is only ever consulted outside production and when explicitly
  // enabled — mirrors the loadConfig guardrail (dev mode is forced off in prod).
  const devEnabled = cfg.authDevMode && !cfg.isProduction && devSecret !== null;

  async function authenticate(token: string): Promise<AuthUser | null> {
    if (devEnabled && devSecret) {
      try {
        return claimsToUser(
          await verifyDevToken(token, {
            secret: devSecret,
            issuer: cfg.sso.issuer,
            audience: cfg.sso.audience,
          }),
        );
      } catch {
        // Not a valid dev token — fall through to the SSO path.
      }
    }
    try {
      return claimsToUser(
        await verifySsoToken(token, {
          keySet: ssoKeySet,
          issuer: cfg.sso.issuer,
          audience: cfg.sso.audience,
        }),
      );
    } catch {
      return null;
    }
  }

  return function authMiddleware(req, _res, next): void {
    const token = readCookie(req.headers.cookie, cfg.sso.sessionCookieName);
    if (!token) {
      next();
      return;
    }
    void authenticate(token)
      .then((user) => {
        if (user) req.user = user;
        next();
      })
      .catch(() => {
        // Verification failure ⇒ treat as unauthenticated, never a 500.
        next();
      });
  };
}

/**
 * Guard for write endpoints: requires an authenticated session with write
 * capability. `401` when there is no session at all, `403 FORBIDDEN` when the
 * session cannot write (features spec §12).
 */
export const requireWrite: RequestHandler = (req, res, next): void => {
  if (!req.user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    return;
  }
  if (!req.user.canWrite) {
    sendError(res, 403, 'FORBIDDEN', 'You do not have write access.');
    return;
  }
  next();
};

/**
 * Build a read guard honouring `READ_ACCESS`: when `AUTHENTICATED`, an
 * unauthenticated read is rejected with `401`; when `PUBLIC`, reads pass.
 */
export function createRequireRead(
  cfg: Pick<AuthConfig, 'readAccess'>,
): RequestHandler {
  return function requireReadGuard(req, res, next): void {
    if (cfg.readAccess === 'AUTHENTICATED' && !req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required to read.');
      return;
    }
    next();
  };
}

/**
 * Process-wide auth middleware singleton, bound to the config singleton.
 * The integrator applies this before the API routers (see the mount snippet
 * in the task report); this module never touches `src/index.ts`.
 */
export const authMiddleware: RequestHandler = createAuthMiddleware({ config });

/** Process-wide read guard bound to the config singleton. */
export const requireRead: RequestHandler = createRequireRead(config);
