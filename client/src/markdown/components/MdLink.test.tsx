// @vitest-environment jsdom
/**
 * R6 — `MdLink` L1 (DOM structure).
 *
 * Renders the shared `internal-links` fixture through F7's pipeline with the `a`
 * slot under test and asserts the §8/§9 contract: relative `.md` links rewritten
 * to SPA routes, `#anchor` fragments preserved, external links opened safely and
 * otherwise untouched, and links to nonexistent docs marked with a broken-link
 * affordance (decided by a stubbed `docExists`).
 */
import type { ComponentType } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderFixture,
  renderMarkdown,
} from '../../../../test/unit/render/harness.js';
import type { AnchorSlotProps } from '../components.js';
import { MdLink } from './MdLink.js';

afterEach(cleanup);

/** Only `does-not-exist.md` is missing from the tree in these tests. */
const docExists = (path: string): boolean => path !== 'does-not-exist.md';

/** Slot bound with the existence predicate U3 will inject at runtime. */
const boundLink: ComponentType<AnchorSlotProps> = (props) => (
  <MdLink {...props} docExists={docExists} />
);

const slots = { a: boundLink };

/** Collect the rendered anchors keyed by their (rewritten) href. */
function anchorsByHref(container: HTMLElement): Map<string, HTMLAnchorElement> {
  const map = new Map<string, HTMLAnchorElement>();
  for (const a of container.querySelectorAll('a')) {
    map.set(a.getAttribute('href') ?? '', a as HTMLAnchorElement);
  }
  return map;
}

describe('MdLink — L1 DOM structure', () => {
  test('a relative .md link is rewritten to an SPA route', () => {
    const { container } = renderFixture('internal-links', { slots });
    const link = anchorsByHref(container).get('/callouts');
    expect(link, 'expected ./callouts.md → /callouts').toBeDefined();
    expect(link?.dataset.internalLink).toBe('true');
  });

  test('a heading anchor fragment is preserved', () => {
    const { container } = renderFixture('internal-links', { slots });
    const link = anchorsByHref(container).get('/headings#heading-level-2');
    expect(
      link,
      'expected ./headings.md#heading-level-2 → /headings#heading-level-2',
    ).toBeDefined();
  });

  test('a link up a directory resolves relative to the doc path', () => {
    const { container } = renderFixture('internal-links', { slots });
    const link = anchorsByHref(container).get(
      '/docs/adrs/0001-architecture-overview',
    );
    expect(link).toBeDefined();
    expect(link?.dataset.internalLink).toBe('true');
  });

  test('a link to a nonexistent doc gets a broken-link affordance', () => {
    const { container } = renderFixture('internal-links', { slots });
    const broken = container.querySelector('[data-broken-link="true"]');
    expect(broken).not.toBeNull();
    expect(broken?.textContent).toBe('this target is missing');
    expect(broken?.getAttribute('aria-disabled')).toBe('true');
  });

  test('an external link is left untouched and opens in a new tab', () => {
    const { container } = renderFixture('internal-links', { slots });
    const ext = anchorsByHref(container).get('https://vitepress.dev/');
    expect(ext).toBeDefined();
    expect(ext?.getAttribute('target')).toBe('_blank');
    expect(ext?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(ext?.dataset.internalLink).toBeUndefined();
  });

  test('without a docExists prop every internal target is treated as existing', () => {
    const { container } = renderMarkdown('[missing](./nowhere.md)', {
      slots: { a: MdLink },
    });
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/nowhere');
    expect(link?.hasAttribute('data-broken-link')).toBe(false);
  });

  test('a same-page anchor is passed straight through', () => {
    const { container } = renderMarkdown('[top](#intro)', { slots });
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('#intro');
    expect(link?.dataset.internalLink).toBeUndefined();
  });
});
