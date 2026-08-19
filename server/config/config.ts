/**
 * Typed configuration loader for the git-wiki backend.
 *
 * Reads every variable documented in `docs/specs/configuration.md`, applies the
 * documented defaults, and — in production — **fails fast** when a required
 * secret is missing. Also enforces the dev-auth guardrail from
 * `docs/specs/security-and-safety.md` §4: `AUTH_DEV_MODE` can never be on in
 * production.
 *
 * The loader is a pure function of its `env` argument (defaulting to
 * `process.env`) and an injectable `logger`, so it is fully unit-testable
 * without mutating global state.
 */

import {
  type RawEnv,
  parseBool,
  parseEnum,
  parseInteger,
  parseList,
  readString,
} from './env.js';

export type ReadAccess = 'PUBLIC' | 'AUTHENTICATED';

export interface Config {
  /** Raw `NODE_ENV`; `development` when unset. */
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;

  /** Backend HTTP port (`PORT`, default 3000). */
  port: number;
  /**
   * Directory of the built client bundle served statically in production
   * (`CLIENT_DIST`). Not in the spec table — a server-runtime path consumed by
   * the entrypoint; documented in `.env.example`.
   */
  clientDist: string;
  /** Who may read docs (`READ_ACCESS`). */
  readAccess: ReadAccess;

  /** SSO session-verification settings (ADR-0005). Required in production. */
  sso: {
    jwksUrl: string;
    issuer: string;
    audience: string;
    sessionCookieName: string;
    logoutUrl: string;
  };

  /** Docs repository + sync settings. */
  docs: {
    /** `DOCS_REPO_URL` — required in production, no default. */
    repoUrl: string | undefined;
    repoBranch: string;
    repoCacheDir: string;
    /** Seconds between background pulls; `0` disables polling. */
    syncPollInterval: number;
  };

  /**
   * GitHub App machine credential (`DOCS_GIT_APP_*`) used for all clone/pull/
   * push against the docs repo. The most sensitive secret the wiki holds;
   * required in production, never defaulted.
   */
  git: {
    appId: string | undefined;
    appPrivateKey: string | undefined;
    appInstallationId: string | undefined;
  };

  /** Usernames/emails permitted to write in v1 (`EDIT_ALLOWLIST`). */
  editAllowlist: string[];

  /**
   * Whether `POST /api/auth/dev` is enabled. Hard-forced `false` in production
   * regardless of the `AUTH_DEV_MODE` value (guardrail).
   */
  authDevMode: boolean;
  devAuth: {
    username: string | undefined;
    password: string | undefined;
    jwtSigningKey: string | undefined;
    name: string;
    email: string;
  };

  /** Host allowlist for iframe `src` and CSP `frame-src`. */
  iframeAllowedHosts: string[];
}

/** Minimal logger surface so callers/tests can capture warnings. */
export interface Logger {
  warn(message: string): void;
}

/** Thrown when configuration is invalid. Carries the list of problems. */
export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(
      `Invalid configuration:\n${problems
        .map((p) => `  - ${p}`)
        .join('\n')}\nSee .env.example and docs/specs/configuration.md.`,
    );
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

// Documented production defaults for the SSO block. Applied outside production
// so local dev boots without ceremony; in production these vars must be set
// explicitly (fail-fast), independent of these placeholders.
const SSO_DEFAULTS = {
  jwksUrl: 'https://sso.prod.tapestry.app/.well-known/jwks.json',
  issuer: 'https://sso.prod.tapestry.app',
  audience: 'wiki.prod.tapestry.app',
} as const;

/**
 * Loads and validates configuration.
 *
 * @param env    Source of raw values (defaults to `process.env`).
 * @param logger Warning sink (defaults to `console`).
 * @throws {ConfigError} in production when a required value is missing/invalid.
 */
