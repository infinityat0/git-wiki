/**
 * `GET /api/doc?path=` — fetch raw document content and metadata (features spec §6.2).
 *
 * Validates the requested path against the docs repository cache root
 * (`config.docs.repoCacheDir`) using {@link resolveInsideRoot} and {@link isDoc}.
 * Rejects traversal payloads, non-.md/.mdx files, and pathologically oversized files
 * with `400 VALIDATION` (using canonical {@link ApiError} shape).
 * Returns `404 NOT_FOUND` for nonexistent documents.
 * On success, returns {@link DocResponse} with `path`, `content`, and `lastModified`.
 */

import fs from 'node:fs';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { API_ROUTES, type ApiError, type DocResponse } from '@wiki/contracts';

import { config } from '../config/index.js';
import {
  isDoc,
  resolveInsideRoot,
  ValidationError,
} from '../lib/path-safety.js';

/** Default size limit for documents (5 MB). Protects against memory exhaustion (security spec §6). */
export const DEFAULT_MAX_DOC_SIZE = 5 * 1024 * 1024;

/**
 * Creates the doc router with injectable root directory getter and max size limit.
 */
export function createDocRouter(
  getRootDir: () => string = () => config.docs.repoCacheDir,
  maxDocSize: number = DEFAULT_MAX_DOC_SIZE,
): Router {
  const router = Router();

  router.get(API_ROUTES.doc, (req: Request, res: Response): void => {
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
      throw err;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: `Document not found: ${rawPath}`,
          },
        };
        res.status(404).json(error);
        return;
      }
      throw err;
    }

    if (!stat.isFile()) {
      const error: ApiError = {
        error: {
          code: 'NOT_FOUND',
          message: `Document not found: ${rawPath}`,
        },
      };
      res.status(404).json(error);
      return;
    }

    if (stat.size > maxDocSize) {
      const error: ApiError = {
        error: {
          code: 'VALIDATION',
          message: `Document exceeds maximum allowed size of ${maxDocSize} bytes`,
        },
      };
      res.status(400).json(error);
      return;
    }

    const content = fs.readFileSync(absPath, 'utf8');
    const lastModified = stat.mtime.toISOString();

    const response: DocResponse = {
      path: rawPath,
      content,
      lastModified,
    };

    res.json(response);
  });

  return router;
}

/** Express router serving `GET /api/doc`. */
export const docRouter: Router = createDocRouter();

export default docRouter;
