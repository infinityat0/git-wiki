import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitCredentialProvider } from '../lib/git-credential.js';
import {
  bootstrapRepoCache,
  type GitRunner,
  type RepoCacheLogger,
} from './repo-cache.js';
import { ReadinessRegistry } from './readiness.js';

/** A credential whose auth header carries a recognisable fake secret. */
const FAKE_SECRET = 'ghs_FAKE_INSTALLATION_TOKEN';
const fakeCredential: GitCredentialProvider = {
  configured: true,
  authenticate: async () => ({
    config: [`http.extraheader=Authorization: Basic ${FAKE_SECRET}`],
    env: { GIT_TERMINAL_PROMPT: '0' },
  }),
  describe: () => 'GitHub App credential (app 1, installation 2)',
};

function makeLogger(): RepoCacheLogger & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    info: (m) => lines.push(m),
    error: (m) => lines.push(m),
  };
}

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-cache-test-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('bootstrapRepoCache — clone (empty cache)', () => {
  it('clones with the credential config args and marks the repo ready', async () => {
    const cacheDir = path.join(tmpRoot, 'repo-cache'); // does not exist yet
    const registry = new ReadinessRegistry();
    const runGit = vi.fn<GitRunner>(async () => ({ stdout: '', stderr: '' }));

    const result = await bootstrapRepoCache({
      repoUrl: 'https://github.com/acme/docs.git',
      branch: 'main',
      cacheDir,
      credential: fakeCredential,
      registry,
      runGit,
    });

    expect(result).toEqual({ action: 'clone', ok: true });
    expect(runGit).toHaveBeenCalledTimes(1);
    const [args, opts] = runGit.mock.calls[0];
    expect(args).toEqual([
      '-c',
      `http.extraheader=Authorization: Basic ${FAKE_SECRET}`,
      'clone',
      '--branch',
      'main',
      '--single-branch',
      'https://github.com/acme/docs.git',
      '.',
    ]);
    expect(opts.cwd).toBe(cacheDir);
    expect(opts.env.GIT_TERMINAL_PROMPT).toBe('0');

    expect(registry.repoPresent).toBe(true);
    expect(registry.docsRepo).toBe('clean');
  });
});

describe('bootstrapRepoCache — pull (existing clone)', () => {
  it('fast-forward pulls when a .git dir already exists', async () => {
    const cacheDir = path.join(tmpRoot, 'repo-cache');
    await fs.mkdir(path.join(cacheDir, '.git'), { recursive: true });
    const registry = new ReadinessRegistry();
    const runGit = vi.fn<GitRunner>(async () => ({
      stdout: 'Already up to date.',
      stderr: '',
    }));

    const result = await bootstrapRepoCache({
      repoUrl: 'https://github.com/acme/docs.git',
      branch: 'develop',
      cacheDir,
      credential: fakeCredential,
      registry,
      runGit,
    });

    expect(result).toEqual({ action: 'pull', ok: true });
    const [args, opts] = runGit.mock.calls[0];
    expect(args).toEqual([
      '-c',
      `http.extraheader=Authorization: Basic ${FAKE_SECRET}`,
      'pull',
      '--ff-only',
      'origin',
      'develop',
    ]);
    expect(opts.cwd).toBe(cacheDir);
    expect(registry.repoPresent).toBe(true);
    expect(registry.docsRepo).toBe('clean');
  });
});

describe('bootstrapRepoCache — status transitions & safety', () => {
  it('marks docsRepo syncing during the operation and clean after', async () => {
    const cacheDir = path.join(tmpRoot, 'repo-cache');
    const registry = new ReadinessRegistry();
    let statusDuringGit: string | undefined;
    const runGit: GitRunner = async () => {
      statusDuringGit = registry.docsRepo;
      return { stdout: '', stderr: '' };
    };

    await bootstrapRepoCache({
      repoUrl: 'https://github.com/acme/docs.git',
      branch: 'main',
      cacheDir,
      credential: fakeCredential,
      registry,
      runGit,
    });

    expect(statusDuringGit).toBe('syncing');
    expect(registry.docsRepo).toBe('clean');
  });

  it('never logs the credential secret', async () => {
    const cacheDir = path.join(tmpRoot, 'repo-cache');
    const logger = makeLogger();
    const runGit: GitRunner = async () => ({ stdout: '', stderr: '' });

    await bootstrapRepoCache({
      repoUrl: 'https://github.com/acme/docs.git',
      branch: 'main',
      cacheDir,
      credential: fakeCredential,
      registry: new ReadinessRegistry(),
      runGit,
      logger,
    });

    expect(logger.lines.length).toBeGreaterThan(0);
    for (const line of logger.lines) {
      expect(line).not.toContain(FAKE_SECRET);
    }
  });

  it('swallows a git failure, staying not-ready without throwing', async () => {
    const cacheDir = path.join(tmpRoot, 'repo-cache');
    const registry = new ReadinessRegistry();
    const logger = makeLogger();
    const runGit: GitRunner = async () => {
      throw new Error('fatal: could not read from remote repository');
    };

    const result = await bootstrapRepoCache({
      repoUrl: 'https://github.com/acme/docs.git',
      branch: 'main',
      cacheDir,
      credential: fakeCredential,
      registry,
      runGit,
      logger,
    });

    expect(result.ok).toBe(false);
    expect(registry.repoPresent).toBe(false);
    expect(registry.isReady()).toBe(false);
    expect(registry.docsRepo).toBe('clean');
    expect(logger.lines.some((l) => l.includes('bootstrap failed'))).toBe(true);
  });

  it('skips cloning when no DOCS_REPO_URL is configured', async () => {
    const registry = new ReadinessRegistry();
    const runGit = vi.fn<GitRunner>(async () => ({ stdout: '', stderr: '' }));

    const result = await bootstrapRepoCache({
      repoUrl: undefined,
      branch: 'main',
      cacheDir: path.join(tmpRoot, 'repo-cache'),
      credential: fakeCredential,
      registry,
      runGit,
    });

    expect(result).toEqual({ action: 'skipped', ok: false });
    expect(runGit).not.toHaveBeenCalled();
    expect(registry.repoPresent).toBe(false);
  });
});
