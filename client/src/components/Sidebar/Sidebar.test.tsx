// @vitest-environment jsdom
/**
 * U1 — `Sidebar` navigation tree (Design.md §3.1, features spec §7, §10).
 *
 * Covers the behaviours the card calls out: labels are the resolved `title`
 * (asserted against a deliberately filename-y fixture, never the raw filename),
 * directory group headers, the active-link highlight from the route, the three
 * async states, and the controlled mobile-drawer props.
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
import type { TreeResponse } from '@wiki/contracts';
import { DataProvider } from '../../api/DataProvider.js';
import { Sidebar } from './Sidebar.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * A filename-y fixture: raw filenames carry ordering prefixes and extensions,
 * but the resolved `title` is what must render. Intentionally out of `order` so
 * the component's sort is exercised too.
 */
const tree: TreeResponse = [
  { name: 'index.md', path: 'index.md', title: 'Home', type: 'file', order: 1 },
  {
    name: 'adr',
    path: 'adr',
    title: 'Decisions',
    type: 'directory',
    children: [
      {
        name: '0002-frontend_state.md',
        path: 'adr/0002-frontend_state.md',
        title: 'Frontend State',
        type: 'file',
        order: 2,
      },
      {
        name: '0001-architecture-overview.md',
        path: 'adr/0001-architecture-overview.md',
        title: 'Architecture Overview',
        type: 'file',
        order: 1,
      },
      {
        name: '9999-secret.md',
        path: 'adr/9999-secret.md',
        title: 'Secret',
        type: 'file',
        hidden: true,
      },
    ],
  },
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

function renderSidebar(
  entry = '/',
  props: { isOpen?: boolean; onClose?: () => void } = {},
): void {
  render(
    <DataProvider client={testClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Sidebar {...props} />
      </MemoryRouter>
    </DataProvider>,
  );
}

function stubTree(body: TreeResponse): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      if (String(input).startsWith('/api/tree')) {
        return Promise.resolve(json(200, body));
      }
      return Promise.reject(new Error(`unexpected fetch: ${input}`));
    }),
  );
}

/**
 * Folders start collapsed (auto-expanding only the active doc's ancestors), so
 * tests that inspect nested entries expand the group first by clicking its
 * header button.
 */
async function expandGroup(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name }));
}

describe('titles, not filenames (features spec §7)', () => {
  test('renders resolved titles and never the raw filename', async () => {
    stubTree(tree);
    renderSidebar('/');
    await expandGroup('Decisions');

    // Titles are shown…
    expect(screen.getByText('Architecture Overview')).not.toBeNull();
    expect(screen.getByText('Frontend State')).not.toBeNull();
    expect(screen.getByText('Home')).not.toBeNull();

    // …and the filename-y strings never leak into the DOM.
    expect(screen.queryByText('0001-architecture-overview.md')).toBeNull();
    expect(screen.queryByText(/0002-frontend_state/)).toBeNull();
    expect(screen.queryByText('index.md')).toBeNull();
  });

  test('shows the full title as a tooltip on the link', async () => {
    stubTree(tree);
    renderSidebar('/');
    await expandGroup('Decisions');

    const link = await screen.findByRole('link', {
      name: 'Architecture Overview',
    });
    expect(link.getAttribute('title')).toBe('Architecture Overview');
    expect(link.getAttribute('href')).toBe('/adr/0001-architecture-overview');
  });

  test('renders the directory as an all-caps-styled group header', async () => {
    stubTree(tree);
    renderSidebar('/');
    // DOM text stays the title ("Decisions"); the uppercasing is CSS-only.
    expect(await screen.findByText('Decisions')).not.toBeNull();
  });

  test('drops hidden nodes from the tree', async () => {
    stubTree(tree);
    renderSidebar('/');
    await expandGroup('Decisions');
    expect(screen.getByText('Architecture Overview')).not.toBeNull();
    expect(screen.queryByText('Secret')).toBeNull();
  });

  test('orders siblings by `order` ascending', async () => {
    stubTree(tree);
    renderSidebar('/');
    await expandGroup('Decisions');
    const links = screen.getAllByRole('link').map((el) => el.textContent);
    // Home (order 1, root) then the adr group in order: Architecture, Frontend.
    expect(links).toEqual(['Home', 'Architecture Overview', 'Frontend State']);
  });
});

describe('collapsible folders', () => {
  test('folders start collapsed and expand on click', async () => {
    stubTree(tree);
    renderSidebar('/');
    const header = await screen.findByRole('button', { name: 'Decisions' });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Architecture Overview')).toBeNull();

    await expandGroup('Decisions');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Architecture Overview')).not.toBeNull();
  });

  test('auto-expands the ancestors of the active doc', async () => {
    stubTree(tree);
    renderSidebar('/adr/0001-architecture-overview');
    // No manual expand: the active doc is revealed by ancestor auto-expansion.
    expect(await screen.findByText('Architecture Overview')).not.toBeNull();
  });
});

describe('active link (Design.md §3.1)', () => {
  test('marks the entry matching the current route as active', async () => {
    stubTree(tree);
    renderSidebar('/adr/0001-architecture-overview');

    const active = await screen.findByRole('link', {
      name: 'Architecture Overview',
    });
    expect(active.getAttribute('data-active')).toBe('true');
    expect(active.getAttribute('aria-current')).toBe('page');

    // A non-matching entry is not active.
    const other = screen.getByRole('link', { name: 'Home' });
    expect(other.getAttribute('data-active')).toBeNull();
    expect(other.getAttribute('aria-current')).toBeNull();
  });
});

describe('async states (features spec §10)', () => {
  test('shows the skeleton while the tree request is in flight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderSidebar('/');
    expect(await screen.findByTestId('sidebar-skeleton')).not.toBeNull();
  });

  test('shows the empty state for an empty tree', async () => {
    stubTree([]);
    renderSidebar('/');
    expect(await screen.findByTestId('sidebar-empty')).not.toBeNull();
    expect(screen.getByText('No documents yet')).not.toBeNull();
  });

  test('shows an error with retry, and retrying recovers', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (!String(input).startsWith('/api/tree')) {
          return Promise.reject(new Error('unexpected'));
        }
        attempt += 1;
        if (attempt === 1) {
          return Promise.resolve(
            json(500, { error: { code: 'INTERNAL', message: 'boom' } }),
          );
        }
        return Promise.resolve(json(200, tree));
      }),
    );

    renderSidebar('/');

    expect(await screen.findByTestId('sidebar-error')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await expandGroup('Decisions');
    expect(screen.getByText('Architecture Overview')).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByTestId('sidebar-error')).toBeNull(),
    );
  });
});

describe('mobile drawer props', () => {
  test('open drawer closes on backdrop click, close button, and link nav', async () => {
    stubTree(tree);
    const onClose = vi.fn();
    renderSidebar('/', { isOpen: true, onClose });

    await expandGroup('Decisions');

    const backdrop = document.querySelector('.sidebar__backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close navigation'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(
      screen.getByRole('link', { name: 'Architecture Overview' }),
    );
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test('Escape closes the open drawer', async () => {
    stubTree(tree);
    const onClose = vi.fn();
    renderSidebar('/', { isOpen: true, onClose });
    await screen.findByText('Decisions');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('a closed drawer is hidden from assistive tech', async () => {
    stubTree(tree);
    renderSidebar('/', { isOpen: false, onClose: vi.fn() });
    await waitFor(() => {
      const nav = document.querySelector('nav.sidebar');
      expect(nav?.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
