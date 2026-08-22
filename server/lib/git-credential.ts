/**
 * Git machine-credential provider.
 *
 * Builds an **authenticated git environment** for all network git operations
 * against the docs repo — clone/pull today (B1), sync (B7) and v1 push later.
 * Per ADR-0005 ("How git operations work"), this credential is a *server-side
 * machine identity*, entirely independent of any user's SSO cookie: the wiki
 * never acts as the user against GitHub.
 *
 * The credential is a **GitHub App installation token** minted from
 * `config.git` (`DOCS_GIT_APP_ID` / `DOCS_GIT_APP_PRIVATE_KEY` /
 * `DOCS_GIT_APP_INSTALLATION_ID`):
 *
 *   1. Sign a short-lived RS256 JWT with the App private key (`iss = appId`).
 *   2. Exchange it at GitHub's REST API for an installation access token.
 *   3. Inject the token into git via a `-c http.extraheader=Authorization: …`
 *      config pair, so the secret rides in the request header — never in the
 *      remote URL (which git is liable to echo in logs).
 *
 * Installation tokens last ~1h; the minted token is cached and refreshed only
 * as it nears expiry. When no App credential is configured (local dev against a
 * public repo) the provider yields an unauthenticated environment.
 *
 * **Secret hygiene:** the private key, the App JWT, and the installation token
 * are never returned in {@link GitCredentialProvider.describe}, never logged,
 * and never placed on argv or the remote URL. Callers pass {@link GitAuth.config}
 * as `-c <pair>` arguments to `execFile('git', …)` and merge {@link GitAuth.env}.
 */

import crypto from 'node:crypto';

/** The subset of `config.git` this provider consumes (F3 `Config['git']`). */
export interface GitCredentialConfig {
  appId: string | undefined;
  appPrivateKey: string | undefined;
  appInstallationId: string | undefined;
}

/**
 * Authenticated git invocation material. Spread {@link config} as `-c` pairs
 * before the git subcommand and merge {@link env} into the child env.
 */
export interface GitAuth {
  /** `key=value` pairs to pass as `-c <pair>` (may carry the auth header). */
  config: string[];
  /** Extra environment variables. Never contains the raw private key. */
  env: NodeJS.ProcessEnv;
}

/** Minimal HTTP response shape used by {@link TokenFetcher}. */
export interface TokenResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Injectable HTTP client for the installation-token exchange. Defaults to the
 * global `fetch`; tests substitute a fake so no network is touched.
 */
export type TokenFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<TokenResponse>;

/** A source of the current time in epoch ms (injectable for token-cache tests). */
export type Clock = () => number;

/** Builds authenticated git environments from a machine credential. */
export interface GitCredentialProvider {
  /** Whether a GitHub App machine credential is configured. */
  readonly configured: boolean;
  /**
   * Produce auth material for a git command, minting/refreshing the
   * installation token as needed. Resolves to an empty (unauthenticated)
   * environment when {@link configured} is `false`.
   */
  authenticate(): Promise<GitAuth>;
  /** Human-readable, **secret-free** description for logs. */
  describe(): string;
}

export interface GitCredentialOptions {
  /** Override the token-exchange HTTP client (tests). */
  fetcher?: TokenFetcher;
  /** Override the clock (tests). */
  now?: Clock;
}

const GITHUB_API = 'https://api.github.com';
/** Refresh the installation token this many ms before it actually expires. */
const TOKEN_REFRESH_SKEW_MS = 60_000;

/** URL-safe, unpadded base64 (JWS/JWT encoding). */
function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/u, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');
}

/**
 * Mint a short-lived RS256 App JWT (`iss = appId`). GitHub caps the lifetime at
 * 10 minutes; we use 9 and back-date `iat` 30s to tolerate clock skew.
 */
function createAppJwt(
  appId: string,
  privateKey: string,
  nowMs: number,
): string {
  const iat = Math.floor(nowMs / 1000) - 30;
  const exp = iat + 9 * 60;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat, exp, iss: appId }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(signingInput),
    privateKey,
  );
  return `${signingInput}.${base64url(signature)}`;
}

/** Default token exchange over the global `fetch`. */
const defaultFetcher: TokenFetcher = (url, init) =>
  globalThis.fetch(url, init as RequestInit);

interface CachedToken {
  token: string;
  /** Epoch ms after which the token must be re-minted. */
  expiresAtMs: number;
}

/**
 * Construct a {@link GitCredentialProvider} from the machine-credential config.
 * Pure and side-effect-free until {@link GitCredentialProvider.authenticate} is
 * first awaited.
 */
export function createGitCredentialProvider(
  config: GitCredentialConfig,
  options: GitCredentialOptions = {},
): GitCredentialProvider {
  const fetcher = options.fetcher ?? defaultFetcher;
  const now = options.now ?? Date.now;

  const { appId, appPrivateKey, appInstallationId } = config;
  const configured = Boolean(appId && appPrivateKey && appInstallationId);

  let cached: CachedToken | undefined;

  async function mintInstallationToken(): Promise<CachedToken> {
    // `configured` guarantees these are defined; assert for the type-checker.
    const id = appId as string;
    const key = appPrivateKey as string;
    const installationId = appInstallationId as string;

    const jwt = createAppJwt(id, key, now());
    const res = await fetcher(
      `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'git-wiki',
        },
      },
    );

    if (!res.ok) {
      // Report the status only — never the JWT, token, or response body, which
      // may echo the credential.
      throw new Error(
        `GitHub App installation-token exchange failed (HTTP ${res.status})`,
      );
    }

    const body = (await res.json()) as {
      token?: unknown;
      expires_at?: unknown;
    };
    if (typeof body.token !== 'string') {
      throw new Error(
        'GitHub App installation-token exchange returned no token',
      );
    }
    const expiresAtMs =
      typeof body.expires_at === 'string'
        ? Date.parse(body.expires_at)
        : Number.NaN;

    return {
      token: body.token,
      // Fall back to a conservative 55-minute lifetime if `expires_at` is
      // missing/unparseable (GitHub tokens last ~60 min).
      expiresAtMs: Number.isNaN(expiresAtMs)
        ? now() + 55 * 60_000
        : expiresAtMs,
    };
  }

  async function currentToken(): Promise<string> {
    if (cached && cached.expiresAtMs - TOKEN_REFRESH_SKEW_MS > now()) {
      return cached.token;
    }
    cached = await mintInstallationToken();
    return cached.token;
  }

  return {
    configured,

    async authenticate(): Promise<GitAuth> {
      // Never let git fall back to an interactive credential prompt.
      const env: NodeJS.ProcessEnv = { GIT_TERMINAL_PROMPT: '0' };

      if (!configured) {
        return { config: [], env };
      }

      const token = await currentToken();
      // GitHub git-over-HTTPS auth: basic, username `x-access-token`, password
      // = installation token. Delivered as a header so the token never lands in
      // the remote URL or argv-visible config.
      const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
      return {
        config: [`http.extraheader=Authorization: Basic ${basic}`],
        env,
      };
    },

    describe(): string {
      return configured
        ? `GitHub App credential (app ${appId as string}, installation ${
            appInstallationId as string
          })`
        : 'no git machine credential configured (unauthenticated git)';
    },
  };
}
