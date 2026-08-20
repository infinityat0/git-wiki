/**
 * Tests for `GET /api/search` (features spec §6.2, ADR-0003).
 *
 * Builds a fixture docs tree, rebuilds the shared index over it, and asserts
 * the HTTP contract: ranked {@link SearchResult}[] with highlighted snippets,
 * empty-query handling, the query-length cap, and hidden-doc exclusion.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SearchResult } from '@wiki/contracts';

import { rebuildSearchIndex } from '../search/index.js';
import { MAX_QUERY_LENGTH, searchRouter } from './search.js';

// --- Fixture -------------------------------------------------------------
const root = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), 'searchr-')),
);

function write(rel: string, contents: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

const app = express();
app.use(searchRouter);
let server: Server;
let base: string;

beforeAll(async () => {
  write(
    'architecture.md',
    '---\ntitle: Architecture Overview\n---\n# Architecture Overview\n\nSplit into a Vite frontend and an Express backend.\n',
  );
  write(
    'hidden.md',
    '---\nhidden: true\n---\n# Hidden Express\n\nsupersecret.\n',
  );
  rebuildSearchIndex(root);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
  fs.rmSync(root, { recursive: true, force: true });
});

async function search(
  q: string,
): Promise<{ status: number; body: SearchResult[] }> {
  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}`);
  return { status: res.status, body: (await res.json()) as SearchResult[] };
}

describe('GET /api/search', () => {
  it('returns ranked results with highlighted snippets', async () => {
    const { status, body } = await search('express');
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    const arch = body.find((r) => r.path === 'architecture.md');
    expect(arch?.title).toBe('Architecture Overview');
    expect(arch?.matches.join(' ')).toContain('**Express**');
  });

  it('excludes hidden docs from results', async () => {
    const { body } = await search('express');
    expect(body.map((r) => r.path)).not.toContain('hidden.md');
    // A term only the hidden doc contains yields nothing.
    const { body: none } = await search('supersecret');
    expect(none).toEqual([]);
  });

  it('returns [] for an empty or whitespace query', async () => {
    expect((await search('')).body).toEqual([]);
    expect((await search('   ')).body).toEqual([]);
  });

  it('caps an over-long query without erroring', async () => {
    const huge = 'express '.repeat(MAX_QUERY_LENGTH); // far longer than the cap
    const { status, body } = await search(huge);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
