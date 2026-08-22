// @vitest-environment jsdom
/**
 * R3 — Math (KaTeX) Component: L1 DOM assertions + L2 golden snapshot.
 *
 * Tests KaTeX rendering through F7's <Markdown> pipeline via the shared harness
 * and `math.md` fixture.
 *
 * Manifest assertions covered:
 *   - inline $..$ renders KaTeX markup
 *   - block $$..$$ renders centered display markup
 *   - no runtime script (CSS-only KaTeX, no <script> tags)
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderFixture } from '../../../../test/unit/render/harness.js';

afterEach(cleanup);

describe('Math (KaTeX) — L1 DOM structure', () => {
  test('renders inline math with KaTeX markup (.katex class)', () => {
    const { container } = renderFixture('math', {});

    // Find all .katex elements
    const katexElements = container.querySelectorAll('.katex');
    expect(katexElements.length).toBeGreaterThanOrEqual(4); // 2 inline + 2 block

    // Find inline math: .katex elements that are NOT inside .katex-display
    const inlineMathElements = Array.from(katexElements).filter(
      (el) => !el.closest('.katex-display'),
    );
    expect(inlineMathElements.length).toBe(2);

    // Each inline element contains mathml and katex-html representations
    inlineMathElements.forEach((el) => {
      expect(el.querySelector('.katex-mathml')).not.toBeNull();
      expect(el.querySelector('.katex-html')).not.toBeNull();
      expect(el.querySelector('math')).not.toBeNull();
    });
  });

  test('renders block math with KaTeX display markup (.katex-display and .katex classes)', () => {
    const { container } = renderFixture('math', {});

    const displayBlocks = container.querySelectorAll('.katex-display');
    expect(displayBlocks.length).toBe(2);

    displayBlocks.forEach((block) => {
      const katexChild = block.querySelector('.katex');
      expect(katexChild).not.toBeNull();
      expect(block.querySelector('.katex-mathml')).not.toBeNull();
      expect(block.querySelector('.katex-html')).not.toBeNull();
      expect(block.querySelector('math[display="block"]')).not.toBeNull();
    });
  });

  test('does not emit any <script> tags or executable script markup (CSS-only KaTeX)', () => {
    const { container } = renderFixture('math', {});

    // No <script> tags anywhere in the rendered document
    const scriptTags = container.querySelectorAll('script');
    expect(scriptTags.length).toBe(0);

    // No inline on* event handler attributes
    const allElements = container.querySelectorAll('*');
    allElements.forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      }
    });
  });

  test('preserves surrounding prose text alongside math formulas', () => {
    const { container } = renderFixture('math', {});

    expect(container.textContent).toContain('the mass–energy relation');
    expect(container.textContent).toContain('sit on the text baseline');
    expect(container.textContent).toContain(
      'Block math is centered on its own line',
    );
    expect(container.textContent).toContain('A second block with a sum');
  });
});

describe('Math (KaTeX) — L2 golden snapshot', () => {
  test('rendered HTML is stable', () => {
    const { container } = renderFixture('math', {});
    expect(container.innerHTML).toMatchSnapshot();
  });
});
