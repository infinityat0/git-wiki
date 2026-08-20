/**
 * U3 — `docExists` selector over the tree (features spec §8, §9).
 */
import { describe, expect, test } from 'vitest';
import type { TreeResponse } from '@wiki/contracts';
import { makeDocExists, isKnownMissing } from './docExists.js';

const tree: TreeResponse = [
  {
    name: 'adr',
    path: 'adr',
    title: 'ADR',
    type: 'directory',
    children: [
      {
        name: '0001-architecture-overview.md',
        path: 'adr/0001-architecture-overview.md',
        title: 'Architecture Overview',
        type: 'file',
      },
    ],
  },
  {
    name: 'hidden.md',
    path: 'hidden.md',
    title: 'Hidden',
    type: 'file',
    hidden: true,
  },
  { name: 'intro.md', path: 'intro.md', title: 'Intro', type: 'file' },
];

describe('makeDocExists', () => {
  test('finds a nested file path', () => {
    const exists = makeDocExists(tree);
    expect(exists('adr/0001-architecture-overview.md')).toBe(true);
  });

  test('returns false for a missing path', () => {
    expect(makeDocExists(tree)('adr/does-not-exist.md')).toBe(false);
  });

  test('treats hidden-but-present docs as existing (still linkable)', () => {
    expect(makeDocExists(tree)('hidden.md')).toBe(true);
  });

  test('directories are not documents', () => {
    expect(makeDocExists(tree)('adr')).toBe(false);
  });

  test('is permissive when the tree has not loaded', () => {
    const exists = makeDocExists(undefined);
    expect(exists('anything.md')).toBe(true);
  });
});

describe('isKnownMissing', () => {
  test('true only once the tree is loaded and lacks the path', () => {
    expect(isKnownMissing(tree, 'nope.md')).toBe(true);
    expect(isKnownMissing(tree, 'intro.md')).toBe(false);
  });

  test('false while the tree is loading (avoids premature 404)', () => {
    expect(isKnownMissing(undefined, 'nope.md')).toBe(false);
  });

  test('false for the empty (index) path', () => {
    expect(isKnownMissing(tree, '')).toBe(false);
  });
});
