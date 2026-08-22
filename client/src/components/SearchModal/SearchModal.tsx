/**
 * U4 — Search Modal (Design.md §4.2, features spec §6.2, §10, §13).
 *
 * A centered, glass-backdrop command palette opened with `⌘K`/`Ctrl+K` or `/`
 * (global keydown → the U4 `useSearchStore`), or by the header search trigger
 * which drives the same store. The integrator mounts a single `<SearchModal/>`
 * near the app root; it renders nothing until the store's `open` flag is set.
 *
 * Data comes entirely from F6: a debounced {@link useSearch} for results and
 * {@link useHealth} for the `searchIndex` readiness that powers the "index
 * warming up" hint. Selecting a result maps its repo path to an SPA route with
 * U3's {@link docPathToRoute} and navigates via react-router.
 *
 * Accessibility (features spec §13): the dialog traps Tab focus while open and
 * restores focus to the trigger on close; the result list is an ARIA listbox
 * driven by the arrow keys; Enter selects, Escape closes. All motion is gated
 * behind `prefers-reduced-motion` in the stylesheet.
 *
 * Owns only `client/src/components/SearchModal/**` — no store/route/app edits.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '@wiki/contracts';
import { useSearch, useHealth } from '../../hooks/index.js';
import { useSearchStore } from '../../stores/index.js';
import { docPathToRoute } from '../../routes/index.js';
import { renderSnippet } from './highlight.js';
import './SearchModal.css';

/** Debounce applied to the query before it hits the network (features spec §6.2). */
const DEBOUNCE_MS = 200;

/** Whether an event target is a field where `/` should type, not open search. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/** Focusable descendants of `root`, in DOM order, for the Tab focus trap. */
function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * The search modal. Mount once near the app root; it self-manages visibility
 * from the U4 store and installs the global open shortcut for its whole
 * lifetime.
 */
export function SearchModal(): ReactElement | null {
  const open = useSearchStore((s) => s.open);
  const openSearch = useSearchStore((s) => s.openSearch);
  const closeSearch = useSearchStore((s) => s.closeSearch);
  const toggleSearch = useSearchStore((s) => s.toggleSearch);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The element focused when the modal opened, restored to it on close (§13).
  const triggerRef = useRef<HTMLElement | null>(null);

  const health = useHealth();
  const warming = health.data?.searchIndex === 'building';

  const searchQuery = useSearch(debounced);
  const results: SearchResult[] = useMemo(
    () => searchQuery.data ?? [],
    [searchQuery.data],
  );
  const hasQuery = debounced.trim().length > 0;
  const isLoading = hasQuery && searchQuery.isLoading;
  const isError = hasQuery && searchQuery.isError;

  // Global open shortcut, live for the component's whole lifetime (§4.2).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleSearch();
        return;
      }
      if (e.key === '/' && !isEditableTarget(e.target)) {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch, toggleSearch]);

  // Reset transient state and manage focus across open/close transitions (§13).
  useEffect(() => {
    if (open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
      // Focus the input after the dialog paints.
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
    // On close, return focus to whatever opened the modal.
    triggerRef.current?.focus();
    return undefined;
  }, [open]);

  // Debounce the raw query into the value that actually drives `useSearch`.
  useEffect(() => {
    if (query === debounced) return undefined;
    const id = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query, debounced]);

  // Keep the active row in range whenever the result set changes.
  useEffect(() => {
    setActiveIndex((i) =>
      results.length === 0 ? 0 : Math.min(i, results.length - 1),
    );
  }, [results]);

  const select = useCallback(
    (result: SearchResult | undefined) => {
      if (!result) return;
      closeSearch();
      navigate(docPathToRoute(result.path));
    },
    [closeSearch, navigate],
  );

  const onDialogKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) =>
          results.length === 0 ? 0 : (i + 1) % results.length,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) =>
          results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        select(results[activeIndex]);
        return;
      }
      if (e.key === 'Tab') {
        // Focus trap: keep Tab / Shift+Tab inside the dialog (§4.2, §13).
        const root = dialogRef.current;
        if (!root) return;
        const items = focusable(root);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const current = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (current === first || !root.contains(current))) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (current === last || !root.contains(current))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [results, activeIndex, select, closeSearch],
  );

  if (!open) return null;

  const listboxId = 'search-modal-listbox';
  const activeOptionId =
    results.length > 0 ? `search-modal-option-${activeIndex}` : undefined;

  return (
    <div
      className="search-modal__backdrop"
      data-testid="search-modal-backdrop"
      onMouseDown={(e) => {
        // Only a click on the backdrop itself dismisses (not bubbled from panel).
        if (e.target === e.currentTarget) closeSearch();
      }}
    >
      <div
        ref={dialogRef}
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search documents"
        onKeyDown={onDialogKeyDown}
      >
        <div className="search-modal__field">
          <span className="search-modal__field-icon" aria-hidden="true">
            {/* Simple magnifier glyph; icon-only, so the input carries the label. */}
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
              <circle
                cx="9"
                cy="9"
                r="6"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="m14 14 3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            className="search-modal__input"
            placeholder="Search documents…"
            aria-label="Search documents"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="search-modal__esc" aria-hidden="true">
            Esc
          </kbd>
        </div>

        {warming ? (
          <div
            className="search-modal__notice"
            role="status"
            data-testid="search-modal-warming"
          >
            <span className="search-modal__spinner" aria-hidden="true" />
            Index warming up — results may be incomplete.
          </div>
        ) : null}

        <div className="search-modal__results">
          {isError ? (
            <div
              className="search-modal__notice search-modal__notice--error"
              role="alert"
              data-testid="search-modal-error"
            >
              Something went wrong. Try again.
            </div>
          ) : isLoading ? (
            <div
              className="search-modal__notice"
              role="status"
              data-testid="search-modal-loading"
            >
              <span className="search-modal__spinner" aria-hidden="true" />
              Searching…
            </div>
          ) : results.length > 0 ? (
            <ul
              id={listboxId}
              className="search-modal__list"
              role="listbox"
              aria-label="Search results"
            >
              {results.map((result, i) => (
                <li
                  key={result.path}
                  id={`search-modal-option-${i}`}
                  className={
                    i === activeIndex
                      ? 'search-modal__option search-modal__option--active'
                      : 'search-modal__option'
                  }
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseMove={() => setActiveIndex(i)}
                  onClick={() => select(result)}
                >
                  <span className="search-modal__option-title">
                    {result.title}
                  </span>
                  {result.matches.length > 0 ? (
                    <span className="search-modal__option-snippet">
                      {renderSnippet(result.matches[0])}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : hasQuery ? (
            <div
              className="search-modal__notice search-modal__notice--empty"
              role="status"
              data-testid="search-modal-empty"
            >
              No results for &ldquo;{debounced.trim()}&rdquo;
            </div>
          ) : (
            <div className="search-modal__hint" data-testid="search-modal-hint">
              Type to search the wiki.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
