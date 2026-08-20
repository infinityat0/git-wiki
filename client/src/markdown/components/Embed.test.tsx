// @vitest-environment jsdom
/**
 * R5 acceptance — the iframe embed VISUAL layer, exercised through F7's real
 * pipeline via the shared F8 harness with the R5 slots plugged in.
 *
 *   renderFixture(name, { slots: { iframe: Embed, iframePlaceholder: EmbedPlaceholder } })
 *
 * L1 (DOM structure):
 *   - `iframes` fixture (allowlisted) → live, sandboxed, lazy iframe inside a
 *     responsive 16:9 container.
 *   - the `security/iframe-*` counter-fixtures behave safely with the slots in
 *     place: disallowed host / srcdoc → placeholder card (no live frame),
 *     missing/widened sandbox → forced sandbox survives.
 * L2: golden HTML snapshot for the `iframes` fixture.
 *
 * The POLICY assertions duplicated from F7's `security.test.tsx` are intentional
 * — R5 must not be able to re-introduce a live frame through its presentation.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderFixture } from '../../../../test/unit/render/harness.js';
import { FORCED_SANDBOX } from '../index.js';
import { Embed } from './Embed.js';
import { EmbedPlaceholder } from './EmbedPlaceholder.js';

afterEach(cleanup);

const slots = { iframe: Embed, iframePlaceholder: EmbedPlaceholder };

describe('R5 Embed — L1 allowlisted iframes', () => {
  test('allowlisted host renders a live iframe wrapped in a 16:9 container', () => {
    const { container } = renderFixture('iframes', { slots });

    const iframes = container.querySelectorAll('iframe');
    expect(iframes.length).toBeGreaterThanOrEqual(2);

    // Every live frame is nested inside the R5 responsive container.
    const wrappers = container.querySelectorAll('[data-iframe-embed]');
    expect(wrappers).toHaveLength(iframes.length);
    for (const frame of iframes) {
      expect(frame.closest('[data-iframe-embed]')).not.toBeNull();
    }

    // The container declares the responsive 16:9 box (Design.md §7).
    const wrapper = wrappers[0] as HTMLElement;
    expect(wrapper.className).toContain('iframe-embed-container');
    expect(wrapper.style.aspectRatio.replace(/\s/g, '')).toBe('16/9');
    expect(wrapper.style.maxWidth).toBe('100%');
    expect(wrapper.style.borderRadius).toBe('0.5rem');
  });

  test('forced sandbox + loading=lazy survive the visual layer', () => {
    const { container } = renderFixture('iframes', { slots });
    for (const frame of container.querySelectorAll('iframe')) {
      expect(frame.getAttribute('sandbox')).toBe(FORCED_SANDBOX);
      expect(frame.getAttribute('loading')).toBe('lazy');
    }
  });

  test('author metadata (title/src) is preserved on the live frame', () => {
    const { container } = renderFixture('iframes', { slots });
    const yt = container.querySelector(
      'iframe[src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]',
    );
    expect(yt).not.toBeNull();
    expect(yt?.getAttribute('title')).toBe('Demo video');
  });
});

describe('R5 EmbedPlaceholder — L1 disallowed sources', () => {
  test('iframe-disallowed-host → placeholder card, never a live frame', () => {
    const { container } = renderFixture('security/iframe-disallowed-host.md', {
      slots,
    });

    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/<iframe/i);

    const cards = container.querySelectorAll('[data-iframe-placeholder]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const card of cards) {
      expect(card.getAttribute('data-iframe-reason')).toBe('host');
    }

    // The blocked URL is surfaced as a link, but nothing is embedded.
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="https://evil.example.com/embed"]',
    );
    expect(link).not.toBeNull();
    expect(container.textContent).toContain('External embed not on allowlist');
  });

  test('iframe-srcdoc → placeholder with reason=srcdoc, no script executes', () => {
    const { container } = renderFixture('security/iframe-srcdoc.md', { slots });

    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    for (const el of container.querySelectorAll('*')) {
      expect(el.hasAttribute('srcdoc')).toBe(false);
    }
    const card = container.querySelector('[data-iframe-placeholder]');
    expect(card?.getAttribute('data-iframe-reason')).toBe('srcdoc');
    expect(container.innerHTML).not.toMatch(/<script/i);
    expect(
      (window as unknown as { __pwned?: boolean }).__pwned,
    ).toBeUndefined();
  });

  test('iframe-missing-sandbox → live frame keeps the forced sandbox', () => {
    const { container } = renderFixture('security/iframe-missing-sandbox.md', {
      slots,
    });
    const iframes = container.querySelectorAll('iframe');
    expect(iframes.length).toBeGreaterThanOrEqual(2);
    for (const frame of iframes) {
      expect(frame.getAttribute('sandbox')).toBe(FORCED_SANDBOX);
      expect(frame.getAttribute('sandbox')).not.toMatch(/allow-top-navigation/);
      expect(frame.getAttribute('sandbox')).not.toMatch(/allow-forms/);
      expect(frame.getAttribute('loading')).toBe('lazy');
      // Wrapped in the R5 container, not bare.
      expect(frame.closest('[data-iframe-embed]')).not.toBeNull();
    }
  });
});

describe('R5 — L2 golden snapshot', () => {
  test('iframes fixture rendered HTML is stable', () => {
    const { container } = renderFixture('iframes', { slots });
    expect(container.innerHTML).toMatchSnapshot();
  });
});
