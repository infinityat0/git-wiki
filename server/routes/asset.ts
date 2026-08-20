/**
 * `GET /api/asset?path=<p>` — asset streaming endpoint (features spec §6.2, §8).
 *
 * Serves non-markdown assets (images, PDFs, SVGs) referenced by documents,
 * streamed directly from `repo-cache/`.
 *
 * Security controls (security-and-safety.md §1):
 *   1. Rejects missing, empty, or non-string `path` parameters with `400 VALIDATION`.
 *   2. Validates against traversal payloads, symlink escapes, and `.git` paths via
 *      {@link resolveInsideRoot} (throws {@link ValidationError} -> `400 VALIDATION`).
 *   3. Enforces the extension allowlist via {@link isAsset} (rejects `.md`, `.git/config`,
 *      scripts, and non-allowlisted extensions with `400 VALIDATION`).
 *   4. Infers `Content-Type` from file extension.
 *   5. Sets caching headers (`Cache-Control: public, max-age=3600`).
 */

import fs from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import type { Request, Response } from 'express';
import { API_ROUTES, type ApiError } from '@wiki/contracts';

import { config } from '../config/index.js';
import {
  isAsset,
  resolveInsideRoot,
  ValidationError,
} from '../lib/path-safety.js';

/**
 * Map of lower-case, dot-prefixed file extensions to MIME content types.
 * Covers all allowlisted asset extensions defined in path-safety.
 */
export const ASSET_MIME_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * Infer MIME Content-Type from a file path based on its extension.
 */
export function getContentType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return ASSET_MIME_TYPES[ext];
}

/**
 * Factory function to create the asset router with an optional custom docs root directory.
 * Useful for tests that run with an isolated root.
 */
export function createAssetRouter(rootDir?: string | (() => string)): Router {
  const router = Router();

  router.get(API_ROUTES.asset, (req: Request, res: Response): void => {
    const userPath = req.query.path;

    if (typeof userPath !== 'string' || userPath.length === 0) {
      const error: ApiError = {
        error: {
          code: 'VALIDATION',
          message: 'Path query parameter is required',
        },
      };
      res.status(400).json(error);
      return;
    }

    if (!isAsset(userPath)) {
      const error: ApiError = {
        error: {
          code: 'VALIDATION',
          message: 'Requested path is not an allowlisted asset',
        },
      };
      res.status(400).json(error);
      return;
    }

    const currentRoot =
      typeof rootDir === 'function'
        ? rootDir()
        : (rootDir ?? process.env.REPO_CACHE_DIR ?? config.docs.repoCacheDir);

    let safePath: string;
    try {
      safePath = resolveInsideRoot(currentRoot, userPath);
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
          message: 'Failed to resolve asset path',
        },
      };
      res.status(500).json(error);
      return;
    }

    if (!isAsset(safePath)) {
      const error: ApiError = {
        error: {
          code: 'VALIDATION',
          message: 'Requested path is not an allowlisted asset',
        },
      };
      res.status(400).json(error);
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(safePath);
      if (!stat.isFile()) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Asset not found',
          },
        };
        res.status(404).json(error);
        return;
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Asset not found',
          },
        };
        res.status(404).json(error);
        return;
      }
      const error: ApiError = {
        error: {
          code: 'INTERNAL',
          message: 'Failed to read asset',
        },
      };
      res.status(500).json(error);
      return;
    }

    const contentType = getContentType(safePath) ?? 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const stream = fs.createReadStream(safePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        const error: ApiError = {
          error: {
            code: 'INTERNAL',
            message: 'Failed to stream asset',
          },
        };
        res.status(500).json(error);
      }
    });

    stream.pipe(res);
  });

  return router;
}

/** Ready-to-mount router wired to the configured repo cache directory. */
export const assetRouter: Router = createAssetRouter();

export default assetRouter;
