/**
 * Tests for B8 — auth middleware (JWT/JWKS) + `/api/auth/{me,dev,logout}`.
 *
 * Covers:
 *  - REQUIRED guardrail: a production-config boot returns `403` from
 *    `POST /api/auth/dev` even with `AUTH_DEV_MODE=true`.
 *  - Signature/claim rejection: `alg:none`, wrong `aud`, wrong `iss`, expired,
 *    and any non-asymmetric alg (`HS256`) are all rejected on the SSO path.
 *  - Capability: a `firebase`-provider claim yields `canWrite:false`, enforced
 *    by `requireWrite` on a sample write route.
 *  - Dev login happy path + wrong credentials, and the `/me` + `/logout` shapes.
 *  - `READ_ACCESS` honoured by `createRequireRead`.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { SignJWT, generateKeyPair, type CryptoKey } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AuthMe, DevLoginResponse, LogoutResponse } from '@wiki/contracts';

import { loadConfig } from '../config/config.js';
import type { AuthConfig } from './types.js';
import {
  createAuthMiddleware,
  createRequireRead,
  requireWrite,
  type VerifyKey,
} from './middleware.js';
import { createAuthRouter } from '../routes/auth.js';

const SILENT = { warn(): void {} };
const ISSUER = 'https://sso.test';
const AUDIENCE = 'wiki.test';
const COOKIE = 'wiki_session';
const DEV_KEY = 'dev-signing-secret-key-at-least-32b!';

/** A test config with dev mode enabled (non-production). */
function devConfig(overrides: Record<string, string> = {}): AuthConfig {
  return loadConfig(
    {
      NODE_ENV: 'test',
      AUTH_DEV_MODE: 'true',
      DEV_AUTH_USERNAME: 'devuser',
      DEV_AUTH_PASSWORD: 'devpass',
      DEV_AUTH_NAME: 'Dev User',
      DEV_AUTH_EMAIL: 'dev@localhost',
      DEV_JWT_SIGNING_KEY: DEV_KEY,
      SSO_ISSUER: ISSUER,
      SSO_AUDIENCE: AUDIENCE,
      SESSION_COOKIE_NAME: COOKIE,
      ...overrides,
    },
    SILENT,
  );
}

/** A full production config (all prod-required vars set) with AUTH_DEV_MODE=true. */
function prodConfig(): AuthConfig {
  return loadConfig(
    {
      NODE_ENV: 'production',
      AUTH_DEV_MODE: 'true',
      SSO_JWKS_URL: 'https://sso.prod.example/.well-known/jwks.json',
      SSO_ISSUER: 'https://sso.prod.example',
      SSO_AUDIENCE: 'wiki.prod.example',
      SESSION_COOKIE_NAME: COOKIE,
      DEV_AUTH_USERNAME: 'devuser',
      DEV_AUTH_PASSWORD: 'devpass',
      DEV_JWT_SIGNING_KEY: DEV_KEY,
      DOCS_REPO_URL: 'https://example.com/docs.git',
      DOCS_GIT_APP_ID: '123',
      DOCS_GIT_APP_PRIVATE_KEY: 'private-key',
      DOCS_GIT_APP_INSTALLATION_ID: '456',
    },
    SILENT,
  );
}

let ssoKeys: { publicKey: CryptoKey; privateKey: CryptoKey };

beforeAll(async () => {
  ssoKeys = await generateKeyPair('RS256');
});

/** Sign an SSO-style RS256 token with configurable claims/iss/aud/exp. */
async function signSso(
  claims: Record<string, unknown>,
  opts: { issuer?: string; audience?: string; exp?: string | number } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setExpirationTime(opts.exp ?? '1h')
    .sign(ssoKeys.privateKey);
}

