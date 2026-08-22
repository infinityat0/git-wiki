// @vitest-environment jsdom
/**
 * U4 — `SearchModal` behaviour (Design.md §4.2, features spec §6.2, §10, §13).
 *
 * Covers the card's acceptance surface: open/close via the store and the global
 * `⌘K` / `/` shortcuts + Escape; the full keyboard flow (arrow navigation,
 * Enter → route); the focus trap and focus restore; select-navigates; and the
 * warming / empty / error async states. The F6 hooks are exercised for real
 * (React Query over a stubbed `fetch`) rather than mocked, so the debounce and
 * query wiring are covered too.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { SearchResponse } from '@wiki/contracts';
import { DataProvider } from '../../api/DataProvider.js';
import { useSearchStore } from '../../stores/index.js';
import { SearchModal } from './SearchModal.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // The store is a module singleton — reset it between tests.
  act(() => useSearchStore.setState({ open: false }));
});

const RESULTS: SearchResponse = [
  {
    path: 'adr/0001-architecture-overview.md',
    title: 'Architecture Overview',
    matches: ['…the **arch** decision record…'],
  },
  {
    path: 'guides/search.md',
    title: 'Search Guide',
    matches: ['…how **arch** search works…'],
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

interface StubOptions {
  searchIndex?: 'ready' | 'building';
  search?: () => Promise<Response>;
}

/** Stub `fetch` for the two endpoints the modal touches: health + search. */
function stubApi(opts: StubOptions = {}): void {
  const { searchIndex = 'ready', search } = opts;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = String(input);
      if (url.startsWith('/api/health')) {
        return Promise.resolve(
          json(200, { status: 'ok', searchIndex, docsRepo: 'clean' }),
        );
      }
      if (url.startsWith('/api/search')) {
        return search ? search() : Promise.resolve(json(200, RESULTS));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

/** Renders the current router pathname so navigation can be asserted. */
function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderModal(): void {
  render(
    <DataProvider client={testClient()}>
      <MemoryRouter initialEntries={['/']}>
        <button type="button" data-testid="trigger">
          trigger
        </button>
        <SearchModal />
        <LocationProbe />
      </MemoryRouter>
    </DataProvider>,
  );
}

function openViaStore(): void {
  act(() => useSearchStore.getState().openSearch());
}

async function typeQuery(text: string): Promise<void> {
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: text } });
}

describe('open / close', () => {
  test('renders nothing while the store is closed', () => {
    stubApi();
    renderModal();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens when the store flag is set', () => {
    stubApi();
    renderModal();
    openViaStore();
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  test('⌘K toggles the modal open then closed', () => {
    stubApi();
    renderModal();
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('Ctrl+K opens the modal (non-mac)', () => {
    stubApi();
    renderModal();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  test('the `/` shortcut opens the modal', () => {
    stubApi();
    renderModal();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  test('`/` does not open while typing in a field', () => {
    stubApi();
    renderModal();
    const trigger = screen.getByTestId('trigger');
    fireEvent.keyDown(trigger, { key: '/' }); // trigger is a button, not editable
    expect(screen.getByRole('dialog')).not.toBeNull();
    // …but a keystroke originating in an input must be ignored.
    act(() => useSearchStore.setState({ open: false }));
    const editable = document.createElement('input');
    document.body.appendChild(editable);
    fireEvent.keyDown(editable, { key: '/' });
    expect(screen.queryByRole('dialog')).toBeNull();
    editable.remove();
  });

  test('Escape closes the modal', () => {
    stubApi();
    renderModal();
    openViaStore();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('clicking the backdrop closes the modal', () => {
    stubApi();
    renderModal();
    openViaStore();
    fireEvent.mouseDown(screen.getByTestId('search-modal-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('focus management (features spec §13)', () => {
  test('focuses the input on open', async () => {
    stubApi();
    renderModal();
    openViaStore();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  test('restores focus to the trigger on close', async () => {
    stubApi();
    renderModal();
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    openViaStore();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('combobox')),
    );

    act(() => useSearchStore.getState().closeSearch());
    expect(document.activeElement).toBe(trigger);
  });

  test('traps Tab focus inside the dialog', async () => {
    stubApi();
    renderModal();
    openViaStore();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(document.activeElement).toBe(input));
    // Tab / Shift+Tab must keep focus within the dialog, not escape to <body>.
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(input);
  });
});

describe('results, keyboard flow & navigation', () => {
  test('renders results with highlighted snippets', async () => {
    stubApi();
    renderModal();
    openViaStore();
    await typeQuery('arch');
    expect(await screen.findByText('Architecture Overview')).not.toBeNull();
    expect(screen.getByText('Search Guide')).not.toBeNull();
    // The `**arch**` marker in the snippet renders as a <mark>.
    expect(document.querySelector('.search-modal__mark')).not.toBeNull();
  });

  test('arrow keys move the active option and Enter navigates to it', async () => {
    stubApi();
    renderModal();
    openViaStore();
    await typeQuery('arch');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    // First option is active by default.
    expect(options[0].getAttribute('aria-selected')).toBe('true');

    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe(
      'true',
    );

    fireEvent.keyDown(input, { key: 'Enter' });
    // Second result → its route; modal closes.
    expect(screen.getByTestId('location').textContent).toBe('/guides/search');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('clicking a result navigates and closes', async () => {
    stubApi();
    renderModal();
    openViaStore();
    await typeQuery('arch');
    fireEvent.click(await screen.findByText('Architecture Overview'));
    expect(screen.getByTestId('location').textContent).toBe(
      '/adr/0001-architecture-overview',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('ArrowUp from the first option wraps to the last', async () => {
    stubApi();
    renderModal();
    openViaStore();
    await typeQuery('arch');
    await screen.findAllByRole('option');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});

describe('async states (features spec §10)', () => {
  test('shows the "index warming up" hint when searchIndex is building', async () => {
    stubApi({ searchIndex: 'building' });
    renderModal();
    openViaStore();
    expect(await screen.findByTestId('search-modal-warming')).not.toBeNull();
  });

  test('shows an empty state when a query has no results', async () => {
    stubApi({ search: () => Promise.resolve(json(200, [])) });
    renderModal();
    openViaStore();
    await typeQuery('zzz');
    const empty = await screen.findByTestId('search-modal-empty');
    expect(empty.textContent).toContain('zzz');
  });

  test('shows an inline error row when the search request fails', async () => {
    stubApi({ search: () => Promise.resolve(json(500, { code: 'BOOM' })) });
    renderModal();
    openViaStore();
    await typeQuery('arch');
    expect(await screen.findByTestId('search-modal-error')).not.toBeNull();
  });

  test('shows a hint before any query is typed', () => {
    stubApi();
    renderModal();
    openViaStore();
    expect(screen.getByTestId('search-modal-hint')).not.toBeNull();
  });
});
