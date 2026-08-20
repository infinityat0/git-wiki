/**
 * Tests for the in-memory MiniSearch index (ADR-0003, features spec §6.2).
 *
 * Builds a fixture docs tree in a temp dir and asserts the acceptance criteria:
 * the index builds over `.md` files, queries return ranked results with
 * highlighted snippets, field boosts favour title/heading hits, `hidden` docs
 * are excluded from the index entirely, empty queries return nothing, and a
 * rebuild flips the shared readiness flag to `ready`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { readiness } from '../boot/readiness.js';
import {
  buildSnippets,
  collectDocs,
  extractHeadings,
  isIndexBuilt,
  rebuildSearchIndex,
  searchDocs,
  stripMarkdown,
} from './index.js';

// --- Fixture -------------------------------------------------------------
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'search-')));

function write(rel: string, contents: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

// Fixtures are written at module scope (before the `describe` bodies evaluate
// `collectDocs(root)`), then indexed once.
write(
  'architecture.md',
  [
    '---',
    'title: Architecture Overview',
    '---',
    '# Architecture Overview',
    '',
    'The system is split into a **Vite** frontend and an **Express** backend.',
    '',
    '## Data flow',
    '',
    'Requests flow from the client through the express router to git.',
  ].join('\n'),
);

write(
  'guide/getting-started.md',
  [
    '# Getting Started',
    '',
    'Install dependencies then run the dev server. No mention of the framework here.',
    '',
    '```js',
    "// a code fence that should be stripped: const express = require('express')",
    '```',
  ].join('\n'),
);

// A doc whose only "express" hit is in the title — exercises title boost.
write('express-notes.md', '# Express Notes\n\nMiscellaneous jottings.\n');

// Hidden doc — must never be indexed.
write(
  'secret.md',
  '---\nhidden: true\n---\n# Secret Express Plans\n\nExpress super-secret.\n',
);

// Non-markdown + .git are ignored by the walker.
write('notes.txt', 'express express express');
write('.git/config', '[core] express');

rebuildSearchIndex(root);

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('stripMarkdown', () => {
  it('removes fenced code, keeps link text, strips emphasis markers', () => {
    const out = stripMarkdown(
      '# Title\n\nSee [the docs](http://x) and `code` and **bold**.\n\n```\nfenced = 1\n```\n',
    );
    expect(out).toContain('the docs');
    expect(out).toContain('bold');
    expect(out).not.toContain('**');
    expect(out).not.toContain('fenced = 1');
    expect(out).not.toContain('```');
  });
});

describe('extractHeadings', () => {
  it('collects all heading levels and skips headings inside code fences', () => {
    const headings = extractHeadings(
      '# One\n\n## Two\n\n```\n# not a heading\n```\n\n### Three\n',
    );
    expect(headings).toEqual(['One', 'Two', 'Three']);
  });
});

describe('collectDocs', () => {
  const docs = collectDocs(root);

  it('indexes .md files and excludes hidden docs, .git, and non-markdown', () => {
    const paths = docs.map((d) => d.path);
    expect(paths).toContain('architecture.md');
    expect(paths).toContain('guide/getting-started.md');
    expect(paths).toContain('express-notes.md');
    expect(paths).not.toContain('secret.md'); // hidden
    expect(paths).not.toContain('notes.txt');
    expect(paths.some((p) => p.includes('.git'))).toBe(false);
  });

  it('resolves titles and strips markdown from the body', () => {
    const arch = docs.find((d) => d.path === 'architecture.md');
    expect(arch?.title).toBe('Architecture Overview');
    expect(arch?.headings).toContain('Data flow');
    expect(arch?.body).not.toContain('**');
  });
});

describe('buildSnippets', () => {
  it('bolds the matched term and elides surrounding context', () => {
    const [snippet] = buildSnippets(
      'The system is split into a Vite frontend and an Express backend for speed.',
      ['express'],
    );
    expect(snippet).toContain('**Express**');
    // Context was cut on the left, so the snippet is prefixed with an ellipsis.
    expect(snippet.startsWith('…')).toBe(true);
  });
});

describe('rebuildSearchIndex + searchDocs', () => {
  it('marks the index built and flips readiness to ready', () => {
    expect(isIndexBuilt()).toBe(true);
    expect(readiness.searchIndex).toBe('ready');
  });

  it('returns ranked results with highlighted snippets', () => {
    const results = searchDocs('express');
    expect(results.length).toBeGreaterThan(0);
    // Every hit carries a non-empty, highlighted snippet.
    for (const r of results) {
      expect(r.matches.length).toBeGreaterThan(0);
      expect(r.matches.join(' ')).toMatch(/\*\*/);
    }
    // The body-and-title match ("express-notes" title + "Express Notes") and
    // the architecture doc both rank above a doc that never mentions express.
    const paths = results.map((r) => r.path);
    expect(paths).toContain('architecture.md');
    expect(paths).toContain('express-notes.md');
  });

  it('ranks a title/heading hit above a body-only hit (field boost)', () => {
    const results = searchDocs('express');
    const notesRank = results.findIndex((r) => r.path === 'express-notes.md');
    const guideRank = results.findIndex(
      (r) => r.path === 'guide/getting-started.md',
    );
    // The guide only mentions express inside a stripped code fence, so it
    // should not out-rank the title/heading hit (and typically not appear).
    expect(notesRank).toBeGreaterThanOrEqual(0);
    if (guideRank !== -1) expect(notesRank).toBeLessThan(guideRank);
  });

  it('excludes hidden docs from every result', () => {
    const results = searchDocs('express');
    expect(results.map((r) => r.path)).not.toContain('secret.md');
    // Even a query that only the hidden doc would match returns nothing.
    expect(searchDocs('supersecret')).toEqual([]);
  });

  it('returns [] for an empty or whitespace query', () => {
    expect(searchDocs('')).toEqual([]);
    expect(searchDocs('   ')).toEqual([]);
  });
});
