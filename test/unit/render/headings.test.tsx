// @vitest-environment jsdom
/**
 * F8 worked example — `headings` at L1 (DOM structure) + L2 (golden snapshot).
 *
 * This is the reference an `R*` render task copies: render the element's fixture
 * through the shared harness, assert the DOM contract from the manifest, then
 * capture the golden HTML snapshot. `headings` renders fully through F7's
 * pipeline today (rehype-slug), so it proves the machinery end-to-end without
 * depending on any not-yet-built render component.
 *
 * Manifest assertions covered here (structure-level):
 *   - renders h1 through h6
 *   - h2/h3 receive de-duplicated slug ids (rehype-slug)
 * The border/hover-anchor assertions are visual (L3) — see
 * `test/visual/headings.spec.ts`.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { TocEntry } from '../../../client/src/markdown/index.js';
import { renderFixture } from './harness.js';

afterEach(cleanup);

describe('headings — L1 DOM structure', () => {
  test('renders h1 through h6', () => {
    const { container } = renderFixture('headings');
    for (let level = 1; level <= 6; level++) {
      expect(
        container.querySelector(`h${level}`),
        `expected an <h${level}> in the rendered output`,
      ).not.toBeNull();
    }
  });

  test('h2/h3 receive slug ids', () => {
    const { container } = renderFixture('headings');
    const h2 = container.querySelector('h2');
    const h3 = container.querySelector('h3');
    expect(h2?.id).toBe('heading-level-2');
    expect(h3?.id).toBe('heading-level-3');
  });

  test('duplicate headings get de-duplicated slug ids', () => {
    const { container } = renderFixture('headings');
    const ids = Array.from(container.querySelectorAll('h2')).map((h) => h.id);
    expect(ids).toContain('duplicate-title');
    expect(ids).toContain('duplicate-title-1');
  });

  test('the harness surfaces the extracted H2/H3 TOC', () => {
    let toc: TocEntry[] = [];
    renderFixture('headings', { onTocChange: (t) => (toc = t) });
    // 3 × H2 + 1 × H3 in the fixture.
    expect(toc.map((e) => e.depth)).toEqual([2, 3, 2, 2]);
    expect(toc[0]).toMatchObject({ depth: 2, id: 'heading-level-2' });
    expect(toc.at(-1)).toMatchObject({ depth: 2, id: 'duplicate-title-1' });
  });
});

describe('headings — L2 golden snapshot', () => {
  test('rendered HTML is stable', () => {
    const { container } = renderFixture('headings');
    expect(container.innerHTML).toMatchSnapshot();
  });
});
