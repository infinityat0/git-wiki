/**
 * Tests for `GET /api/asset` (features spec §6.2, §8, security-and-safety.md §1).
 *
 * Covers:
 *   - Serving allowlisted assets (.png, .jpg, .jpeg, .gif, .svg, .webp, .pdf) with correct Content-Type.
 *   - Caching headers (Cache-Control).
 *   - Rejection of .md / .mdx document files with 400 VALIDATION.
 *   - Rejection of path traversal payloads (relative, encoded, absolute, symlink escape) with 400 VALIDATION.
 *   - Rejection of .git paths with 400 VALIDATION.
 *   - Rejection of disallowed extensions (.txt, .exe, .sh, .html, .bmp, etc.) with 400 VALIDATION.
 *   - Missing / empty query parameters with 400 VALIDATION.
 *   - Missing allowlisted asset with 404 NOT_FOUND.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAssetRouter, assetRouter, ASSET_MIME_TYPES } from './asset.js';

// --- Fixture Setup -----------------------------------------------------------
let workdir: string;
let root: string;
let outsideSecret: string;

beforeAll(() => {
  workdir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'asset-test-')),
  );
  root = path.join(workdir, 'repo-cache');

  // Create dirs
  fs.mkdirSync(path.join(root, 'images', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });

  // Create valid allowlisted assets
  fs.writeFileSync(path.join(root, 'sample.png'), Buffer.from('fake-png-data'));
  fs.writeFileSync(path.join(root, 'sample.jpg'), Buffer.from('fake-jpg-data'));
  fs.writeFileSync(
    path.join(root, 'sample.jpeg'),
    Buffer.from('fake-jpeg-data'),
  );
  fs.writeFileSync(path.join(root, 'sample.gif'), Buffer.from('fake-gif-data'));
  fs.writeFileSync(
    path.join(root, 'images', 'nested', 'diagram.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>',
  );
  fs.writeFileSync(
    path.join(root, 'sample.webp'),
    Buffer.from('fake-webp-data'),
  );
  fs.writeFileSync(path.join(root, 'sample.pdf'), Buffer.from('%PDF-1.4 fake'));

  // Create docs, non-asset files, and .git files
  fs.writeFileSync(path.join(root, 'index.md'), '# Doc content');
  fs.writeFileSync(path.join(root, 'docs', 'guide.mdx'), '# MDX content');
  fs.writeFileSync(path.join(root, 'notes.txt'), 'plain text');
  fs.writeFileSync(path.join(root, 'script.sh'), '#!/bin/sh\necho hi');
  fs.writeFileSync(path.join(root, 'page.html'), '<html></html>');
  fs.writeFileSync(path.join(root, 'unsupported.bmp'), 'bmp data');
  fs.writeFileSync(path.join(root, '.git', 'config'), '[core]');
  fs.writeFileSync(path.join(root, '.git', 'logo.png'), 'git png');

  // File outside the docs root (traversal target)
  outsideSecret = path.join(workdir, 'secret.png');
  fs.writeFileSync(outsideSecret, 'secret png content');
});

afterAll(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
});

function createTestApp(customRoot: string): Express {
  const app = express();
  app.use(createAssetRouter(customRoot));
  return app;
}

describe('GET /api/asset — allowlisted asset serving', () => {
  it('serves PNG with image/png and caching headers', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=sample.png');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.body).toEqual(Buffer.from('fake-png-data'));
  });

  it('serves JPG and JPEG with image/jpeg', async () => {
    const app = createTestApp(root);

    const resJpg = await request(app).get('/api/asset?path=sample.jpg');
    expect(resJpg.status).toBe(200);
    expect(resJpg.headers['content-type']).toBe('image/jpeg');
    expect(resJpg.headers['cache-control']).toBe('public, max-age=3600');

    const resJpeg = await request(app).get('/api/asset?path=sample.jpeg');
    expect(resJpeg.status).toBe(200);
    expect(resJpeg.headers['content-type']).toBe('image/jpeg');
  });

  it('serves GIF with image/gif', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=sample.gif');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/gif');
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('serves nested SVG with image/svg+xml', async () => {
    const app = createTestApp(root);
    const res = await request(app).get(
      '/api/asset?path=images/nested/diagram.svg',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/svg+xml');
    expect(res.text || res.body.toString('utf8')).toContain('<svg');
  });

  it('serves WEBP with image/webp', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=sample.webp');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
  });

  it('serves PDF with application/pdf', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=sample.pdf');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('maps all ASSET_MIME_TYPES properly', () => {
    expect(ASSET_MIME_TYPES).toEqual({
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    });
  });
});

describe('GET /api/asset — rejects .md and document files with 400 VALIDATION', () => {
  it('rejects top-level .md file with 400 VALIDATION', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=index.md');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects nested .mdx file with 400 VALIDATION', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=docs/guide.mdx');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION',
        message: expect.any(String),
      },
    });
  });
});

describe('GET /api/asset — rejects disallowed extensions with 400 VALIDATION', () => {
  const disallowed = [
    'notes.txt',
    'script.sh',
    'page.html',
    'unsupported.bmp',
    'binary.exe',
    'noextension',
  ];

  for (const filename of disallowed) {
    it(`rejects ${filename} with 400 VALIDATION`, async () => {
      const app = createTestApp(root);
      const res = await request(app).get(`/api/asset?path=${filename}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION',
          message: expect.any(String),
        },
      });
    });
  }
});

describe('GET /api/asset — rejects path traversal payloads with 400 VALIDATION', () => {
  const traversalPayloads: Array<[label: string, queryPath: string]> = [
    ['simple ../', '../secret.png'],
    ['nested ../', 'images/../../secret.png'],
    ['deep ../', '../../../../../../etc/passwd'],
    ['URL encoded %2e%2e%2f', '%2e%2e%2fsecret.png'],
    ['URL encoded ..%2f', '..%2fsecret.png'],
    ['double encoded %252e%252e', '%252e%252e%2fsecret.png'],
    ['absolute posix /secret.png', '/secret.png'],
    ['windows drive letter C:\\secret.png', 'C:\\secret.png'],
    ['UNC path \\\\server\\share\\secret.png', '\\\\server\\share\\secret.png'],
    ['null byte in filename', 'sample.png\0.png'],
  ];

  for (const [label, queryPath] of traversalPayloads) {
    it(`rejects ${label} with 400 VALIDATION`, async () => {
      const app = createTestApp(root);
      const res = await request(app).get(
        `/api/asset?path=${encodeURIComponent(queryPath)}`,
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION',
          message: expect.any(String),
        },
      });
    });
  }

  it('rejects symlink escaping root with 400 VALIDATION', async () => {
    const escapeSymlink = path.join(root, 'escape.png');
    fs.symlinkSync(outsideSecret, escapeSymlink);

    try {
      const app = createTestApp(root);
      const res = await request(app).get('/api/asset?path=escape.png');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION',
          message: expect.any(String),
        },
      });
    } finally {
      fs.rmSync(escapeSymlink, { force: true });
    }
  });
});

describe('GET /api/asset — rejects .git paths with 400 VALIDATION', () => {
  it('rejects .git/config with 400 VALIDATION', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=.git/config');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects .git/logo.png with 400 VALIDATION', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=.git/logo.png');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION',
        message: expect.any(String),
      },
    });
  });
});

describe('GET /api/asset — invalid query parameters', () => {
  it('rejects missing path parameter with 400 VALIDATION', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'Path query parameter is required',
      },
    });
  });

  it('rejects empty path parameter with 400 VALIDATION', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'Path query parameter is required',
      },
    });
  });
});

describe('GET /api/asset — nonexistent assets', () => {
  it('returns 404 NOT_FOUND for missing allowlisted asset', async () => {
    const app = createTestApp(root);
    const res = await request(app).get('/api/asset?path=nonexistent.png');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Asset not found',
      },
    });
  });
});

describe('GET /api/asset — default export router', () => {
  it('mounts and functions with default export', async () => {
    process.env.REPO_CACHE_DIR = root;
    const app = express();
    app.use(assetRouter);

    const res = await request(app).get('/api/asset?path=sample.png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });
});
