/**
 * F8 — render harness for L1 (DOM) and L2 (snapshot) markdown tests.
 *
 * Every `R*` render task asserts against the SAME machinery: it renders a
 * fixture (or an inline markdown string) through F7's `<Markdown>` component and
 * inspects the resulting DOM. This helper is the single import site for that.
 *
 * Usage (an `R*` L1/L2 test):
 *
 * ```ts
 * // @vitest-environment jsdom
 * import { afterEach, expect, test } from 'vitest';
 * import { cleanup } from '@testing-library/react';
 * import { renderFixture } from './harness.js';
 *
 * afterEach(cleanup);
 *
 * test('code blocks get a language tag', () => {
 *   const { container } = renderFixture('code-blocks');   // L1
 *   expect(container.querySelector('[data-lang]')).not.toBeNull();
 *   expect(container.innerHTML).toMatchSnapshot();          // L2
 * });
 * ```
 *
 * Pass `slots` to exercise a task's own presentation renderers (the F7 seam);
 * pass `onTocChange` to capture the extracted H2/H3 table of contents.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import {
  Markdown,
  type MarkdownSlots,
  type TocEntry,
} from '../../../client/src/markdown/index.js';

/**
 * Directory holding the shared fixture corpus. Resolved from the Vitest root
 * (`process.cwd()` === repo root) rather than `import.meta.url`, which under the
 * jsdom environment does not resolve to a `file:` URL during module evaluation.
 */
const FIXTURES_DIR = resolve(process.cwd(), 'test/fixtures/markdown');

/**
 * Read a fixture's raw markdown source. Accepts either a bare element id
 * (`'headings'`) or an explicit filename (`'headings.md'`, `'security/x.md'`).
 */
export function readFixture(nameOrFile: string): string {
  const file = nameOrFile.endsWith('.md') ? nameOrFile : `${nameOrFile}.md`;
  return readFileSync(resolve(FIXTURES_DIR, file), 'utf8');
}

/** Options accepted by {@link renderMarkdown} / {@link renderFixture}. */
export interface RenderOptions {
  /** Presentation overrides (the `R*` renderers under test). */
  slots?: MarkdownSlots;
  /** Receives the extracted H2/H3 TOC after render. */
  onTocChange?: (toc: TocEntry[]) => void;
}

/** Render a raw markdown string through the F7 `<Markdown>` pipeline. */
export function renderMarkdown(
  content: string,
  options: RenderOptions = {},
): RenderResult {
  return render(
    createElement(Markdown, {
      content,
      slots: options.slots,
      onTocChange: options.onTocChange,
    }),
  );
}

/** Render a fixture (by id or filename) through the F7 `<Markdown>` pipeline. */
export function renderFixture(
  nameOrFile: string,
  options: RenderOptions = {},
): RenderResult {
  return renderMarkdown(readFixture(nameOrFile), options);
}
