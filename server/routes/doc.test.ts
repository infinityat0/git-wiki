/**
 * Tests for `GET /api/doc` endpoint (features spec §6.2, security spec §1, §6).
 *
 * Verifies:
 * - Happy path: returns 200 with { path, content, lastModified }
 * - Nested docs and .mdx support
 * - Missing file returns 404 NOT_FOUND
 * - Path traversal attempts return 400 VALIDATION
 * - Non-markdown files return 400 VALIDATION
 * - Missing or empty path parameter returns 400 VALIDATION
 * - Symlink escapes are rejected (400 VALIDATION) while safe internal symlinks work (200)
 * - Oversized documents are rejected with 400 VALIDATION
 * - Directory paths return 404 NOT_FOUND
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, DocResponse } from '@wiki/contracts';

import { createDocRouter, docRouter } from './doc.js';

let tempDir: string;
let root: string;
let outsideSecret: string;
let app: Express;

beforeAll(() => {
  tempDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'doc-test-')),
  );
  root = path.join(tempDir, 'repo-cache');
  outsideSecret = path.join(tempDir, 'outside-secret.md');

  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, 'adr'), { recursive: true });
  fs.mkdirSync(path.join(root, 'nested', 'deep'), { recursive: true });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });

  // Standard documents
  fs.writeFileSync(
    path.join(root, 'README.md'),
    '# Overview\n\nWelcome to the wiki.',
  );
  fs.writeFileSync(
    path.join(root, 'adr', '0001-architecture-overview.md'),
    '# Architecture Overview\n\nADR content.',
  );
  fs.writeFileSync(
    path.join(root, 'guide.mdx'),
    '# MDX Guide\n\nMDX formatted document.',
  );
  fs.writeFileSync(
    path.join(root, 'nested', 'deep', 'doc.md'),
    '# Deep Doc\n\nDeeply nested document.',
  );

  // Non-markdown files
  fs.writeFileSync(path.join(root, 'notes.txt'), 'plain text');
  fs.writeFileSync(path.join(root, 'logo.png'), 'fake-png-binary');

  // .git disguised doc
  fs.writeFileSync(path.join(root, '.git', 'config.md'), 'git config');

  // Secret file outside root
  fs.writeFileSync(outsideSecret, 'TOP SECRET FILE CONTENT');

  // Symlinks
  fs.symlinkSync(
    path.join(root, 'README.md'),
    path.join(root, 'link-internal.md'),
  );
  fs.symlinkSync(outsideSecret, path.join(root, 'link-escape.md'));

  // Directory named like a markdown file
  fs.mkdirSync(path.join(root, 'folder.md'), { recursive: true });

  // Oversized document fixture
  fs.writeFileSync(
    path.join(root, 'oversized.md'),
    '# Large\n' + 'A'.repeat(100),
  );

  // Express app setup with test root
  app = express();
  app.use(createDocRouter(() => root));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('GET /api/doc — happy path', () => {
  it('returns document content and lastModified for a top-level doc', async () => {
    const res = await request(app).get('/api/doc?path=README.md');

    expect(res.status).toBe(200);
    const body = res.body as DocResponse;
    expect(body.path).toBe('README.md');
    expect(body.content).toBe('# Overview\n\nWelcome to the wiki.');
    expect(body.lastModified).toBeDefined();
    expect(new Date(body.lastModified).toISOString()).toBe(body.lastModified);
  });

  it('returns document content for nested paths', async () => {
    const res = await request(app).get(
      '/api/doc?path=adr/0001-architecture-overview.md',
    );

    expect(res.status).toBe(200);
    const body = res.body as DocResponse;
    expect(body.path).toBe('adr/0001-architecture-overview.md');
    expect(body.content).toBe('# Architecture Overview\n\nADR content.');
  });

  it('serves .mdx files', async () => {
    const res = await request(app).get('/api/doc?path=guide.mdx');

    expect(res.status).toBe(200);
    const body = res.body as DocResponse;
    expect(body.path).toBe('guide.mdx');
    expect(body.content).toBe('# MDX Guide\n\nMDX formatted document.');
  });

  it('follows safe symlinks inside the root', async () => {
    const res = await request(app).get('/api/doc?path=link-internal.md');

    expect(res.status).toBe(200);
    const body = res.body as DocResponse;
    expect(body.path).toBe('link-internal.md');
    expect(body.content).toBe('# Overview\n\nWelcome to the wiki.');
  });
});

describe('GET /api/doc — 404 NOT_FOUND', () => {
  it('returns 404 NOT_FOUND for a nonexistent document', async () => {
    const res = await request(app).get('/api/doc?path=nonexistent.md');

    expect(res.status).toBe(404);
    const body = res.body as ApiError;
    expect(body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found: nonexistent.md',
      },
    });
  });

  it('returns 404 NOT_FOUND for a nonexistent nested document', async () => {
    const res = await request(app).get('/api/doc?path=adr/9999-missing.md');

    expect(res.status).toBe(404);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND when the path is a directory', async () => {
    const res = await request(app).get('/api/doc?path=folder.md');

    expect(res.status).toBe(404);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/doc — 400 VALIDATION for invalid requests', () => {
  it('returns 400 VALIDATION when path parameter is missing', async () => {
    const res = await request(app).get('/api/doc');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('required');
  });

  it('returns 400 VALIDATION when path parameter is empty', async () => {
    const res = await request(app).get('/api/doc?path=');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });

  it('returns 400 VALIDATION for non-markdown file (.txt)', async () => {
    const res = await request(app).get('/api/doc?path=notes.txt');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('not a supported markdown document');
  });

  it('returns 400 VALIDATION for non-markdown file (.png)', async () => {
    const res = await request(app).get('/api/doc?path=logo.png');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });

  it('returns 400 VALIDATION for .git paths', async () => {
    const res = await request(app).get('/api/doc?path=.git/config.md');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });
});

describe('GET /api/doc — 400 VALIDATION for security traversal payloads', () => {
  const traversalPayloads = [
    '../../etc/passwd',
    '../../etc/passwd.md',
    '../outside-secret.md',
    'adr/../../outside-secret.md',
    '/etc/passwd.md',
    'C:\\Windows\\system32\\secret.md',
    '..%2foutside-secret.md',
    '%2e%2e%2foutside-secret.md',
    '%252e%252e%252foutside-secret.md',
    'index.md\0.md',
  ];

  for (const payload of traversalPayloads) {
    it(`rejects traversal payload: ${payload}`, async () => {
      const res = await request(app).get(
        `/api/doc?path=${encodeURIComponent(payload)}`,
      );

      expect(res.status).toBe(400);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('VALIDATION');
    });
  }

  it('rejects symlinks that escape the repository root', async () => {
    const res = await request(app).get('/api/doc?path=link-escape.md');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('escapes the repository root');
  });
});

describe('GET /api/doc — size capping', () => {
  it('rejects oversized files with 400 VALIDATION', async () => {
    const tightApp = express();
    // Cap at 50 bytes (oversized.md is >100 bytes)
    tightApp.use(createDocRouter(() => root, 50));

    const res = await request(tightApp).get('/api/doc?path=oversized.md');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('exceeds maximum allowed size');
  });

  it('allows files within size limit', async () => {
    const tightApp = express();
    tightApp.use(createDocRouter(() => root, 500));

    const res = await request(tightApp).get('/api/doc?path=oversized.md');

    expect(res.status).toBe(200);
    const body = res.body as DocResponse;
    expect(body.path).toBe('oversized.md');
  });
});

describe('GET /api/doc — default router export', () => {
  it('default router is an express Router instance', () => {
    expect(docRouter).toBeDefined();
    expect(typeof docRouter).toBe('function');
  });
});
