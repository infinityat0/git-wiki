/**
 * U6 — Git History Drawer (features spec §4.1 item 6, §6.2, §10; Design.md §6,
 * §8).
 *
 * A controlled slide-in panel that lists the commit history for a single
 * document — short hash, author, date, and message per {@link HistoryEntry} —
 * fetched through F6's `useHistory(path)`. It owns its four async surfaces
 * (skeleton / "No history" / error+retry / ready) via `deriveAsyncStatus`, and
 * the modal-dialog accessibility the card calls out: an Escape-dismissable,
 * focus-trapped panel over a click-dismissable backdrop that restores focus to
 * the trigger on close (Design.md §8).
 *
 * Presentational + self-fetching, but *controlled*: the integrator owns the
 * open state and supplies the active doc `path` (derived at the Shell from the
 * route via U3's `routeToDocPath`). History is only requested while the drawer
 * is open, so a closed drawer performs no background fetch.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { HistoryEntry, HistoryResponse } from '@wiki/contracts';
import { deriveAsyncStatus, isHistoryEmpty, useHistory } from '../../hooks';
import {
  HistoryEmpty,
  HistoryError,
  HistorySkeleton,
} from './HistoryStates.js';
import './HistoryDrawer.css';

export interface HistoryDrawerProps {
  /** Whether the drawer is currently open. Controlled by the integrator. */
  isOpen: boolean;
  /**
   * Invoked when the user dismisses the drawer — via the close button, a
   * backdrop click, or the `Escape` key. The integrator flips its open state.
   */
  onClose: () => void;
  /**
   * Repo-relative path of the document whose history to show (e.g.
   * `guides/intro.md`). Empty string is treated as "no document selected".
   */
  path: string;
}

/** Selector for the focusable elements a Tab cycle should visit inside the drawer. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Format an ISO date into a short, locale-aware label; fall back to the raw value. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Short (7-char) display form of a full commit SHA. */
function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

/** A single commit row: message, then author · date · short hash. */
function CommitRow({ entry }: { entry: HistoryEntry }) {
  return (
    <li className="history__item" data-testid="history-item">
      <p className="history__message">{entry.message}</p>
      <p className="history__meta">
        <span className="history__author">{entry.author}</span>
        <span className="history__sep" aria-hidden="true">
          ·
        </span>
        <time className="history__date" dateTime={entry.date}>
          {formatDate(entry.date)}
        </time>
        <span className="history__sep" aria-hidden="true">
          ·
        </span>
        <code className="history__hash" title={entry.hash}>
          {shortHash(entry.hash)}
        </code>
      </p>
    </li>
  );
}

/**
 * The git history drawer. See {@link HistoryDrawerProps}. Renders the commit
 * list for `path` (fetched only while open) with full loading / empty / error
 * handling, and behaves as an accessible modal dialog.
 */
export function HistoryDrawer({ isOpen, onClose, path }: HistoryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // The element focused before the drawer opened, restored on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Only fetch history while the drawer is open (and a doc is selected); a
  // closed drawer performs no background request.
  const query = useHistory(isOpen ? path : '');
  const status = deriveAsyncStatus<HistoryResponse>(query, isHistoryEmpty);

  // Focus management (Design.md §8): on open, remember the trigger and move
  // focus into the panel; on close/unmount, restore focus to the trigger.
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Defer to let the panel mount/paint before we move focus into it.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();

    return () => {
      restoreFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Keyboard handling: Escape dismisses; Tab is trapped within the panel.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        // Nothing tabbable — keep focus on the panel itself.
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  let body: React.ReactNode;
  if (status.isLoading) {
    body = <HistorySkeleton />;
  } else if (status.isError) {
    body = (
      <HistoryError
        message={status.error?.message}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (status.isEmpty) {
    body = <HistoryEmpty />;
  } else {
    body = (
      <ul className="history__list" data-testid="history-list">
        {(query.data ?? []).map((entry) => (
          <CommitRow key={entry.hash} entry={entry} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <div
        className="history__backdrop"
        data-open={isOpen ? 'true' : 'false'}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="history"
        data-open={isOpen ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        aria-hidden={isOpen ? undefined : 'true'}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="history__header">
          <h2 className="history__title" id="history-title">
            History
          </h2>
          <button
            type="button"
            className="history__close"
            onClick={onClose}
            aria-label="Close history"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {path ? (
          <p className="history__path" title={path}>
            {path}
          </p>
        ) : null}
        <div className="history__body">{body}</div>
      </div>
    </>
  );
}

export default HistoryDrawer;
