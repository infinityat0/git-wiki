/**
 * Shared git-pull routine for the docs cache — the single implementation behind
 * both `POST /api/sync/pull` (route) and the background poller (features spec
 * §4.1, §6.2, §11).
 *
 * A pull runs `git pull --ff-only origin <branch>` in `repoCacheDir` via
 * `execFile('git', […])` (never a shell), authenticated by the shared machine
 * {@link GitCredentialProvider} (ADR-0005) exactly as B1's bootstrap does: the
 * credential rides in `-c http.extraheader=…` argv, never in the remote URL or
 * stderr. The whole pull is wrapped in `readiness.setDocsRepo('syncing')` …
 * `('clean')` so `GET /api/health` reflects the in-flight sync.
 *
 * Git runs with a hard `timeout` so a hung network pull can't wedge the request
 * pool / poller. On a pull that brings in new commits the injected hooks fire —
 * B2's `invalidateTreeCache()` and B6's `rebuildSearchIndex()` — so the tree and
 * search index never serve stale data. Hooks are injectable (defaulting to the
 * real public exports) so callers/tests can supply their own without importing
 * those modules' internals.
 *
 * The routine **never throws**: it resolves to a discriminated {@link PullOutcome}
 * so the route can map failures to the canonical `409 CONFLICT` / `502
 * SYNC_FAILED` envelope and the poller can log-and-continue. Client-facing
 * failure messages are static (never git's stderr) so nothing sensitive leaks.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { SyncResult } from '@wiki/contracts';

import { config } from '../config/index.js';
import {
  createGitCredentialProvider,
  type GitCredentialProvider,
} from '../lib/git-credential.js';
import { readiness, type ReadinessRegistry } from '../boot/readiness.js';
import { invalidateTreeCache } from '../routes/tree.js';
import { rebuildSearchIndex } from '../search/index.js';

const execFileAsync = promisify(execFile);

/** Hard cap on how long a single `git pull` may run before it is killed. */
export const DEFAULT_PULL_TIMEOUT_MS = 60_000;

/**
 * Runs a `git` subcommand with a timeout. Injectable so tests need no real git
 * or network. Mirrors B1's runner but adds the `timeout` a hung pull needs.
 */
export type GitRunner = (
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Post-pull side effects, fired only when a pull brought in new commits. Default
 * wiring calls B2's {@link invalidateTreeCache} and B6's {@link rebuildSearchIndex};
 * tests inject spies so no real rebuild runs.
 */
export interface SyncHooks {
  /** Drop the memoised docs tree (B2). */
  invalidateTree(): void;
  /** Rebuild the full-text search index (B6). */
  rebuildIndex(): void;
}

/** Structured, **secret-free** log sink (defaults to `console`). */
export interface SyncLogger {
  info(message: string): void;
  error(message: string): void;
}

/** Everything a pull needs; every field defaults to the process-wide wiring. */
export interface PullDeps {
  /** `config.docs.repoCacheDir`. */
  cacheDir?: string;
  /** `config.docs.repoBranch`. */
  branch?: string;
  /** Shared machine credential (ADR-0005); defaults to a lazily-built singleton. */
  credential?: GitCredentialProvider;
  /** Readiness registry to update (defaults to the process singleton). */
  registry?: ReadinessRegistry;
  /** Git executor (defaults to `execFile('git', …)`). */
  runGit?: GitRunner;
  /** Post-change side effects (defaults to tree-invalidate + reindex). */
  hooks?: SyncHooks;
  /** Per-pull timeout in ms (defaults to {@link DEFAULT_PULL_TIMEOUT_MS}). */
  timeoutMs?: number;
  /** Log sink (defaults to `console`). */
  logger?: SyncLogger;
}

/** A pull that did not succeed, already mapped to an HTTP error shape. */
export interface PullFailure {
  status: 409 | 502;
  code: 'CONFLICT' | 'SYNC_FAILED';
  message: string;
}

/** Discriminated result of {@link runPull} — never thrown, always returned. */
export type PullOutcome =
  { ok: true; result: SyncResult } | ({ ok: false } & PullFailure);

/** Shape of an `execFile` rejection (adds git's captured streams + kill flag). */
interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  killed?: boolean;
}