export function loadConfig(
  env: RawEnv = process.env,
  logger: Logger = console,
): Config {
  const problems: string[] = [];
  const nodeEnv = readString(env, 'NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  /** Wrap a parse helper, converting thrown errors into recorded problems. */
  const guard = <T>(key: string, fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (err) {
      problems.push(`${key}: ${(err as Error).message}`);
      return fallback;
    }
  };

  /**
   * A value that is required in production. Outside production it falls back to
   * `devDefault` (which may be `undefined`); in production a missing value is a
   * hard error.
   */
  const requiredInProd = (
    key: string,
    devDefault?: string,
  ): string | undefined => {
    const value = readString(env, key);
    if (value !== undefined) return value;
    if (isProduction) {
      problems.push(`${key} is required in production but is not set`);
      return undefined;
    }
    return devDefault;
  };

  const port = guard(
    'PORT',
    () => parseInteger(env.PORT, 3000, { min: 0 }),
    3000,
  );
  const readAccess = guard(
    'READ_ACCESS',
    () =>
      parseEnum(
        readString(env, 'READ_ACCESS'),
        ['PUBLIC', 'AUTHENTICATED'] as const,
        'AUTHENTICATED',
      ),
    'AUTHENTICATED',
  );

  // Dev-auth guardrail: AUTH_DEV_MODE is honoured only outside production.
  const rawAuthDevMode = guard(
    'AUTH_DEV_MODE',
    () => parseBool(env.AUTH_DEV_MODE, false),
    false,
  );
  let authDevMode = rawAuthDevMode;
  if (isProduction && rawAuthDevMode) {
    logger.warn(
      'AUTH_DEV_MODE=true is ignored in production; dev login (POST /api/auth/dev) stays disabled.',
    );
    authDevMode = false;
  } else if (isProduction) {
    authDevMode = false;
  }

  const syncPollInterval = guard(
    'SYNC_POLL_INTERVAL',
    () => parseInteger(env.SYNC_POLL_INTERVAL, 300, { min: 0 }),
    300,
  );

  const config: Config = {
    nodeEnv,
    isProduction,
    isTest,
    port,
    clientDist: readString(env, 'CLIENT_DIST') ?? 'client/dist',
    readAccess,
    sso: {
      // Required in production; documented prod defaults used only in dev/test.
      jwksUrl:
        requiredInProd('SSO_JWKS_URL', SSO_DEFAULTS.jwksUrl) ??
        SSO_DEFAULTS.jwksUrl,
      issuer:
        requiredInProd('SSO_ISSUER', SSO_DEFAULTS.issuer) ??
        SSO_DEFAULTS.issuer,
      audience:
        requiredInProd('SSO_AUDIENCE', SSO_DEFAULTS.audience) ??
        SSO_DEFAULTS.audience,
      sessionCookieName:
        readString(env, 'SESSION_COOKIE_NAME') ?? 'tapestry_session',
      logoutUrl:
        readString(env, 'SSO_LOGOUT_URL') ??
        'https://sso.prod.tapestry.app/logout',
    },
    docs: {
      repoUrl: requiredInProd('DOCS_REPO_URL'),
      repoBranch: readString(env, 'DOCS_REPO_BRANCH') ?? 'main',
      repoCacheDir: readString(env, 'REPO_CACHE_DIR') ?? './repo-cache',
      syncPollInterval,
    },
    git: {
      appId: requiredInProd('DOCS_GIT_APP_ID'),
      appPrivateKey: requiredInProd('DOCS_GIT_APP_PRIVATE_KEY'),
      appInstallationId: requiredInProd('DOCS_GIT_APP_INSTALLATION_ID'),
    },
    editAllowlist: parseList(readString(env, 'EDIT_ALLOWLIST'), []),
    authDevMode,
    devAuth: {
      username: readString(env, 'DEV_AUTH_USERNAME'),
      password: readString(env, 'DEV_AUTH_PASSWORD'),
      jwtSigningKey: readString(env, 'DEV_JWT_SIGNING_KEY'),
      name: readString(env, 'DEV_AUTH_NAME') ?? 'dev',
      email: readString(env, 'DEV_AUTH_EMAIL') ?? 'dev@localhost',
    },
    iframeAllowedHosts: parseList(readString(env, 'IFRAME_ALLOWED_HOSTS'), [
      'youtube-nocookie.com',
      'youtube.com',
      'codesandbox.io',
    ]),
  };

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return config;
}
