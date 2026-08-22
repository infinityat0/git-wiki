/**
 * `POST/GET /api/auth/{me,dev,logout}` (features spec §6.1, ADR-0005).
 *
 * The wiki is a pure relying party: these endpoints reflect the verified
 * session, mint a *local* dev session, or hand back an SSO logout redirect —
 * none of them talk to the SSO app. Session verification itself lives in the
 * auth middleware (`../auth/middleware.js`), which the integrator applies
 * before this router so `req.user` is populated by the time `/me` runs.
 *
 * `POST /api/auth/dev` is the guarded local-development path: it is hard-refused
 * (`403`) whenever `config.isProduction` is true OR `config.authDevMode` is
 * false, independent of the raw `AUTH_DEV_MODE` value (security spec §4).
 */

import { Router, json } from 'express';
import type { Response } from 'express';
import { SignJWT } from 'jose';
import type {
  AuthMe,
  DevLoginRequest,
  DevLoginResponse,
  LogoutResponse,
  SessionUser,
} from '@wiki/contracts';

import { config as processConfig } from '../config/index.js';
import { sendError } from '../auth/errors.js';
import type { AuthConfig, AuthUser } from '../auth/types.js';

/** Dev sessions are short-lived; the SSO path controls prod TTLs. */
const DEV_TOKEN_TTL = '12h';

export interface AuthRouterOptions {
  /** Config slice to read; defaults to the process config singleton. */
  config?: AuthConfig;
  /**
   * Dev signing secret. Defaults to `config.devAuth.jwtSigningKey` (UTF-8
   * encoded), or `null` when unset. Injectable for tests.
   */
  devSecret?: Uint8Array | null;
}

/** Project a verified session onto the `GET /api/auth/me` response shape. */
export function buildAuthMe(user: AuthUser | undefined): AuthMe {
  if (!user) return { authenticated: false };
  const { name, email, provider, canWrite } = user;
  return { authenticated: true, user: { name, email, provider, canWrite } };
}

function resolveDevSecret(
  options: AuthRouterOptions,
  cfg: AuthConfig,
): Uint8Array | null {
  if (options.devSecret !== undefined) return options.devSecret;
  const key = cfg.devAuth.jwtSigningKey;
  return key ? new TextEncoder().encode(key) : null;
}

/** Set the session cookie carrying the (dev-minted) JWT. */
function setSessionCookie(res: Response, cfg: AuthConfig, token: string): void {
  res.cookie(cfg.sso.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.isProduction,
    path: '/',
  });
}

/** Clear the wiki's local view of the session cookie. */
function clearSessionCookie(res: Response, cfg: AuthConfig): void {
  res.clearCookie(cfg.sso.sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.isProduction,
    path: '/',
  });
}

/** Build the central SSO logout redirect that clears the shared cookie. */
function buildLogoutRedirect(cfg: AuthConfig): string {
  const target = `https://${cfg.sso.audience}/`;
  const separator = cfg.sso.logoutUrl.includes('?') ? '&' : '?';
  return `${cfg.sso.logoutUrl}${separator}redirect=${target}`;
}

/**
 * Build the auth router. Owns only `/api/auth/*`; verification is the
 * middleware's job. Exposed as a factory so tests can inject a specific config
 * (notably a production config for the dev-guardrail test).
 */
export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const cfg = options.config ?? processConfig;
  const devSecret = resolveDevSecret(options, cfg);

  const router = Router();
  router.use(json());

  // GET /api/auth/me — reflect the middleware-verified session, no upstream call.
  router.get('/api/auth/me', (req, res) => {
    res.json(buildAuthMe(req.user));
  });

  // POST /api/auth/dev — local-only dev login. Guardrail first, always.
  router.post('/api/auth/dev', (req, res) => {
    void handleDevLogin(req.body as unknown, res, cfg, devSecret);
  });

  // POST /api/auth/logout — clear local cookie, hand back SSO logout redirect.
  router.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res, cfg);
    const body: LogoutResponse = {
      success: true,
      redirect: buildLogoutRedirect(cfg),
    };
    res.json(body);
  });

  return router;
}

/** Handle a dev-login attempt, enforcing the production guardrail. */
async function handleDevLogin(
  rawBody: unknown,
  res: Response,
  cfg: AuthConfig,
  devSecret: Uint8Array | null,
): Promise<void> {
  // Guardrail: refused in production, and whenever dev mode is off — regardless
  // of the raw AUTH_DEV_MODE value (security spec §4).
  if (cfg.isProduction || !cfg.authDevMode) {
    sendError(res, 403, 'FORBIDDEN', 'Dev login is disabled.');
    return;
  }

  const body = (rawBody ?? {}) as Partial<DevLoginRequest>;
  const { username: expectedUser, password: expectedPass } = cfg.devAuth;
  if (
    !expectedUser ||
    !expectedPass ||
    body.username !== expectedUser ||
    body.password !== expectedPass
  ) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid dev credentials.');
    return;
  }

  if (!devSecret) {
    sendError(res, 500, 'INTERNAL', 'Dev signing key is not configured.');
    return;
  }

  const user: SessionUser = {
    name: cfg.devAuth.name,
    email: cfg.devAuth.email,
    provider: 'dev',
    canWrite: true,
  };

  const token = await new SignJWT({
    provider: 'dev',
    canWrite: true,
    name: user.name,
    email: user.email,
    roles: ['editor'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(expectedUser)
    .setIssuedAt()
    .setIssuer(cfg.sso.issuer)
    .setAudience(cfg.sso.audience)
    .setExpirationTime(DEV_TOKEN_TTL)
    .sign(devSecret);

  setSessionCookie(res, cfg, token);
  const response: DevLoginResponse = { success: true, user };
  res.json(response);
}

/**
 * Auth router singleton bound to the process config. Mounted by the integrator
 * alongside the auth middleware; this module never touches `src/index.ts`.
 */
export const authRouter: Router = createAuthRouter();

export default authRouter;