/**
 * Signals a pull was blocked by local working-tree state rather than a transient
 * network/remote failure → `409 CONFLICT` (features spec §6.2, §11). Covers the
 * `--ff-only` refusal, dirty-tree overwrite guards, and merge/rebase conflicts.
 */
const CONFLICT_PATTERN =
  /local changes|would be overwritten|unstaged|uncommitted|cannot pull|not possible to fast-forward|need to specify how to reconcile|diverging|automatic merge failed|merge conflict|\bconflict\b/i;

const defaultRunGit: GitRunner = (args, { cwd, env, timeout }) =>
  execFileAsync('git', args, { cwd, env, timeout });

const defaultLogger: SyncLogger = {
  info: (m) => console.log(m),
  error: (m) => console.error(m),
};

const defaultHooks: SyncHooks = {
  invalidateTree: () => invalidateTreeCache(),
  rebuildIndex: () => rebuildSearchIndex(),
};

// A single lazily-built credential provider is reused across pulls so the
// installation token is minted once and cached until it nears expiry.
let sharedCredential: GitCredentialProvider | undefined;
function defaultCredential(): GitCredentialProvider {
  sharedCredential ??= createGitCredentialProvider(config.git);
  return sharedCredential;
}

/** Interleave `key=value` config pairs into `-c <pair>` git arguments. */
function toConfigArgs(pairs: string[]): string[] {
  return pairs.flatMap((pair) => ['-c', pair]);
}

/** Map an `execFile` rejection to the right client-facing failure. */
function classifyFailure(err: ExecError): PullFailure {
  // A killed process is our timeout firing, never a local-edit conflict.
  const detail = `${err.stderr ?? ''}\n${err.stdout ?? ''}\n${err.message ?? ''}`;
  if (!err.killed && CONFLICT_PATTERN.test(detail)) {
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'Sync blocked: the docs working tree has local changes.',
    };
  }
  return {
    status: 502,
    code: 'SYNC_FAILED',
    message: 'Sync failed: could not pull the latest docs.',
  };
}

/**
 * Pull the docs cache once. Wrapped in the `syncing`→`clean` readiness window;
 * fires the change hooks only when new commits arrived. Resolves to a
 * {@link PullOutcome} — success carries the {@link SyncResult}, failure carries a
 * ready-to-serve error code. Never rejects.
 */
export async function runPull(deps: PullDeps = {}): Promise<PullOutcome> {
  const cacheDir = deps.cacheDir ?? config.docs.repoCacheDir;
  const branch = deps.branch ?? config.docs.repoBranch;
  const credential = deps.credential ?? defaultCredential();
  const registry = deps.registry ?? readiness;
  const runGit = deps.runGit ?? defaultRunGit;
  const hooks = deps.hooks ?? defaultHooks;
  const timeout = deps.timeoutMs ?? DEFAULT_PULL_TIMEOUT_MS;
  const logger = deps.logger ?? defaultLogger;

  registry.setDocsRepo('syncing');
  try {
    const auth = await credential.authenticate();
    const env: NodeJS.ProcessEnv = { ...process.env, ...auth.env };
    const { stdout, stderr } = await runGit(
      [...toConfigArgs(auth.config), 'pull', '--ff-only', 'origin', branch],
      { cwd: cacheDir, env, timeout },
    );

    const log = stdout.trim() || stderr.trim() || 'Already up to date.';
    const changesPulled = !/already up to date/i.test(log);
    if (changesPulled) {
      // Order matters only in that both must run; tree first is cheap.
      hooks.invalidateTree();
      hooks.rebuildIndex();
      logger.info('[sync] pull applied new commits; tree + index refreshed');
    } else {
      logger.info('[sync] pull: already up to date');
    }

    return { ok: true, result: { success: true, changesPulled, log } };
  } catch (err) {
    const failure = classifyFailure(err as ExecError);
    // git's stderr can be echoed in `err.message`; the auth header only ever
    // rides in argv (`-c`), never stderr, so this log stays secret-free.
    logger.error(
      `[sync] pull failed (${failure.code}): ${(err as Error).message}`,
    );
    return { ok: false, ...failure };
  } finally {
    // Always leave the working-tree flag clean, success or failure.
    registry.setDocsRepo('clean');
  }
}
