/**
 * Tests for `GET /api/tree` (features spec §6.2, §7).
 *
 * Builds a fixture docs tree in a temp dir and asserts the acceptance
 * criteria: `title` resolution (frontmatter → H1 → prettified filename, never
 * the raw filename), `order`-then-title sorting, `hidden` exclusion, `.git/`
 * and non-`.md` exclusion, directory metadata via `_index.md`, and the
 * cache/invalidation contract the sync task (B7) relies on.
 *
 * `REPO_CACHE_DIR` is set to the fixture *before* the route module (and its
 * config singleton) is imported, so the router serves the fixture tree.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import express from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import type { TreeNode } from '@wiki/contracts';

// --- Fixture -------------------------------------------------------------
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tree-')));

function write(rel: string, contents: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

// Top-level docs.
write('README.md', '# Overview\n\nWelcome.');
write(
  '01-getting-started.md',
  '---\ntitle: Getting Started\norder: 10\n---\n\nstart here',
);
write('02-plain-file.md', 'no heading, no frontmatter — prettified name');
write('hidden-doc.md', '---\nhidden: true\n---\n# Secret');
write('notes.txt', 'not markdown');
write('logo.png', 'binary-ish');
write('.git/config', '[core]');

// A directory whose metadata comes from `_index.md`.
write('adr/_index.md', '---\ntitle: Architecture Decisions\norder: 10\n---\n');
write('adr/0001-architecture-overview.md', '# Architecture Overview\n');
write('adr/0002-second.md', '---\norder: 1\n---\n# Second Doc\n');

// A directory with no markdown — must be pruned.
write('empty-assets/logo.png', 'x');

process.env.REPO_CACHE_DIR = root;

// Import AFTER the env is set so the config singleton reads the fixture root.
const { buildTree, treeRouter, invalidateTreeCache } =
  await import('./tree.js');

function byName(nodes: TreeNode[], name: string): TreeNode | undefined {
  return nodes.find((n) => n.name === name);
}

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('buildTree (fixture tree)', () => {
  const tree = buildTree(root);

  it('excludes .git, non-markdown files, and hidden nodes', () => {
    const names = tree.map((n) => n.name);
    expect(names).not.toContain('.git');
    expect(names).not.toContain('notes.txt');
    expect(names).not.toContain('logo.png');
    expect(names).not.toContain('hidden-doc.md');
  });

  it('prunes directories with no markdown descendants', () => {
    expect(byName(tree, 'empty-assets')).toBeUndefined();
  });

  it('resolves title from frontmatter, H1, then prettified filename — never the raw name', () => {
    expect(byName(tree, '01-getting-started.md')?.title).toBe(
      'Getting Started',
    );
    expect(byName(tree, 'README.md')?.title).toBe('Overview');

    const plain = byName(tree, '02-plain-file.md');
    expect(plain?.title).toBe('Plain File');
    expect(plain?.title).not.toBe('02-plain-file.md');

    // No node anywhere renders its own raw filename as the title.
    const assertNoRawTitles = (nodes: TreeNode[]): void => {
      for (const n of nodes) {
        expect(n.title).not.toBe(n.name);
        if (n.children) assertNoRawTitles(n.children);
      }
    };
    assertNoRawTitles(tree);
  });

  it('reads directory metadata (title/order) from _index.md and hides that file', () => {
    const adr = byName(tree, 'adr');
    expect(adr?.type).toBe('directory');
    expect(adr?.title).toBe('Architecture Decisions');
    expect(adr?.order).toBe(10);
    expect(adr?.children?.map((c) => c.name)).not.toContain('_index.md');
  });

  it('sorts siblings by order ascending, then by title', () => {
    // order 10 group sorts by title: "Architecture Decisions" < "Getting Started";
    // absent-order group follows: "Overview" < "Plain File".
    expect(tree.map((n) => n.name)).toEqual([
      'adr',
      '01-getting-started.md',
      'README.md',
      '02-plain-file.md',
    ]);

    // Within adr: order 1 (Second Doc) before absent-order (Architecture Overview).
    const adr = byName(tree, 'adr');
    expect(adr?.children?.map((c) => c.title)).toEqual([
      'Second Doc',
      'Architecture Overview',
    ]);
  });

  it('carries order through and omits it when absent (contract-clean)', () => {
    expect(byName(tree, '01-getting-started.md')?.order).toBe(10);
    expect('order' in (byName(tree, 'README.md') as object)).toBe(false);
  });
});

describe('GET /api/tree (router + cache)', () => {
  const app = express();
  app.use(treeRouter);
  let server: Server;
  let base: string;

  const start = (): Promise<void> =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address() as AddressInfo;
        base = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

  it('serves the tree as JSON', async () => {
    invalidateTreeCache();
    await start();
    const res = await fetch(`${base}/api/tree`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TreeNode[];
    expect(body.map((n) => n.name)).toEqual([
      'adr',
      '01-getting-started.md',
      'README.md',
      '02-plain-file.md',
    ]);
  });

  it('memoises until invalidateTreeCache() is called', async () => {
    // A new file is invisible while the cache is warm...
    write('03-late.md', '# Late Addition');
    const cached = (await (
      await fetch(`${base}/api/tree`)
    ).json()) as TreeNode[];
    expect(cached.map((n) => n.name)).not.toContain('03-late.md');

    // ...and appears only after the sync hook invalidates the cache.
    invalidateTreeCache();
    const fresh = (await (
      await fetch(`${base}/api/tree`)
    ).json()) as TreeNode[];
    expect(fresh.map((n) => n.name)).toContain('03-late.md');
  });

  afterAll(() => {
    server?.close();
  });
});
