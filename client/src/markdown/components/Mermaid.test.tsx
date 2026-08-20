// @vitest-environment jsdom
/**
 * R2 — Mermaid diagram component: L1 DOM assertions + security regression.
 *
 * The mermaid module is MOCKED (`vi.mock('mermaid', …)`): real mermaid rendering
 * in jsdom is slow and non-deterministic (a prior attempt timed out), and the
 * unit under test is our *wiring* — the strict-security config we hand mermaid,
 * the source sanitization, the SVG hardening, the error isolation, and the a11y
 * stamping — none of which needs a real layout engine. The mock lets us both
 * (a) assert the exact config/source we pass in, and (b) feed a deliberately
 * hostile SVG back out to prove the hardening strips it.
 *
 * Covered (R2 acceptance / security §3.1):
 *   - a ```mermaid fence renders inline `<svg>` via the mocked render path,
 *     initialized with `securityLevel:'strict'` + `htmlLabels:false`;
 *   - an invalid diagram (mock rejects) → inline error card, never a throw;
 *   - the emitted SVG carries `role="img"` + an accessible `<title>`;
 *   - the `security/mermaid-injection` fixture renders safe DOM — no `<script>`,
 *     no `on*` handlers, no `<foreignObject>` HTML, no `javascript:` URL — and
 *     the author `%%{init}%%` downgrade / `click` directives never reach mermaid.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { readFixture } from '../../../../test/unit/render/harness.js';
import { Mermaid } from './Mermaid.js';

// Hoisted so `vi.mock` (also hoisted) can close over the same spies we assert on.
const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn(),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

const BENIGN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<g class="node"><rect x="1" y="1" width="40" height="20"></rect></g>' +
  '</svg>';

beforeEach(() => {
  initializeMock.mockReset();
  renderMock.mockReset();
  renderMock.mockResolvedValue({ svg: BENIGN_SVG });
  delete (window as { __pwned?: unknown; __MERMAID_THEME__?: unknown }).__pwned;
  delete (window as { __MERMAID_THEME__?: unknown }).__MERMAID_THEME__;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Extract the raw source of each ```mermaid fence from a fixture. */
function mermaidBlocks(md: string): string[] {
  return Array.from(md.matchAll(/```mermaid\n([\s\S]*?)```/g), (m) => m[1]);
}

describe('Mermaid — L1 render path', () => {
  test('a fence renders inline SVG via mermaid.render with strict config', async () => {
    const { container } = render(<Mermaid code={'flowchart LR\n  A --> B'} />);

    await waitFor(() =>
      expect(
        container.querySelector('[data-mermaid-status="ready"]'),
      ).not.toBeNull(),
    );

    // strict security config is handed to mermaid — this IS the diagram control.
    expect(initializeMock).toHaveBeenCalledTimes(1);
    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.securityLevel).toBe('strict');
    expect(config.htmlLabels).toBe(false);
    expect((config.flowchart as { htmlLabels?: unknown }).htmlLabels).toBe(
      false,
    );

    expect(renderMock).toHaveBeenCalledTimes(1);
    // an inline <svg> was inserted into the DOM.
    expect(container.querySelector('svg')).not.toBeNull();
  });

  test('shows a fixed-height loading placeholder before render resolves', () => {
    // Never-resolving render → component stays in the loading state.
    renderMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<Mermaid code={'flowchart LR\n  A --> B'} />);
    const loading = container.querySelector('[data-mermaid-status="loading"]');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('role')).toBe('status');
  });

  test('an invalid diagram renders an inline error card, never throwing', async () => {
    renderMock.mockRejectedValueOnce(
      new Error('Parse error on line 2: syntax error'),
    );
    const { container } = render(
      <Mermaid code={'flowchart LR\n  A -->\n  {{{ invalid'} />,
    );

    await waitFor(() =>
      expect(
        container.querySelector('[data-mermaid-status="error"]'),
      ).not.toBeNull(),
    );

    const card = container.querySelector('.mermaid-error');
    expect(card?.getAttribute('role')).toBe('alert');
    expect(
      card?.querySelector('.mermaid-error-message')?.textContent,
    ).toContain('Parse error');
    // No SVG leaked; the block is isolated to its error state.
    expect(container.querySelector('svg')).toBeNull();
  });

  test('the emitted SVG has role="img" and an accessible <title>', async () => {
    const { container } = render(
      <Mermaid code={'sequenceDiagram\n  A->>B: hi'} />,
    );

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBeTruthy();
    const titleEl = svg.querySelector('title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBeTruthy();
  });
});

describe('Mermaid — security (mermaid-injection fixture)', () => {
  const blocks = mermaidBlocks(readFixture('security/mermaid-injection'));

  test('the fixture contains the three injection vectors', () => {
    // Guards against a fixture drift silently emptying the loop below.
    expect(blocks.length).toBe(3);
  });

  test('the author %%{init}%% downgrade and click directives never reach mermaid', async () => {
    for (const block of blocks) {
      renderMock.mockClear();
      initializeMock.mockClear();
      const { container, unmount } = render(<Mermaid code={block} />);
      await waitFor(() =>
        expect(
          container.querySelector('[data-mermaid-status="ready"]'),
        ).not.toBeNull(),
      );

      // strict config is requested for every diagram.
      const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
      expect(config.securityLevel).toBe('strict');
      expect(config.htmlLabels).toBe(false);

      // The source actually handed to mermaid is sanitized: no author init
      // directive (which tried securityLevel:loose) and no click/callback lines.
      const passedSource = renderMock.mock.calls[0][1] as string;
      expect(passedSource).not.toContain('%%{init');
      expect(passedSource).not.toContain('securityLevel');
      expect(/^\s*click\b/m.test(passedSource)).toBe(false);
      expect(/^\s*callback\b/m.test(passedSource)).toBe(false);

      unmount();
    }
  });

  test('a hostile SVG returned by mermaid is stripped before insertion', async () => {
    // Simulate an SVG that (defensively) still carried dangerous content: the
    // component must never inject script/foreignObject-HTML/on*/javascript:.
    renderMock.mockResolvedValue({
      svg:
        '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<script>window.__pwned = true;</script>' +
        '<foreignObject><div onclick="window.__pwned = true">html label</div></foreignObject>' +
        '<a href="javascript:window.__pwned = true" onmouseover="window.__pwned = true">x</a>' +
        '<g class="node"><rect/></g>' +
        '</svg>',
    });

    const { container } = render(<Mermaid code={blocks[0]} />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('script')).toBeNull();
    expect(svg.querySelector('foreignObject')).toBeNull();

    // No inline event-handler attribute survives anywhere.
    const withHandlers = Array.from(svg.querySelectorAll('*')).filter((el) =>
      Array.from(el.attributes).some((a) =>
        a.name.toLowerCase().startsWith('on'),
      ),
    );
    expect(withHandlers).toEqual([]);

    // No javascript: URL survives on any href/src.
    const jsUrls = Array.from(svg.querySelectorAll('*')).filter((el) =>
      ['href', 'xlink:href', 'src'].some((attr) =>
        (el.getAttribute(attr) ?? '')
          .replace(/[\s-]+/g, '')
          .toLowerCase()
          .startsWith('javascript:'),
      ),
    );
    expect(jsUrls).toEqual([]);

    // The payload never executed.
    expect((window as { __pwned?: unknown }).__pwned).toBeUndefined();
  });
});
