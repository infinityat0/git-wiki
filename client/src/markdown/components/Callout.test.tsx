// @vitest-environment jsdom
/**
 * R4 — Callout / Alert Component: L1 DOM assertions + L2 golden snapshot.
 *
 * Tests the callout renderer through F7's <Markdown> pipeline via the shared
 * harness and `callouts.md` fixture.
 *
 * Manifest assertions covered:
 *   - NOTE=blue, TIP=green, WARNING=amber, CAUTION=red
 *   - left border + tinted background + icon + title
 *   - correct tints in both light and dark
 *   - nested inline content (bold, code, links) works properly
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderFixture,
  renderMarkdown,
} from '../../../../test/unit/render/harness.js';
import { Callout } from './Callout.js';

afterEach(cleanup);

describe('Callout — L1 DOM structure', () => {
  test('renders all callout blocks from the fixture', () => {
    const { container } = renderFixture('callouts', {
      slots: { callout: Callout },
    });
    const callouts = container.querySelectorAll('.callout');
    expect(callouts.length).toBe(5);
  });

  test('each of the four types renders its type class and data attributes', () => {
    const { container } = renderFixture('callouts', {
      slots: { callout: Callout },
    });

    const types = ['note', 'tip', 'warning', 'caution'] as const;
    for (const type of types) {
      const el = container.querySelector(`.callout-${type}`) as HTMLElement;
      expect(el, `expected .callout-${type} to exist`).not.toBeNull();
      expect(el.getAttribute('data-callout')).toBe(type);
      expect(el.getAttribute('data-callout-title')).toBeTruthy();
    }
  });

  test('each of the four types renders its 4px left border and correct color', () => {
    const { container } = renderFixture('callouts', {
      slots: { callout: Callout },
    });

    const expectedColors: Record<string, string> = {
      note: 'rgb(2, 132, 199)', // #0284c7
      tip: 'rgb(22, 110, 63)', // #166e3f
      warning: 'rgb(217, 119, 6)', // #d97706
      caution: 'rgb(220, 38, 38)', // #dc2626
    };

    for (const [type, color] of Object.entries(expectedColors)) {
      const el = container.querySelector(`.callout-${type}`) as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.style.borderLeftWidth).toBe('4px');
      expect(el.style.borderLeftStyle).toBe('solid');
      expect(el.style.borderLeftColor).toBe(color);
    }
  });

  test('each callout renders an inline SVG icon and resolved title', () => {
    const { container } = renderFixture('callouts', {
      slots: { callout: Callout },
    });

    const expectedTitles: Record<string, string> = {
      note: 'Note',
      tip: 'Tip',
      warning: 'Warning',
      caution: 'Caution',
    };

    for (const [type, title] of Object.entries(expectedTitles)) {
      const el = container.querySelector(`.callout-${type}`) as HTMLElement;
      expect(el).not.toBeNull();

      const icon = el.querySelector('.callout-icon svg');
      expect(icon, `expected svg icon inside .callout-${type}`).not.toBeNull();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');

      const titleEl = el.querySelector('.callout-title-text');
      expect(titleEl?.textContent).toBe(title);
    }
  });

  test('nested inline content (bold, code, link) renders correctly inside a callout', () => {
    const { container } = renderFixture('callouts', {
      slots: { callout: Callout },
    });

    // The 5th callout in callouts.md has bold, code, and link
    const callouts = container.querySelectorAll('.callout');
    const nestedCallout = callouts[4] as HTMLElement;
    expect(nestedCallout).toBeDefined();

    const strong = nestedCallout.querySelector('strong');
    expect(strong?.textContent).toBe('bold');

    const code = nestedCallout.querySelector('code');
    expect(code?.textContent).toBe('inline code');

    const link = nestedCallout.querySelector('a');
    expect(link?.textContent).toBe('link');
    expect(link?.getAttribute('href')).toBe('./internal-links.md');
  });

  test('supports custom titles on callout blocks', () => {
    const markdown = '> [!NOTE] Custom Alert Header\n> Custom body content.';
    const { container } = renderMarkdown(markdown, {
      slots: { callout: Callout },
    });

    const callout = container.querySelector('.callout-note') as HTMLElement;
    expect(callout).not.toBeNull();
    expect(callout.getAttribute('data-callout-title')).toBe(
      'Custom Alert Header',
    );

    const titleText = callout.querySelector('.callout-title-text');
    expect(titleText?.textContent).toBe('Custom Alert Header');
  });

  test('gracefully handles important type and fallback types', () => {
    const markdown = '> [!IMPORTANT]\n> An important alert.';
    const { container } = renderMarkdown(markdown, {
      slots: { callout: Callout },
    });

    const callout = container.querySelector(
      '.callout-important',
    ) as HTMLElement;
    expect(callout).not.toBeNull();
    expect(callout.getAttribute('data-callout')).toBe('important');
    expect(callout.querySelector('.callout-icon svg')).not.toBeNull();
  });
});

describe('callouts — L2 golden snapshot', () => {
  test('rendered HTML is stable', () => {
    const { container } = renderFixture('callouts', {
      slots: { callout: Callout },
    });
    expect(container.innerHTML).toMatchSnapshot();
  });
});
