import { describe, expect, it, vi } from 'vitest';

import { ConfigError, type Logger, loadConfig } from './config.js';
import { type RawEnv, parseBool, parseInteger, parseList } from './env.js';

/** A production env with every required secret present. */
function validProdEnv(overrides: RawEnv = {}): RawEnv {
  return {
    NODE_ENV: 'production',
    SSO_JWKS_URL: 'https://sso.example.test/.well-known/jwks.json',
    SSO_ISSUER: 'https://sso.example.test',
    SSO_AUDIENCE: 'wiki.example.test',
    DOCS_REPO_URL: 'https://github.com/acme/docs.git',
    DOCS_GIT_APP_ID: '12345',
    DOCS_GIT_APP_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',
    DOCS_GIT_APP_INSTALLATION_ID: '67890',
    ...overrides,
  };
}

const silentLogger: Logger = { warn: () => {} };

describe('loadConfig — defaults (development)', () => {
  it('applies documented defaults when nothing is set', () => {
    const c = loadConfig({}, silentLogger);
    expect(c.nodeEnv).toBe('development');
    expect(c.isProduction).toBe(false);
    expect(c.port).toBe(3000);
    expect(c.clientDist).toBe('client/dist');
    expect(c.readAccess).toBe('AUTHENTICATED');
    expect(c.sso.sessionCookieName).toBe('tapestry_session');
    expect(c.docs.repoBranch).toBe('main');
    expect(c.docs.repoCacheDir).toBe('./repo-cache');
    expect(c.docs.syncPollInterval).toBe(300);
    expect(c.devAuth.name).toBe('dev');
    expect(c.devAuth.email).toBe('dev@localhost');
    expect(c.iframeAllowedHosts).toEqual([
      'youtube-nocookie.com',
      'youtube.com',
      'codesandbox.io',
    ]);
  });

  it('does not require secrets in development (uses SSO placeholders)', () => {
    const c = loadConfig({ NODE_ENV: 'development' }, silentLogger);
    expect(c.sso.jwksUrl).toContain('sso.prod.tapestry.app');
    expect(c.docs.repoUrl).toBeUndefined();
    expect(c.git.appId).toBeUndefined();
  });
});

describe('loadConfig — fail-fast in production', () => {
  it('refuses to start when required secrets are missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' }, silentLogger)).toThrow(
      ConfigError,
    );
  });

  it('names every missing required var in a clear message', () => {
    let error: ConfigError | undefined;
    try {
      loadConfig({ NODE_ENV: 'production' }, silentLogger);
    } catch (e) {
      error = e as ConfigError;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const problems = error!.problems.join('\n');
    for (const key of [
      'SSO_JWKS_URL',
      'SSO_ISSUER',
      'SSO_AUDIENCE',
      'DOCS_REPO_URL',
      'DOCS_GIT_APP_ID',
      'DOCS_GIT_APP_PRIVATE_KEY',
      'DOCS_GIT_APP_INSTALLATION_ID',
    ]) {
      expect(problems).toContain(key);
    }
    expect(error!.message).toContain('.env.example');
  });

  it('fails when only the git credential is missing', () => {
    const env = validProdEnv();
    delete env.DOCS_GIT_APP_PRIVATE_KEY;
    let error: ConfigError | undefined;
    try {
      loadConfig(env, silentLogger);
    } catch (e) {
      error = e as ConfigError;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect(error!.problems).toHaveLength(1);
    expect(error!.problems[0]).toContain('DOCS_GIT_APP_PRIVATE_KEY');
  });

  it('treats blank/whitespace-only values as missing', () => {
    expect(() =>
      loadConfig(validProdEnv({ SSO_ISSUER: '   ' }), silentLogger),
    ).toThrow(/SSO_ISSUER/);
  });

  it('loads successfully when all required secrets are present', () => {
    const c = loadConfig(validProdEnv(), silentLogger);
    expect(c.isProduction).toBe(true);
    expect(c.sso.audience).toBe('wiki.example.test');
    expect(c.docs.repoUrl).toBe('https://github.com/acme/docs.git');
    expect(c.git.appId).toBe('12345');
  });
});

describe('dev-auth guardrail (security spec §4)', () => {
  it('forces dev mode OFF and warns when AUTH_DEV_MODE=true in production', () => {
    const warn = vi.fn();
    const c = loadConfig(validProdEnv({ AUTH_DEV_MODE: 'true' }), { warn });
    expect(c.authDevMode).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/production/i);
  });

  it('keeps dev mode OFF in production even when unset', () => {
    const c = loadConfig(validProdEnv(), silentLogger);
    expect(c.authDevMode).toBe(false);
  });

  it('honours AUTH_DEV_MODE=true in development', () => {
    const c = loadConfig(
      { NODE_ENV: 'development', AUTH_DEV_MODE: 'true' },
      silentLogger,
    );
    expect(c.authDevMode).toBe(true);
  });
});

describe('loadConfig — parsing', () => {
  it('parses PORT and rejects a non-integer', () => {
    expect(loadConfig({ PORT: '8080' }, silentLogger).port).toBe(8080);
    expect(() => loadConfig({ PORT: 'abc' }, silentLogger)).toThrow(/PORT/);
  });

  it('rejects an invalid READ_ACCESS value', () => {
    expect(() => loadConfig({ READ_ACCESS: 'EVERYONE' }, silentLogger)).toThrow(
      /READ_ACCESS/,
    );
  });

  it('parses SYNC_POLL_INTERVAL=0 (polling disabled)', () => {
    expect(
      loadConfig({ SYNC_POLL_INTERVAL: '0' }, silentLogger).docs
        .syncPollInterval,
    ).toBe(0);
  });

  it('parses EDIT_ALLOWLIST and IFRAME_ALLOWED_HOSTS as trimmed lists', () => {
    const c = loadConfig(
      {
        EDIT_ALLOWLIST: 'a@x.com, b@x.com , ',
        IFRAME_ALLOWED_HOSTS: 'a.com,b.com',
      },
      silentLogger,
    );
    expect(c.editAllowlist).toEqual(['a@x.com', 'b@x.com']);
    expect(c.iframeAllowedHosts).toEqual(['a.com', 'b.com']);
  });
});

describe('env helpers', () => {
  it('parseBool accepts common truthy/falsey spellings', () => {
    expect(parseBool('YES', false)).toBe(true);
    expect(parseBool('off', true)).toBe(false);
    expect(parseBool(undefined, true)).toBe(true);
    expect(() => parseBool('maybe', false)).toThrow();
  });

  it('parseInteger enforces min', () => {
    expect(() => parseInteger('-1', 0, { min: 0 })).toThrow();
    expect(parseInteger(undefined, 42)).toBe(42);
  });

  it('parseList drops empties', () => {
    expect(parseList(' , x ,,y', [])).toEqual(['x', 'y']);
  });
});
