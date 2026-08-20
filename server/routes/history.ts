/**
 * `GET /api/history?path=<p>` — fetch Git commit history for a document (features spec §6.2, §4.1).
 *
 * Validates the requested path against the docs repository cache root
 * (`config.docs.repoCacheDir`) using {@link resolveInsideRoot} and {@link isDoc}.
 * Rejects traversal payloads, `.git` segments, and non-.md/.mdx files with
 * `400 VALIDATION` (using canonical {@link ApiError} shape).
 *
 * Runs `git log --follow` via `execFile('git', ['-C', repoCacheDir, 'log', ...])`
 * using the explicit `--` separator so filenames starting with `-` cannot be
 * interpreted as command-line flags (security-and-safety.md §2).
 *
 * Parses output into {@link HistoryEntry}[] (`hash`, `author`, `date`, `message`).
 * Returns an empty array `[]` for untracked files.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  API_ROUTES,
  type ApiError,
  type HistoryEntry,
  type HistoryResponse,
} from '@wiki/contracts';

import { config } from '../config/index.js';
import {
  isDoc,
  resolveInsideRoot,
  ValidationError,
} from '../lib/path-safety.js';

const execFileAsync = promisify(execFile);

/** Default maximum number of commits to return per history request. */
export const DEFAULT_HISTORY_LIMIT = 100;

/** Hard upper bound for history limit to prevent memory/process exhaustion. */
export const MAX_HISTORY_LIMIT = 1000;

/** Unit separator character used between commit fields. */
const FIELD_SEPARATOR = '\x1f';

/** Record separator character used between commit entries. */
const RECORD_SEPARATOR = '\x1e';

/**
 * Git log format placeholder:
 * %H  = full commit SHA
 * %an = author name
 * %aI = strict ISO 8601 author date with timezone offset
 * %s  = subject / commit message
 */
const GIT_LOG_PRETTY_FORMAT = `%H${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`;

/** Function signature for executing git commands (injectable for testing). */
export type GitRunner = (
  args: string[],
  options?: { cwd?: string; maxBuffer?: number; timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultRunGit: GitRunner = (args, options) =>
  execFileAsync('git', args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 10000,
    ...options,
  });

/**
 * Parse raw git log output formatted with field and record separators
 * into typed {@link HistoryEntry} objects.
 */
export function parseGitLog(stdout: string): HistoryEntry[] {
  if (!stdout || stdout.trim().length === 0) {
    return [];
  }

  const records = stdout
    .split(RECORD_SEPARATOR)
    .map((rec) => rec.replace(/^\n+|\n+$/g, ''))
    .filter((rec) => rec.length > 0);

  const entries: HistoryEntry[] = [];

  for (const record of records) {
    const parts = record.split(FIELD_SEPARATOR);
    if (parts.length < 4) {
      continue;
    }

    const [hash, author, date, ...messageParts] = parts;
    const trimmedHash = hash.trim();

    if (trimmedHash.length === 0) {
      continue;
    }

    entries.push({
      hash: trimmedHash,
      author: author.trim(),
      date: date.trim(),
      message: messageParts.join(FIELD_SEPARATOR),
    });
  }

  return entries;
}

/** Options for configuring the history router instance. */
export interface HistoryRouterOptions {
  getRootDir?: () => string;
  runGit?: GitRunner;
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Factory creating an Express router for `GET /api/history` with injectable dependencies.
 */
export function createHistoryRouter(
  options: HistoryRouterOptions = {},
): Router {
  const router = Router();
  const getRootDir = options.getRootDir ?? (() => config.docs.repoCacheDir);
  const runGit = options.runGit ?? defaultRunGit;
  const defaultLimit = options.defaultLimit ?? DEFAULT_HISTORY_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_HISTORY_LIMIT;

  router.get(
    API_ROUTES.history,
    async (req: Request, res: Response): Promise<void> => {
      const rawPath = req.query.path;

      if (typeof rawPath !== 'string' || rawPath.length === 0) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION',
            message:
              'Query parameter "path" is required and must be a non-empty string',
          },
        };
        res.status(400).json(error);
        return;
      }

      if (!isDoc(rawPath)) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION',
            message: `Path "${rawPath}" is not a supported markdown document (.md or .mdx)`,
          },
        };
        res.status(400).json(error);
        return;
      }

      const rootDir = getRootDir();
      let absPath: string;

      try {
        absPath = resolveInsideRoot(rootDir, rawPath);
      } catch (err) {
        if (err instanceof ValidationError) {
          const error: ApiError = {
            error: {
              code: 'VALIDATION',
              message: err.message,
            },
          };
          res.status(400).json(error);
          return;
        }
        const error: ApiError = {
          error: {
            code: 'INTERNAL',
            message: 'Failed to resolve document path',
          },
        };
        res.status(500).json(error);
        return;
      }

      // Parse and validate pagination parameters
      let limit = defaultLimit;
      if (req.query.limit !== undefined) {
        const rawLimit = req.query.limit;
        if (
          typeof rawLimit !== 'string' ||
          !/^\d+$/.test(rawLimit) ||
          parseInt(rawLimit, 10) <= 0
        ) {
          const error: ApiError = {
            error: {
              code: 'VALIDATION',
              message: 'Query parameter "limit" must be a positive integer',
            },
          };
          res.status(400).json(error);
          return;
        }
        limit = Math.min(parseInt(rawLimit, 10), maxLimit);
      }

      let offset = 0;
      const rawOffset = req.query.offset ?? req.query.skip;
      if (rawOffset !== undefined) {
        if (typeof rawOffset !== 'string' || !/^\d+$/.test(rawOffset)) {
          const error: ApiError = {
            error: {
              code: 'VALIDATION',
              message:
                'Query parameter "offset" must be a non-negative integer',
            },
          };
          res.status(400).json(error);
          return;
        }
        offset = parseInt(rawOffset, 10);
      }

      // Relative path inside the repo root (safe for git pathspec)
      const relPath = path.relative(rootDir, absPath);

      // Fetch enough commits matching this pathspec to satisfy offset + limit
      const fetchCount = limit + offset;

      // Build explicit argument list for execFile (never string interpolation).
      // Note the '--' separator which ensures filenames starting with '-' cannot be parsed as flags.
      const gitArgs = [
        '-C',
        rootDir,
        'log',
        '--follow',
        `--pretty=format:${GIT_LOG_PRETTY_FORMAT}`,
        '-n',
        String(fetchCount),
        '--',
        relPath,
      ];

      try {
        const { stdout } = await runGit(gitArgs, { cwd: rootDir });
        const entries = parseGitLog(stdout);
        const history: HistoryResponse =
          offset > 0 ? entries.slice(offset, offset + limit) : entries;
        res.json(history);
      } catch (err) {
        const errorMessage = (err as Error).message || '';
        // If the repo is empty or has no commits yet, git log returns fatal error
        if (
          errorMessage.includes('does not have any commits yet') ||
          errorMessage.includes('not a git repository')
        ) {
          res.json([]);
          return;
        }

        const error: ApiError = {
          error: {
            code: 'INTERNAL',
            message: 'Failed to retrieve git history',
          },
        };
        res.status(500).json(error);
      }
    },
  );

  return router;
}

/** Express router serving `GET /api/history`. */
export const historyRouter: Router = createHistoryRouter();

export default historyRouter;
