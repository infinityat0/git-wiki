// @vitest-environment jsdom
/**
 * R1 — Code Block Component: L1 DOM assertions + L2 golden snapshot.
 *
 * Tests the code block renderer through F7's <Markdown> pipeline via the shared
 * harness and `code-blocks.md` fixture.
 *
 * Manifest assertions covered:
 *   - syntax highlighted (token spans present with language syntax rules)
 *   - language tag shown (e.g. TypeScript, Shell, text)
 *   - copy button present (with interactive click feedback and timeout)
 *   - always dark background / frame class
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, act } from '@testing-library/react';
import { renderFixture } from '../../../../test/unit/render/harness.js';
import { CodeBlock } from './CodeBlock.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CodeBlock — L1 DOM structure', () => {
  test('renders code block frames with dark frame class', () => {
    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    const blocks = container.querySelectorAll('.code-block');
    expect(blocks.length).toBe(3);
    blocks.forEach((block) => {
      expect(block.classList.contains('code-block-dark')).toBe(true);
      expect(block.classList.contains('dark-frame')).toBe(true);
    });
  });

  test('displays correct language tag labels', () => {
    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    const langTags = container.querySelectorAll('.code-block-lang');
    expect(langTags.length).toBe(3);

    const labels = Array.from(langTags).map((el) => el.textContent?.trim());
    expect(labels).toEqual(['TypeScript', 'Shell', 'text']);

    const dataLangs = Array.from(langTags).map((el) =>
      el.getAttribute('data-lang'),
    );
    expect(dataLangs).toEqual(['typescript', 'bash', 'text']);
  });

  test('renders copy buttons with initial "Copy" state', () => {
    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    const copyButtons = container.querySelectorAll('.code-block-copy-btn');
    expect(copyButtons.length).toBe(3);
    copyButtons.forEach((btn) => {
      expect(btn.textContent).toBe('Copy');
      expect(btn.getAttribute('type')).toBe('button');
    });
  });

  test('syntax highlighting generates token spans for code', () => {
    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    const tokens = container.querySelectorAll('.token');
    expect(tokens.length).toBeGreaterThan(0);
  });

  test('copy button clicks show "Copied!" feedback and write to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    const firstCopyBtn = container.querySelector(
      '.code-block-copy-btn',
    ) as HTMLButtonElement;
    expect(firstCopyBtn).not.toBeNull();
    expect(firstCopyBtn.textContent).toBe('Copy');

    await act(async () => {
      fireEvent.click(firstCopyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('export interface TreeNode'),
    );
    expect(firstCopyBtn.textContent).toBe('Copied!');
  });

  test('reverts "Copied!" feedback back to "Copy" after timeout', async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    const firstCopyBtn = container.querySelector(
      '.code-block-copy-btn',
    ) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(firstCopyBtn);
    });
    expect(firstCopyBtn.textContent).toBe('Copied!');

    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(firstCopyBtn.textContent).toBe('Copy');

    vi.useRealTimers();
  });

  test('preserves inline code as standard code element without frame', () => {
    const { container } = renderFixture('inline-code', {
      slots: { code: CodeBlock },
    });
    expect(container.querySelector('.code-block')).toBeNull();
    const inlineCodes = container.querySelectorAll('code');
    expect(inlineCodes.length).toBeGreaterThan(0);
    expect(inlineCodes[0].textContent).toBe('useState');
  });
});

describe('code-blocks — L2 golden snapshot', () => {
  test('rendered HTML is stable', () => {
    const { container } = renderFixture('code-blocks', {
      slots: { code: CodeBlock },
    });
    expect(container.innerHTML).toMatchSnapshot();
  });
});
