// @vitest-environment jsdom
/**
 * U3 — `DocView` async states (features spec §10).
 *
 * Focuses on the loading skeleton and the non-404 error+retry path, which the
 * routing integration test does not exercise. Renders `DocView` directly under a
 * `MemoryRouter` (it reads the route via `useLocation`) with a stubbed `fetch`.
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
import { MemoryRouter } from 'react-router-dom';
import type { DocResponse, TreeResponse } from '@wiki/contracts';
import { DataProvider } from '../../api/DataProvider.js';
import { DocView } from './DocView.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tree: TreeResponse = [
  { name: 'intro.md', path: 'intro.md', title: 'Intro', type: 'file' },
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function testClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderDocView(entry: string): void {
  render(
    <DataProvider client={testClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <DocView />
      </MemoryRouter>
    </DataProvider>,
  );
}

test('shows the loading skeleton while the doc request is in flight', async () => {
  let resolveDoc: (r: Response) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = String(input);
      if (url.startsWith('/api/tree')) return Promise.resolve(json(200, tree));
      return new Promise<Response>((resolve) => {
        resolveDoc = resolve;
      });
    }),
  );

  renderDocView('/intro');
  expect(await screen.findByTestId('docview-skeleton')).not.toBeNull();

  const doc: DocResponse = {
    path: 'intro.md',
    content: '# Intro',
    lastModified: '2026-08-18T05:22:15Z',
  };
  resolveDoc(json(200, doc));

  await screen.findByRole('heading', { name: 'Intro', level: 1 });
  expect(screen.queryByTestId('docview-skeleton')).toBeNull();
});

describe('error + retry (features spec §10)', () => {
  test('shows an error with retry, and retrying recovers', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.startsWith('/api/tree')) return json(200, tree);
        attempt += 1;
        if (attempt === 1) {
          return json(500, {
            error: { code: 'INTERNAL', message: 'boom' },
          });
        }
        const doc: DocResponse = {
          path: 'intro.md',
          content: '# Intro',
          lastModified: '2026-08-18T05:22:15Z',
        };
        return json(200, doc);
      }),
    );

    renderDocView('/intro');

    const error = await screen.findByTestId('docview-error');
    expect(error).not.toBeNull();
    // A 500 is NOT treated as a 404.
    expect(screen.queryByTestId('docview-notfound')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByRole('heading', { name: 'Intro', level: 1 });
    await waitFor(() =>
      expect(screen.queryByTestId('docview-error')).toBeNull(),
    );
  });
});
