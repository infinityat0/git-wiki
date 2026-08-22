// @vitest-environment jsdom
/**
 * F7 acceptance — the ENTIRE `test/fixtures/markdown/security/` set, asserted at
 * L1 (DOM) with inverse expectations: the dangerous node must be absent or
 * neutralized (security-and-safety.md §3, testing-markdown-rendering.md).
 *
 * These are the hard security gates: no `<script>`, no `on*`, no `javascript:`,
 * non-allowlisted iframe → placeholder, `srcdoc` dropped, forced sandbox always
 * present. If any of these fail, the pipeline is not shippable.
 */
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Markdown } from './Markdown.js';
import { FORCED_SANDBOX } from './sanitize.js';
import { readFixture } from './fixtures.js';

afterEach(cleanup);

function renderFixture(name: string): HTMLElement {
  const { container } = render(<Markdown content={readFixture(name)} />);
  return container;
}

/** Collect every attribute name present anywhere in the subtree. */
function allAttributeNames(root: HTMLElement): string[] {
  const names: string[] = [];
  for (const el of root.querySelectorAll('*')) {
    for (const attr of el.attributes) names.push(attr.name);
  }
  return names;
}

describe('security corpus is neutralized', () => {
  test('script-tag: no <script> element survives', () => {
    const c = renderFixture('security/script-tag.md');
    expect(c.querySelectorAll('script')).toHaveLength(0);
    expect(c.innerHTML).not.toMatch(/<script/i);
  });

  test('event-handler-attr: no on* handler attribute survives', () => {
    const c = renderFixture('security/event-handler-attr.md');
    const onAttrs = allAttributeNames(c).filter((n) => /^on/i.test(n));
    expect(onAttrs).toEqual([]);
    // The elements themselves still render, just without their handlers.
    expect(c.querySelector('img')).not.toBeNull();
  });

  test('javascript-url: no href/src begins with javascript:', () => {
    const c = renderFixture('security/javascript-url.md');
    for (const el of c.querySelectorAll('a')) {
      expect(el.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
    }
    for (const el of c.querySelectorAll('img')) {
      expect(el.getAttribute('src') ?? '').not.toMatch(/^\s*javascript:/i);
    }
    // No live attribute value (href/src) anywhere begins with javascript:.
    for (const el of c.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        expect(attr.value).not.toMatch(/^\s*javascript:/i);
      }
    }
  });

  test('iframe-disallowed-host: no live frame, placeholder rendered instead', () => {
    const c = renderFixture('security/iframe-disallowed-host.md');
    expect(c.querySelectorAll('iframe')).toHaveLength(0);
    const placeholders = c.querySelectorAll('[data-iframe-placeholder]');
    expect(placeholders.length).toBeGreaterThanOrEqual(2);
    for (const p of placeholders) {
      expect(p.getAttribute('data-iframe-reason')).toBe('host');
    }
    // The blocked URL is surfaced, but never as a live embed.
    expect(c.textContent).toContain('evil.example.com');
    expect(c.innerHTML).not.toMatch(/<iframe/i);
  });

  test('iframe-srcdoc: srcdoc iframe dropped entirely', () => {
    const c = renderFixture('security/iframe-srcdoc.md');
    expect(c.querySelector('iframe[srcdoc]')).toBeNull();
    expect(c.querySelectorAll('iframe')).toHaveLength(0);
    // No element carries a srcdoc attribute (the prose mentions it as text).
    for (const el of c.querySelectorAll('*')) {
      expect(el.hasAttribute('srcdoc')).toBe(false);
    }
    const placeholder = c.querySelector('[data-iframe-placeholder]');
    expect(placeholder?.getAttribute('data-iframe-reason')).toBe('srcdoc');
    // The inline script inside srcdoc must never appear.
    expect(c.innerHTML).not.toMatch(/<script/i);
    expect(
      (window as unknown as { __pwned?: boolean }).__pwned,
    ).toBeUndefined();
  });

  test('iframe-missing-sandbox: forced sandbox present, no author widening', () => {
    const c = renderFixture('security/iframe-missing-sandbox.md');
    const iframes = c.querySelectorAll('iframe');
    expect(iframes.length).toBeGreaterThanOrEqual(2);
    for (const f of iframes) {
      expect(f.getAttribute('sandbox')).toBe(FORCED_SANDBOX);
      expect(f.getAttribute('sandbox')).not.toMatch(/allow-top-navigation/);
      expect(f.getAttribute('sandbox')).not.toMatch(/allow-forms/);
      expect(f.getAttribute('loading')).toBe('lazy');
    }
  });
});
