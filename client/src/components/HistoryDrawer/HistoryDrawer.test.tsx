// @vitest-environment jsdom
/**
 * U6 — `HistoryDrawer` (features spec §4.1 item 6, §6.2, §10; Design.md §8).
 *
 * Covers what the card calls out: the commit list renders for a path, the three
 * async states (skeleton / "No history" / error+retry) each render, `Escape`
 * and the backdrop dismiss, and focus is moved into the panel on open and
 * restored to the trigger on close.
 *
 * `useHistory` is mocked so each state can be driven directly from a query-like
 * shape; the real `deriveAsyncStatus` / `isHistoryEmpty` remain in play.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import type { HistoryResponse } from '@wiki/contracts';
import { ApiClientError } from '../../api/errors.js';
import { HistoryDrawer } from './HistoryDrawer.js';

// ── useHistory mock ────────────────────────────────────────────────────────
const useHistoryMock = vi.fn();
const refetch = vi.fn();

vi.mock('../../hooks', async () => {
  const actual =
    await vi.importActual<typeof import('../../hooks')>('../../hooks');
  return { ...actual, useHistory: (path: string) => useHistoryMock(path) };
});

/** Build a React Query-like slice for the given phase. */
function query(
  phase: 'loading' | 'ready' | 'empty' | 'error',
  data?: HistoryResponse,
) {
  return {
    data: phase === 'ready' ? data : phase === 'empty' ? [] : undefined,
    isPending: phase === 'loading',
    isFetching: phase === 'loading',
    isError: phase === 'error',
    error:
      phase === 'error'
        ? new ApiClientError('INTERNAL', 'History exploded', 500)
        : null,
    refetch,
  };
}

const commits: HistoryResponse = [
  {
    hash: 'abcdef1234567890',
    author: 'Ada Lovelace',
    date: '2026-08-17T22:32:31-07:00',
    message: 'Add the analytical engine section',
  },
  {
    hash: '0011223344556677',
    author: 'Grace Hopper',
    date: '2026-08-10T09:00:00-07:00',
    message: 'Fix a bug (a literal moth)',
  },
];

afterEach(() => {
  cleanup();
  useHistoryMock.mockReset();
  refetch.mockReset();
});

function renderDrawer(props?: Partial<Parameters<typeof HistoryDrawer>[0]>) {
  const onClose = vi.fn();
  const utils = render(
    <HistoryDrawer
      isOpen
      onClose={onClose}
      path="guides/intro.md"
      {...props}
    />,
  );
  return { onClose, ...utils };
}

describe('HistoryDrawer', () => {
  test('renders the commit list for the given path', () => {
    useHistoryMock.mockReturnValue(query('ready', commits));
    renderDrawer();

    // The hook is asked for the doc path while open.
    expect(useHistoryMock).toHaveBeenCalledWith('guides/intro.md');

    const items = screen.getAllByTestId('history-item');
    expect(items).toHaveLength(2);

    const first = within(items[0]);
    expect(first.getByText('Add the analytical engine section')).toBeTruthy();
    expect(first.getByText('Ada Lovelace')).toBeTruthy();
    // Short (7-char) hash is shown; full hash is the title.
    expect(first.getByText('abcdef1')).toBeTruthy();
  });

  test('shows the loading skeleton while the request is in flight', () => {
    useHistoryMock.mockReturnValue(query('loading'));
    renderDrawer();
    expect(screen.getByTestId('history-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('history-list')).toBeNull();
  });

  test('shows the empty state when there is no history', () => {
    useHistoryMock.mockReturnValue(query('empty'));
    renderDrawer();
    expect(screen.getByTestId('history-empty')).toBeTruthy();
    expect(screen.getByText('No history')).toBeTruthy();
  });

  test('shows the error state and retries on click', () => {
    useHistoryMock.mockReturnValue(query('error'));
    renderDrawer();

    const error = screen.getByTestId('history-error');
    expect(error).toBeTruthy();
    expect(within(error).getByText('History exploded')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('does not fetch history while closed', () => {
    useHistoryMock.mockReturnValue(query('loading'));
    render(
      <HistoryDrawer isOpen={false} onClose={vi.fn()} path="guides/intro.md" />,
    );
    // Closed drawer disables the query by passing an empty path.
    expect(useHistoryMock).toHaveBeenCalledWith('');
    expect(useHistoryMock).not.toHaveBeenCalledWith('guides/intro.md');
  });

  test('Escape closes the drawer', () => {
    useHistoryMock.mockReturnValue(query('ready', commits));
    const { onClose } = renderDrawer();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('a backdrop click closes the drawer', () => {
    useHistoryMock.mockReturnValue(query('ready', commits));
    const { onClose } = renderDrawer();
    // The backdrop is aria-hidden; select it by class from the container.
    const backdrop = document.querySelector('.history__backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the close button closes the drawer', () => {
    useHistoryMock.mockReturnValue(query('ready', commits));
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('moves focus into the panel on open and restores it on close', () => {
    useHistoryMock.mockReturnValue(query('ready', commits));

    // A trigger button that owns focus before the drawer opens.
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const onClose = vi.fn();
    const { rerender } = render(
      <HistoryDrawer isOpen onClose={onClose} path="guides/intro.md" />,
    );

    // Focus has moved into the drawer (onto its first focusable — the close btn).
    const closeBtn = screen.getByRole('button', { name: 'Close history' });
    expect(document.activeElement).toBe(closeBtn);

    // Closing restores focus to the original trigger.
    rerender(
      <HistoryDrawer isOpen={false} onClose={onClose} path="guides/intro.md" />,
    );
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  test('traps Tab focus within the panel', () => {
    useHistoryMock.mockReturnValue(query('ready', commits));
    renderDrawer();

    const closeBtn = screen.getByRole('button', { name: 'Close history' });
    // Only the close button is focusable here, so Tab wraps back to it.
    closeBtn.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(document.activeElement).toBe(closeBtn);
  });
});
