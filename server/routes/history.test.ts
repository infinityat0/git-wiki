/**
 * Tests for `GET /api/history` endpoint (features spec §6.2, security spec §1, §2).
 *
 * Verifies:
 * - Happy path: returns 200 with HistoryEntry[] for a tracked file
 * - Multi-commit history in reverse chronological order
 * - Nested documents
 * - Safe handling of filenames starting with '-' (git argument injection prevention via '--')
 * - Untracked and nonexistent files return empty array []
 * - Pagination via limit and offset/skip parameters
 * - Path traversal attempts return 400 VALIDATION
 * - Non-markdown files (.txt, .png) return 400 VALIDATION
 * - Missing or empty path parameter returns 400 VALIDATION
 * - .git paths return 400 VALIDATION
 * - Symlink escapes are rejected with 400 VALIDATION
 * - Graceful handling of uninitialized repos or repos without commits
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, HistoryEntry } from '@wiki/contracts';

import { createHistoryRouter, historyRouter, parseGitLog } from './history.js';

let tempDir: string;
let root: string;
let outsideSecret: string;
let app: Express;

beforeAll(() => {
  tempDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'history-test-')),
  );
  root = path.join(tempDir, 'repo-cache');
  outsideSecret = path.join(tempDir, 'outside-secret.md');

  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, 'adr'), { recursive: true });
  fs.mkdirSync(path.join(root, 'nested', 'deep'), { recursive: true });

  // Initialize a real git repo
  execFileSync('git', ['init'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test Author'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: root,
  });

  // 1. Create and commit README.md (Commit 1)
  fs.writeFileSync(
    path.join(root, 'README.md'),
    '# Overview\n\nInitial version.',
  );
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'Initial commit for README'], {
    cwd: root,
  });

  // 2. Modify README.md and add adr doc (Commit 2)
  fs.writeFileSync(
    path.join(root, 'README.md'),
    '# Overview\n\nSecond version with more docs.',
  );
  fs.writeFileSync(
    path.join(root, 'adr', '0001-overview.md'),
    '# ADR 0001\n\nArchitecture details.',
  );
  execFileSync('git', ['add', 'README.md', 'adr/0001-overview.md'], {
    cwd: root,
  });
  execFileSync('git', ['commit', '-m', 'Update README and add ADR 0001'], {
    cwd: root,
  });

  // 3. Create a file starting with hyphen '-' to test git-arg-injection safety (Commit 3)
  fs.writeFileSync(
    path.join(root, '-flag.md'),
    '# Hyphen Doc\n\nDoc with leading hyphen.',
  );
  execFileSync('git', ['add', '--', '-flag.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'Add hyphen-prefixed document'], {
    cwd: root,
  });

  // 4. Create an untracked markdown file (never added or committed)
  fs.writeFileSync(
    path.join(root, 'untracked.md'),
    '# Untracked\n\nNot in git.',
  );

  // 5. Non-markdown files
  fs.writeFileSync(path.join(root, 'notes.txt'), 'plain text');
  fs.writeFileSync(path.join(root, 'logo.png'), 'fake image');

  // 6. Secret outside repo
  fs.writeFileSync(outsideSecret, '# Secret\n\nOutside root.');

  // 7. Symlink escape
  fs.symlinkSync(outsideSecret, path.join(root, 'link-escape.md'));

  // Setup express test app
  app = express();
  app.use(createHistoryRouter({ getRootDir: () => root }));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('GET /api/history — tracked files', () => {
  it('returns history entries for a file with multiple commits', async () => {
    const res = await request(app).get('/api/history?path=README.md');

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(2);

    // Newest commit first
    expect(history[0].message).toBe('Update README and add ADR 0001');
    expect(history[0].author).toBe('Test Author');
    expect(history[0].hash).toMatch(/^[0-9a-f]{40}$/);
    expect(new Date(history[0].date).toISOString()).toBeDefined();

    // Older commit second
    expect(history[1].message).toBe('Initial commit for README');
    expect(history[1].author).toBe('Test Author');
    expect(history[1].hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns history for nested documents', async () => {
    const res = await request(app).get(
      '/api/history?path=adr/0001-overview.md',
    );

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(history.length).toBe(1);
    expect(history[0].message).toBe('Update README and add ADR 0001');
    expect(history[0].author).toBe('Test Author');
    expect(history[0].hash).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('GET /api/history — git argument injection safety', () => {
  it('safely retrieves history for a filename starting with "-"', async () => {
    const res = await request(app).get('/api/history?path=-flag.md');

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(history.length).toBe(1);
    expect(history[0].message).toBe('Add hyphen-prefixed document');
    expect(history[0].author).toBe('Test Author');
  });
});

describe('GET /api/history — untracked and nonexistent files', () => {
  it('returns an empty array for an untracked file', async () => {
    const res = await request(app).get('/api/history?path=untracked.md');

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(history).toEqual([]);
  });

  it('returns an empty array for a nonexistent markdown file', async () => {
    const res = await request(app).get('/api/history?path=nonexistent.md');

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(history).toEqual([]);
  });
});

describe('GET /api/history — pagination and limits', () => {
  it('respects the limit query parameter', async () => {
    const res = await request(app).get('/api/history?path=README.md&limit=1');

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(history.length).toBe(1);
    expect(history[0].message).toBe('Update README and add ADR 0001');
  });

  it('respects the offset query parameter', async () => {
    const res = await request(app).get(
      '/api/history?path=README.md&limit=1&offset=1',
    );

    expect(res.status).toBe(200);
    const history = res.body as HistoryEntry[];
    expect(history.length).toBe(1);
    expect(history[0].message).toBe('Initial commit for README');
  });

  it('rejects invalid limit values with 400 VALIDATION', async () => {
    const res = await request(app).get(
      '/api/history?path=README.md&limit=invalid',
    );

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('limit');
  });

  it('rejects non-positive limit (0 or negative) with 400 VALIDATION', async () => {
    const res = await request(app).get('/api/history?path=README.md&limit=0');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });

  it('rejects invalid offset values with 400 VALIDATION', async () => {
    const res = await request(app).get(
      '/api/history?path=README.md&offset=abc',
    );

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('offset');
  });
});

describe('GET /api/history — 400 VALIDATION for invalid inputs', () => {
  it('returns 400 VALIDATION when path parameter is missing', async () => {
    const res = await request(app).get('/api/history');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('required');
  });

  it('returns 400 VALIDATION when path parameter is empty', async () => {
    const res = await request(app).get('/api/history?path=');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });

  it('returns 400 VALIDATION for non-markdown file (.txt)', async () => {
    const res = await request(app).get('/api/history?path=notes.txt');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('not a supported markdown document');
  });

  it('returns 400 VALIDATION for non-markdown file (.png)', async () => {
    const res = await request(app).get('/api/history?path=logo.png');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });

  it('returns 400 VALIDATION for .git paths', async () => {
    const res = await request(app).get('/api/history?path=.git/config.md');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
  });
});

describe('GET /api/history — path traversal payloads', () => {
  const traversalPayloads = [
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
        `/api/history?path=${encodeURIComponent(payload)}`,
      );

      expect(res.status).toBe(400);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('VALIDATION');
    });
  }

  it('rejects symlinks that escape repository root', async () => {
    const res = await request(app).get('/api/history?path=link-escape.md');

    expect(res.status).toBe(400);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('escapes the repository root');
  });
});

describe('GET /api/history — error and edge cases', () => {
  it('returns empty array when repo has no commits yet', async () => {
    const emptyRepoDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'history-empty-repo-')),
    );
    execFileSync('git', ['init'], { cwd: emptyRepoDir });

    const emptyApp = express();
    emptyApp.use(createHistoryRouter({ getRootDir: () => emptyRepoDir }));

    const res = await request(emptyApp).get('/api/history?path=doc.md');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    fs.rmSync(emptyRepoDir, { recursive: true, force: true });
  });

  it('returns 500 INTERNAL when git runner encounters an unexpected failure', async () => {
    const failingApp = express();
    failingApp.use(
      createHistoryRouter({
        getRootDir: () => root,
        runGit: async () => {
          throw new Error('Fatal: hardware I/O error');
        },
      }),
    );

    const res = await request(failingApp).get('/api/history?path=README.md');
    expect(res.status).toBe(500);
    const body = res.body as ApiError;
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).toContain('Failed to retrieve git history');
  });
});

describe('parseGitLog helper', () => {
  it('handles empty and whitespace string inputs', () => {
    expect(parseGitLog('')).toEqual([]);
    expect(parseGitLog('   \n\n  ')).toEqual([]);
  });

  it('parses formatted git log output accurately', () => {
    const raw =
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2\x1fAlice Smith\x1f2026-08-17T22:32:31-07:00\x1fInitial docs\x1e';
    const parsed = parseGitLog(raw);

    expect(parsed).toEqual([
      {
        hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        author: 'Alice Smith',
        date: '2026-08-17T22:32:31-07:00',
        message: 'Initial docs',
      },
    ]);
  });
});

describe('GET /api/history — default router export', () => {
  it('default router is an express Router instance', () => {
    expect(historyRouter).toBeDefined();
    expect(typeof historyRouter).toBe('function');
  });
});
