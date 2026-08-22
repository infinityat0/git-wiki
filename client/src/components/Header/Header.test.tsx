// @vitest-environment jsdom
/**
 * U5 — Header behaviour (Design.md §2.1/§4.1/§8, features spec §4.1/§10).
 *
 * F5 (`@/theme`) and F6 (`@/hooks`) are mocked so the header's wiring can be
 * asserted in isolation: the theme toggle flips `useTheme`, the search trigger
 * opens the U4 search store, the Sync button fires `useSync`, and the sync
 * failure surfaces as the non-blocking toast (§10). The search store is the real
 * F6 slice — we assert its resulting state rather than mock it.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  toggle: vi.fn(),
  mutate: vi.fn(),
  theme: { isDark: false },
  sync: { isPending: false, isError: false, error: null as unknown },
  health: {
    data: { status: 'ok', searchIndex: 'ready', docsRepo: 'clean' } as {
      status: string;
      searchIndex: string;
      docsRepo: string;
    } | null,
  },
}));

vi.mock('../../theme/index.js', () => ({
  useTheme: () => ({
    isDark: mocks.theme.isDark,
    theme: mocks.theme.isDark ? 'dark' : 'light',
    toggle: mocks.toggle,
    setTheme: vi.fn(),
  }),
}));

vi.mock('../../hooks/index.js', () => ({
  useHealth: () => mocks.health,
  useSync: () => ({
    mutate: mocks.mutate,
    isPending: mocks.sync.isPending,
    isError: mocks.sync.isError,
    error: mocks.sync.error,
  }),
}));

import { Header } from './Header.js';
import HeaderDefault from './Header.js';
import { useSearchStore } from '../../stores/index.js';

function renderHeader(props?: { onMenuClick?: () => void }) {
  return render(
    <MemoryRouter>
      <Header onMenuClick={props?.onMenuClick} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.toggle.mockReset();
  mocks.mutate.mockReset();
  mocks.theme.isDark = false;
  mocks.sync.isPending = false;
  mocks.sync.isError = false;
  mocks.sync.error = null;
  mocks.health.data = {
    status: 'ok',
    searchIndex: 'ready',
    docsRepo: 'clean',
  };
  useSearchStore.getState().closeSearch();
});

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  test('theme toggle flips useTheme', () => {
    renderHeader();
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );
    expect(mocks.toggle).toHaveBeenCalledTimes(1);
  });

  test('theme toggle reflects the active theme via aria-pressed + label', () => {
    mocks.theme.isDark = true;
    renderHeader();
    const btn = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  test('search trigger opens the search store', () => {
    renderHeader();
    expect(useSearchStore.getState().open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(useSearchStore.getState().open).toBe(true);
  });

  test('Sync button triggers useSync', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  test('Sync button shows a spinning "Syncing…" state and is disabled while pending', () => {
    mocks.sync.isPending = true;
    renderHeader();
    const btn = screen.getByRole('button', {
      name: 'Sync now',
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getAllByText('Syncing…').length).toBeGreaterThan(0);
    fireEvent.click(btn);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  test('background poller (health docsRepo=syncing) reflects a syncing state', () => {
    mocks.health.data = {
      status: 'ok',
      searchIndex: 'ready',
      docsRepo: 'syncing',
    };
    renderHeader();
    const btn = screen.getByRole('button', {
      name: 'Sync now',
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test('a failed sync surfaces a non-blocking error toast', () => {
    mocks.sync.isError = true;
    mocks.sync.error = new Error('fatal: could not read from remote');
    renderHeader();
    const toast = screen.getByRole('alert');
    expect(toast.textContent).toContain('fatal: could not read from remote');
    // Dismissible without blocking.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss sync error' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('mobile menu button calls onMenuClick', () => {
    const onMenuClick = vi.fn();
    renderHeader({ onMenuClick });
    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  test('icon-only buttons carry aria-labels (§8)', () => {
    renderHeader();
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /switch to (dark|light) theme/i }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'git-wiki home' }).getAttribute('href'),
    ).toBe('/');
  });

  test('exports Header as both default and named', () => {
    expect(HeaderDefault).toBe(Header);
  });
});
