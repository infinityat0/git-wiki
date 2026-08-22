// @vitest-environment jsdom
/**
 * U3 — routing + content view integration (features spec §9, §10).
 *
 * Drives `AppRoutes` under a `MemoryRouter` with a stubbed `fetch` so the whole
 * chain runs: route → doc path → `useDoc` → `<Markdown>` (with the assembled R*
 * slots). Asserts the acceptance criteria:
 *   - deep link loads the right doc;
 *   - unknown route → in-app 404 (not blank);
 *   - a `#anchor` deep link is preserved through routing;
 *   - a doc renders through the pipeline with the R* slots (code block, link);
 *   - clicking an internal link navigates client-side.
 *
 * Assertions use plain DOM inspection (no jest-dom), matching the F7/F8 tests.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { DocResponse, TreeResponse } from '@wiki/contracts';
import { DataProvider } from '../api/DataProvider.js';
import { AppRoutes } from './AppRoutes.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tree: TreeResponse = [
  {
    name: 'adr',
    path: 'adr',
    title: 'ADR',
    type: 'directory',
    children: [
      {
        name: '0001-architecture-overview.md',
        path: 'adr/0001-architecture-overview.md',
        title: 'Architecture Overview',
        type: 'file',
      },
    ],
  },
  { name: 'intro.md', path: 'intro.md', title: 'Intro', type: 'file' },
];

const DOC_BODY = [
  '# Architecture Overview',
  '',
  '## Goals',
  '',
  'Some prose with a [link to intro](../intro.md).',
  '',
  '```ts',
  'const x = 1;',
  '```',
].join('\n');

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Route `fetch` calls by URL: tree, the one known doc, everything-else → 404. */
function stubApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input);
      if (url.startsWith('/api/tree')) return json(200, tree);
      if (url.startsWith('/api/doc')) {
        const path = new URL(url, 'http://x').searchParams.get('path') ?? '';
        const bodies: Record<string, string> = {
          'adr/0001-architecture-overview.md': DOC_BODY,
          'intro.md': '# Intro\n\nWelcome.',
        };
        if (path in bodies) {
          const doc: DocResponse = {
            path,
            content: bodies[path],
            lastModified: '2026-08-18T05:22:15Z',
          };
          return json(200, doc);
        }
        return json(404, {
          error: { code: 'NOT_FOUND', message: 'no such doc' },
        });
      }
      return json(404, { error: { code: 'NOT_FOUND', message: 'nope' } });
    }),
  );
}

function testClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderAt(initialEntry: string): void {
  render(
    <DataProvider client={testClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </DataProvider>,
  );
}

describe('deep links', () => {
  test('a deep link loads the right doc through the pipeline', async () => {
    stubApi();
    renderAt('/adr/0001-architecture-overview');

    // Rendered heading from the markdown pipeline (rehype-slug gives it an id).
    const heading = await screen.findByRole('heading', {
      name: 'Architecture Overview',
      level: 1,
    });
    expect(heading.id).toBe('architecture-overview');

    // R* slots are wired: the fenced code block became a CodeBlock (lang tag)…
    await waitFor(() =>
      expect(document.querySelector('[data-lang]')).not.toBeNull(),
    );
    // …and the internal link was rewritten to an SPA route by MdLink.
    const link = screen.getByRole('link', { name: 'link to intro' });
    expect(link.getAttribute('href')).toBe('/intro');
    expect(link.getAttribute('data-internal-link')).toBe('true');
  });

  test('an unknown route renders the in-app 404, not a blank page', async () => {
    stubApi();
    renderAt('/adr/does-not-exist');

    const notFound = await screen.findByTestId('docview-notfound');
    expect(notFound).not.toBeNull();
    expect(screen.getByText('404')).not.toBeNull();
  });

  test('the index route renders a landing, not a 404', async () => {
    stubApi();
    renderAt('/');
    expect(await screen.findByTestId('docview-index')).not.toBeNull();
    expect(screen.queryByTestId('docview-notfound')).toBeNull();
  });
});

describe('anchor deep links', () => {
  test('the #anchor fragment is preserved by routing', async () => {
    stubApi();

    // A probe route echoes the current location so we can assert the hash
    // survives the render (it drives scroll-to; jsdom has no layout).
    function LocationProbe() {
      const loc = useLocation();
      return <span data-testid="hash">{loc.hash}</span>;
    }

    render(
      <DataProvider client={testClient()}>
        <MemoryRouter
          initialEntries={['/adr/0001-architecture-overview#goals']}
        >
          <Routes>
            <Route
              path="*"
              element={
                <div>
                  <AppRoutes />
                  <LocationProbe />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </DataProvider>,
    );

    await screen.findByRole('heading', {
      name: 'Architecture Overview',
      level: 1,
    });
    expect(screen.getByTestId('hash').textContent).toBe('#goals');
    // The heading targeted by the anchor is present with the matching id.
    expect(document.getElementById('goals')).not.toBeNull();
  });
});

describe('internal link navigation', () => {
  test('clicking an internal link navigates client-side', async () => {
    stubApi();
    renderAt('/adr/0001-architecture-overview');

    await screen.findByRole('heading', {
      name: 'Architecture Overview',
      level: 1,
    });

    const link = screen.getByRole('link', { name: 'link to intro' });
    expect(link.getAttribute('href')).toBe('/intro');
    // Client-side navigation swaps the rendered doc without a full reload: the
    // `Intro` heading replaces the `Architecture Overview` one.
    fireEvent.click(link);

    await screen.findByRole('heading', { name: 'Intro', level: 1 });
    expect(
      screen.queryByRole('heading', {
        name: 'Architecture Overview',
        level: 1,
      }),
    ).toBeNull();
  });
});
