import crypto from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createGitCredentialProvider,
  type GitCredentialConfig,
  type TokenFetcher,
  type TokenResponse,
} from './git-credential.js';

/** A real RSA keypair so `crypto.sign('RSA-SHA256', …)` actually runs. */
let privateKey: string;
let publicKey: string;

beforeAll(() => {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = pair.privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
});

const APP_ID = '112233';
const INSTALLATION_ID = '445566';
const TOKEN = 'ghs_installationtokenSECRET';

function configuredConfig(): GitCredentialConfig {
  return {
    appId: APP_ID,
    appPrivateKey: privateKey,
    appInstallationId: INSTALLATION_ID,
  };
}

/**
 * A fetcher that returns a fixed installation token and records the request.
 * `expires_at` is computed from `nowFn` so it aligns with the provider's
 * injected clock in cache tests.
 */
function okFetcher(
  overrides: {
    token?: string;
    expiresInMs?: number;
    nowFn?: () => number;
  } = {},
): TokenFetcher & {
  calls: { url: string; headers: Record<string, string> }[];
} {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const token = overrides.token ?? TOKEN;
  const expiresInMs = overrides.expiresInMs ?? 60 * 60_000;
  const nowFn = overrides.nowFn ?? Date.now;
  const fn = vi.fn(async (url: string, init) => {
    calls.push({ url, headers: init.headers });
    const res: TokenResponse = {
      ok: true,
      status: 201,
      json: async () => ({
        token,
        expires_at: new Date(nowFn() + expiresInMs).toISOString(),
      }),
    };
    return res;
  }) as unknown as TokenFetcher & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

describe('createGitCredentialProvider — unconfigured', () => {
  it('is not configured and yields an unauthenticated env', async () => {
    const provider = createGitCredentialProvider({
      appId: undefined,
      appPrivateKey: undefined,
      appInstallationId: undefined,
    });
    expect(provider.configured).toBe(false);

    const auth = await provider.authenticate();
    expect(auth.config).toEqual([]);
    expect(auth.env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(provider.describe()).not.toContain('Basic');
  });
});

describe('createGitCredentialProvider — GitHub App', () => {
  it('mints an installation token and injects it as a git auth header', async () => {
    const fetcher = okFetcher();
    const provider = createGitCredentialProvider(configuredConfig(), {
      fetcher,
    });
    expect(provider.configured).toBe(true);

    const auth = await provider.authenticate();

    // Token is delivered via http.extraheader, never on a URL.
    expect(auth.config).toHaveLength(1);
    const expectedBasic = Buffer.from(`x-access-token:${TOKEN}`).toString(
      'base64',
    );
    expect(auth.config[0]).toBe(
      `http.extraheader=Authorization: Basic ${expectedBasic}`,
    );
    expect(auth.env.GIT_TERMINAL_PROMPT).toBe('0');

    // Exchange hit the right installation endpoint.
    expect(fetcher.calls).toHaveLength(1);
    expect(fetcher.calls[0].url).toBe(
      `https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`,
    );
  });

  it('signs a verifiable RS256 App JWT with iss = appId', async () => {
    const fetcher = okFetcher();
    const provider = createGitCredentialProvider(configuredConfig(), {
      fetcher,
    });
    await provider.authenticate();

    const bearer = fetcher.calls[0].headers.Authorization;
    expect(bearer).toMatch(/^Bearer /u);
    const jwt = bearer.slice('Bearer '.length);
    const [encHeader, encPayload, encSig] = jwt.split('.');

    const decode = (s: string) =>
      JSON.parse(
        Buffer.from(
          s.replace(/-/gu, '+').replace(/_/gu, '/'),
          'base64',
        ).toString('utf8'),
      );
    expect(decode(encHeader)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(encPayload).iss).toBe(APP_ID);

    // Signature verifies against the public key => the private key was used.
    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${encHeader}.${encPayload}`),
      publicKey,
      Buffer.from(encSig.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64'),
    );
    expect(verified).toBe(true);
  });

  it('caches the token and re-mints only near expiry', async () => {
    let clock = 1_000_000;
    const fetcher = okFetcher({
      expiresInMs: 60 * 60_000,
      nowFn: () => clock,
    });
    const provider = createGitCredentialProvider(configuredConfig(), {
      fetcher,
      now: () => clock,
    });

    await provider.authenticate();
    await provider.authenticate();
    expect(fetcher.calls).toHaveLength(1); // cached

    // Advance to within the refresh skew of expiry.
    clock += 60 * 60_000; // past a 1h token minus skew
    await provider.authenticate();
    expect(fetcher.calls).toHaveLength(2); // re-minted
  });

  it('throws a secret-free error when the exchange fails', async () => {
    const fetcher: TokenFetcher = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: 'nope' }),
    });
    const provider = createGitCredentialProvider(configuredConfig(), {
      fetcher,
    });

    await expect(provider.authenticate()).rejects.toThrow(/HTTP 403/u);
    await expect(provider.authenticate()).rejects.not.toThrow(
      new RegExp(
        privateKey.slice(40, 80).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      ),
    );
  });

  it('never leaks the private key or token in describe()', async () => {
    const fetcher = okFetcher();
    const provider = createGitCredentialProvider(configuredConfig(), {
      fetcher,
    });
    await provider.authenticate();

    const description = provider.describe();
    expect(description).not.toContain(TOKEN);
    expect(description).not.toContain('PRIVATE KEY');
    expect(description).not.toContain(privateKey);
    // The App id and installation id are identifiers, not secrets — fine to log.
    expect(description).toContain(APP_ID);
    expect(description).toContain(INSTALLATION_ID);
  });
});