/** Sign an HS256 token with an arbitrary secret (used for non-asymmetric tests). */
async function signHs(secret: string): Promise<string> {
  return new SignJWT({ provider: 'github', canWrite: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Craft an unsigned `alg:none` token (never producible via jose's signer). */
function noneToken(payload: Record<string, unknown>): string {
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
    iss: ISSUER,
    aud: AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  })}.`;
}

interface AppOptions {
  config: AuthConfig;
  ssoKeySet?: VerifyKey;
  devSecret?: Uint8Array | null;
}

/** Wire middleware + auth router + sample read/write routes into a bare app. */
function buildApp(opts: AppOptions): Express {
  const app = express();
  app.use(
    createAuthMiddleware({
      config: opts.config,
      ssoKeySet: opts.ssoKeySet ?? ssoKeys.publicKey,
      devSecret: opts.devSecret,
    }),
  );
  app.use(createAuthRouter({ config: opts.config, devSecret: opts.devSecret }));
  app.post('/api/sample/write', requireWrite, (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/sample/read', createRequireRead(opts.config), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

const withCookie = (token: string) => `${COOKIE}=${token}`;

/** Pull the session cookie value out of a Set-Cookie response header. */
function sessionCookieFrom(
  setCookie: string[] | undefined,
): string | undefined {
  const header = (setCookie ?? []).find((c) => c.startsWith(`${COOKIE}=`));
  return header?.split(';')[0]?.split('=').slice(1).join('=');
}

describe('POST /api/auth/dev — production guardrail (REQUIRED)', () => {
  it('returns 403 in production even when AUTH_DEV_MODE=true', async () => {
    const cfg = prodConfig();
    // Sanity: loadConfig forces dev mode off in production.
    expect(cfg.isProduction).toBe(true);
    expect(cfg.authDevMode).toBe(false);

    const res = await request(buildApp({ config: cfg }))
      .post('/api/auth/dev')
      .set('Connection', 'close')
      .send({ username: 'devuser', password: 'devpass' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/auth/dev — local dev login', () => {
  it('mints a dev session for valid credentials (provider:dev, canWrite:true)', async () => {
    const app = buildApp({ config: devConfig() });
    const res = await request(app)
      .post('/api/auth/dev')
      .set('Connection', 'close')
      .send({ username: 'devuser', password: 'devpass' });

    expect(res.status).toBe(200);
    const body = res.body as DevLoginResponse;
    expect(body.success).toBe(true);
    expect(body.user.provider).toBe('dev');
    expect(body.user.canWrite).toBe(true);

    // The minted cookie verifies on a subsequent request.
    const token = sessionCookieFrom(res.headers['set-cookie']);
    expect(token).toBeTruthy();
    const me = await request(app)
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token!));
    expect((me.body as AuthMe).authenticated).toBe(true);
    expect((me.body as AuthMe).user?.provider).toBe('dev');
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await request(buildApp({ config: devConfig() }))
      .post('/api/auth/dev')
      .set('Connection', 'close')
      .send({ username: 'devuser', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when AUTH_DEV_MODE is off (non-production)', async () => {
    const cfg = devConfig({ AUTH_DEV_MODE: 'false' });
    const res = await request(buildApp({ config: cfg }))
      .post('/api/auth/dev')
      .set('Connection', 'close')
      .send({ username: 'devuser', password: 'devpass' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/auth/me', () => {
  it('reports unauthenticated with no cookie', async () => {
    const res = await request(buildApp({ config: devConfig() }))
      .get('/api/auth/me')
      .set('Connection', 'close');
    expect(res.body).toEqual({ authenticated: false });
  });

  it('reflects a valid github SSO session', async () => {
    const token = await signSso({
      name: 'Ada Lovelace',
      email: 'ada@tapestry.app',
      provider: 'github',
      canWrite: true,
    });
    const res = await request(buildApp({ config: devConfig() }))
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));

    const body = res.body as AuthMe;
    expect(body.authenticated).toBe(true);
    expect(body.user).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@tapestry.app',
      provider: 'github',
      canWrite: true,
    });
  });
});

describe('JWT verification rejects unsafe / invalid tokens', () => {
  it('rejects alg:none tokens', async () => {
    const token = noneToken({ provider: 'github', canWrite: true });
    const res = await request(buildApp({ config: devConfig() }))
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect((res.body as AuthMe).authenticated).toBe(false);
  });

  it('rejects a non-asymmetric (HS256) token on the SSO path', async () => {
    // Dev mode off ⇒ only the SSO path runs, which forbids HS256.
    const token = await signHs('some-other-secret');
    const res = await request(
      buildApp({ config: devConfig({ AUTH_DEV_MODE: 'false' }) }),
    )
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect((res.body as AuthMe).authenticated).toBe(false);
  });

  it('rejects a wrong-audience token', async () => {
    const token = await signSso(
      { provider: 'github', canWrite: true },
      { audience: 'wiki.other' },
    );
    const res = await request(buildApp({ config: devConfig() }))
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect((res.body as AuthMe).authenticated).toBe(false);
  });

  it('rejects a wrong-issuer token', async () => {
    const token = await signSso(
      { provider: 'github', canWrite: true },
      { issuer: 'https://evil.test' },
    );
    const res = await request(buildApp({ config: devConfig() }))
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect((res.body as AuthMe).authenticated).toBe(false);
  });

  it('rejects an expired token', async () => {
    const token = await signSso(
      { provider: 'github', canWrite: true },
      { exp: Math.floor(Date.now() / 1000) - 60 },
    );
    const res = await request(buildApp({ config: devConfig() }))
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect((res.body as AuthMe).authenticated).toBe(false);
  });
});

describe('requireWrite guard', () => {
  it('allows a github (canWrite) session to write', async () => {
    const token = await signSso({ provider: 'github', canWrite: true });
    const res = await request(buildApp({ config: devConfig() }))
      .post('/api/sample/write')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('forces canWrite:false for a firebase claim and rejects writes with 403', async () => {
    // Even though the claim asserts canWrite:true, firebase is read-only.
    const token = await signSso({
      provider: 'firebase',
      canWrite: true,
      name: 'Reader',
      email: 'reader@tapestry.app',
    });
    const app = buildApp({ config: devConfig() });

    const me = await request(app)
      .get('/api/auth/me')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect((me.body as AuthMe).user?.canWrite).toBe(false);

    const write = await request(app)
      .post('/api/sample/write')
      .set('Connection', 'close')
      .set('Cookie', withCookie(token));
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an unauthenticated write with 401', async () => {
    const res = await request(buildApp({ config: devConfig() }))
      .post('/api/sample/write')
      .set('Connection', 'close');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('READ_ACCESS via createRequireRead', () => {
  it('rejects unauthenticated reads when READ_ACCESS=AUTHENTICATED', async () => {
    const res = await request(
      buildApp({ config: devConfig({ READ_ACCESS: 'AUTHENTICATED' }) }),
    )
      .get('/api/sample/read')
      .set('Connection', 'close');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows unauthenticated reads when READ_ACCESS=PUBLIC', async () => {
    const res = await request(
      buildApp({ config: devConfig({ READ_ACCESS: 'PUBLIC' }) }),
    )
      .get('/api/sample/read')
      .set('Connection', 'close');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie and returns an SSO logout redirect', async () => {
    const res = await request(buildApp({ config: devConfig() }))
      .post('/api/auth/logout')
      .set('Connection', 'close');

    expect(res.status).toBe(200);
    const body = res.body as LogoutResponse;
    expect(body.success).toBe(true);
    expect(body.redirect).toContain('/logout');
    expect(body.redirect).toContain('redirect=');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.some((c) => c.startsWith(`${COOKIE}=`))).toBe(true);
  });
});
