/**
 * Repo-cache bootstrap.
 *
 * Runs once on server boot (deployment-kubernetes.md "On startup"): materialise
 * the shared docs working tree at `config.docs.repoCacheDir`.
 *
 *  - **Empty cache dir** → `git clone DOCS_REPO_URL@DOCS_REPO_BRANCH` into it.
 *  - **Existing clone**  → `git pull --ff-only` to fast-forward it.
 *
 * All git runs via `execFile('git', […])` with `cwd = repoCacheDir` (never a
 * shell), authenticated by the shared machine {@link GitCredentialProvider}
 * (ADR-0005) — never per-user credentials. The auth header rides in a `-c`
 * config pair, so no secret appears on the remote URL or in the logs below.
 *
 * Both actions are logged. The {@link ReadinessRegistry} is flipped to
 * `syncing` for the duration and back to `clean`, and marked repo-present on
 * success — which, together with B6's search-index signal, is what lets
 * `GET /api/health` gate the Kubernetes readiness probe.
 *
 * A clone/pull failure is logged and swallowed (the process stays up serving a
 * not-ready health), rather than crashing boot: the upstream remote is the
 * source of truth and a later sync can recover.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { GitCredentialProvider } from '../lib/git-credential.js';
import {
  readiness as defaultReadiness,
  ReadinessRegistry,
} from './readiness.js';

const execFileAsync = promisify(execFile);

/** Which git operation the bootstrap performed. */
export type RepoCacheAction = 'clone' | 'pull' | 'skipped';

/** Outcome of {@link bootstrapRepoCache}. */
export interface RepoCacheResult {
  action: RepoCacheAction;
  ok: boolean;
}

/** Runs a `git` subcommand. Injectable so tests need no real git or network. */
export type GitRunner = (
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

/** Structured, **secret-free** log sink (defaults to `console`). */
export interface RepoCacheLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface RepoCacheDeps {
  /** `config.docs.repoUrl` — may be undefined in local dev. */
  repoUrl: string | undefined;
  /** `config.docs.repoBranch`. */
  branch: string;
  /** `config.docs.repoCacheDir`. */
  cacheDir: string;
  /** Shared machine credential (ADR-0005). */
  credential: GitCredentialProvider;
  /** Readiness registry to update (defaults to the process singleton). */
  registry?: ReadinessRegistry;
  /** Git executor (defaults to `execFile('git', …)`). */
  runGit?: GitRunner;
  /** Log sink (defaults to `console`). */
  logger?: RepoCacheLogger;
}

const defaultRunGit: GitRunner = (args, { cwd, env }) =>
  execFileAsync('git', args, { cwd, env });

const defaultLogger: RepoCacheLogger = {
  info: (m) => console.log(m),
  error: (m) => console.error(m),
};

/** Interleave `key=value` config pairs into `-c <pair>` git arguments. */
function toConfigArgs(pairs: string[]): string[] {
  return pairs.flatMap((pair) => ['-c', pair]);
}

/** True when `cacheDir` already holds a git clone (has a `.git` entry). */
async function isRepoInitialized(cacheDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(cacheDir, '.git'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Materialise or update the docs clone. Resolves to the action taken; on
 * failure resolves with `ok: false` rather than rejecting (see module doc).
 */
export async function bootstrapRepoCache(
  deps: RepoCacheDeps,
): Promise<RepoCacheResult> {
  const { repoUrl, branch, cacheDir, credential } = deps;
  const registry = deps.registry ?? defaultReadiness;
  const runGit = deps.runGit ?? defaultRunGit;
  const logger = deps.logger ?? defaultLogger;

  if (!repoUrl) {
    // Dev convenience: without a remote there is nothing to clone. Leave the
    // repo not-present so health stays not-ready.
    logger.info(
      '[repo-cache] DOCS_REPO_URL is not set; skipping docs clone bootstrap',
    );
    return { action: 'skipped', ok: false };
  }

  registry.setDocsRepo('syncing');
  try {
    const auth = await credential.authenticate();
    const configArgs = toConfigArgs(auth.config);
    const env: NodeJS.ProcessEnv = { ...process.env, ...auth.env };
    const alreadyCloned = await isRepoInitialized(cacheDir);

    let action: RepoCacheAction;
    if (alreadyCloned) {
      action = 'pull';
      logger.info(
        `[repo-cache] existing clone at ${cacheDir}; pulling ${branch} (${credential.describe()})`,
      );
      await runGit([...configArgs, 'pull', '--ff-only', 'origin', branch], {
        cwd: cacheDir,
        env,
      });
    } else {
      action = 'clone';
      await fs.mkdir(cacheDir, { recursive: true });
      logger.info(
        `[repo-cache] empty cache at ${cacheDir}; cloning ${repoUrl} @ ${branch} (${credential.describe()})`,
      );
      await runGit(
        [
          ...configArgs,
          'clone',
          '--branch',
          branch,
          '--single-branch',
          repoUrl,
          '.',
        ],
        { cwd: cacheDir, env },
      );
    }

    registry.markRepoPresent();
    registry.setDocsRepo('clean');
    logger.info(`[repo-cache] docs clone ready (${action})`);
    return { action, ok: true };
  } catch (err) {
    registry.setDocsRepo('clean');
    // `err.message` from execFile can include git's stderr; the auth header is
    // only ever in argv (`-c`), never in stderr, so this is secret-free.
    logger.error(`[repo-cache] bootstrap failed: ${(err as Error).message}`);
    return { action: 'skipped', ok: false };
  }
}
