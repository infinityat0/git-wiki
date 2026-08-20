/**
 * U3 — route ↔ doc-path conversion (features spec §9). Pure-function unit tests.
 */
import { describe, expect, test } from 'vitest';
import { docPathToRoute, routeToDocPath, docDirname } from './paths.js';

describe('docPathToRoute', () => {
  test('strips .md and makes an absolute route', () => {
    expect(docPathToRoute('adr/0001-architecture-overview.md')).toBe(
      '/adr/0001-architecture-overview',
    );
  });

  test('handles a root-level doc', () => {
    expect(docPathToRoute('intro.md')).toBe('/intro');
  });

  test('percent-encodes segments with spaces', () => {
    expect(docPathToRoute('guide/getting started.md')).toBe(
      '/guide/getting%20started',
    );
  });

  test('round-trips with routeToDocPath', () => {
    const path = 'adr/0001-architecture-overview.md';
    expect(routeToDocPath(docPathToRoute(path))).toBe(path);
  });
});

describe('routeToDocPath', () => {
  test('mirrors the doc path with a .md suffix', () => {
    expect(routeToDocPath('/adr/0001-architecture-overview')).toBe(
      'adr/0001-architecture-overview.md',
    );
  });

  test('root route maps to the empty (no-doc) path', () => {
    expect(routeToDocPath('/')).toBe('');
    expect(routeToDocPath('')).toBe('');
  });

  test('decodes percent-encoded segments', () => {
    expect(routeToDocPath('/guide/getting%20started')).toBe(
      'guide/getting started.md',
    );
  });

  test('tolerates a malformed escape without throwing', () => {
    expect(routeToDocPath('/bad%zz')).toBe('bad%zz.md');
  });
});

describe('docDirname', () => {
  test('returns the directory of a nested doc', () => {
    expect(docDirname('adr/0001-x.md')).toBe('adr');
  });

  test('returns empty for a root-level doc', () => {
    expect(docDirname('intro.md')).toBe('');
  });

  test('handles deep nesting', () => {
    expect(docDirname('guide/nested/page.md')).toBe('guide/nested');
  });
});
