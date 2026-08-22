// @vitest-environment jsdom
/**
 * F7 acceptance — the "it works" half: slug ids + TOC, callouts, live iframe
 * embeds, frontmatter suppression, and the component-map seam that the `R*`
 * tasks plug into (proving they can override presentation without touching the
 * pipeline).
 */
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Markdown } from './Markdown.js';
import { extractToc } from './pipeline.js';
import { FORCED_SANDBOX } from './sanitize.js';
import type { MarkdownSlots, TocEntry } from './index.js';
import { readFixture } from './fixtures.js';

afterEach(cleanup);

describe('headings: slug ids + TOC', () => {
  test('h2/h3 receive de-duplicated slug ids', () => {
    const { container } = render(
      <Markdown content={readFixture('headings.md')} />,
    );
    expect(container.querySelector('h1')?.id).toBe('heading-level-1');
    expect(container.querySelector('h2')?.id).toBe('heading-level-2');
    expect(container.querySelector('h3')?.id).toBe('heading-level-3');
    // Two identical H2s → de-duplicated ids.
    const dupes = [...container.querySelectorAll('h2')]
      .map((h) => h.id)
      .filter((id) => id.startsWith('duplicate-title'));
    expect(dupes).toEqual(['duplicate-title', 'duplicate-title-1']);
  });

  test('extractToc emits H2/H3 only, with ids matching the rendered headings', () => {
    const toc: TocEntry[] = extractToc(readFixture('headings.md'));
    expect(toc).toEqual([
      { id: 'heading-level-2', text: 'Heading Level 2', depth: 2 },
      { id: 'heading-level-3', text: 'Heading Level 3', depth: 3 },
      { id: 'duplicate-title', text: 'Duplicate Title', depth: 2 },
      { id: 'duplicate-title-1', text: 'Duplicate Title', depth: 2 },
    ]);
  });

  test('onTocChange delivers the same TOC to a React consumer', () => {
    let received: TocEntry[] = [];
    render(
      <Markdown
        content={readFixture('headings.md')}
        onTocChange={(t) => {
          received = t;
        }}
      />,
    );
    expect(received.map((e) => e.id)).toEqual([
      'heading-level-2',
      'heading-level-3',
      'duplicate-title',
      'duplicate-title-1',
    ]);
  });
});

describe('callouts', () => {
  test('[!TYPE] blockquotes become callout divs with type + title seams', () => {
    const { container } = render(
      <Markdown content={readFixture('callouts.md')} />,
    );
    const note = container.querySelector('.callout-note');
    expect(note).not.toBeNull();
    expect(note?.getAttribute('data-callout')).toBe('note');
    expect(note?.getAttribute('data-callout-title')).toBe('Note');
    for (const type of ['tip', 'warning', 'caution']) {
      expect(container.querySelector(`.callout-${type}`)).not.toBeNull();
    }
    // The `[!NOTE]` marker text is stripped from the rendered body.
    expect(container.textContent).not.toContain('[!NOTE]');
  });
});

describe('iframes (allowlisted host)', () => {
  test('render live, sandboxed, lazy frames with passthrough attributes', () => {
    const { container } = render(
      <Markdown content={readFixture('iframes.md')} />,
    );
    const iframes = container.querySelectorAll('iframe');
    expect(iframes.length).toBe(2);
    const yt = iframes[0];
    expect(yt.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(yt.getAttribute('sandbox')).toBe(FORCED_SANDBOX);
    expect(yt.getAttribute('loading')).toBe('lazy');
    expect(yt.getAttribute('title')).toBe('Demo video');
    expect(yt.getAttribute('width')).toBe('560');
  });
});

describe('frontmatter', () => {
  test('YAML frontmatter is not rendered into the body', () => {
    const { container } = render(
      <Markdown content={readFixture('frontmatter.md')} />,
    );
    // `hidden: false` appears only inside the YAML block (not the body prose),
    // so its absence proves the block was consumed, not rendered.
    expect(container.textContent).not.toContain('hidden: false');
    expect(container.textContent).not.toContain('title: Human-Friendly Title');
    // The frontmatter fence must not have leaked as a thematic break.
    expect(container.querySelector('hr')).toBeNull();
    // The body still renders normally, starting at the H1.
    expect(container.querySelector('h1')?.textContent).toBe(
      'A Different H1 Than The Title',
    );
  });
});

describe('component-map seam', () => {
  test('R* can override callout, code, and the mermaid hook without touching sanitize', () => {
    const slots: MarkdownSlots = {
      callout: ({ type, title, children }) => (
        <aside data-testid="custom-callout" data-kind={type}>
          <strong>{title}</strong>
          {children}
        </aside>
      ),
      code: ({ children }) => <code data-testid="custom-code">{children}</code>,
      mermaid: ({ code }) => <div data-testid="custom-mermaid">{code}</div>,
    };
    const content = [
      '> [!TIP]',
      '> body text',
      '',
      'Inline `snippet` here.',
      '',
      '```mermaid',
      'graph TD; A-->B',
      '```',
      '',
    ].join('\n');
    const { container, getByTestId } = render(
      <Markdown content={content} slots={slots} />,
    );
    const callout = getByTestId('custom-callout');
    expect(callout.tagName).toBe('ASIDE');
    expect(callout.getAttribute('data-kind')).toBe('tip');
    expect(getByTestId('custom-code').textContent).toBe('snippet');
    expect(getByTestId('custom-mermaid').textContent).toContain('graph TD');
    // Default host div renderer is not used for callouts anymore.
    expect(container.querySelector('.callout-tip')).toBeNull();
  });
});
