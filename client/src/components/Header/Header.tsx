/*
 * U5 — the global header (Design.md §2.1, §4.1, §8; features spec §4.1, §10).
 *
 * The sticky, frosted top bar that fills the Shell's `header` slot. Three zones:
 *   - left   → logo / repo title, a `<Link to="/">` home affordance.
 *   - center → a search *trigger* (button styled like a search field) with a
 *              `⌘K` hint that opens the U4 search modal via `openSearch()`.
 *   - right  → sync status + "Sync Now" (F6 `useHealth`/`useSync`), the theme
 *              toggle (F5 `useTheme`), and a mobile menu button.
 *
 * This component *consumes* F5 (`@/theme`), F6 (`@/hooks`, `@/stores`) and
 * `react-router-dom` read-only; it owns only presentation + wiring. The sidebar
 * drawer is not owned here: the mobile menu button calls the controlled
 * `onMenuClick` prop, which the integrator wires to U1's drawer.
 *
 * States (features spec §10, "Sync" row): the Sync button becomes a spinner
 * labelled "Syncing…" while a pull is in flight (or while the background poller
 * reports `docsRepo: 'syncing'`), and a failed pull surfaces as a non-blocking,
 * dismissible toast anchored bottom-right — never a blocking dialog.
 *
 * Motion (Design.md §4.1, §4.3): the Sun/Moon swap uses a CSS rotate/scale
 * transition that collapses to near-instant under `prefers-reduced-motion`
 * (handled in Header.css); no JS motion here.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../theme/index.js';
import { useHealth, useSync } from '../../hooks/index.js';
import { useSearchStore } from '../../stores/index.js';
import {
  LogoMark,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  SyncIcon,
  HistoryIcon,
} from './icons.js';
import { UserChip } from '../Auth/index.js';
import './Header.css';

export interface HeaderProps {
  /**
   * Called when the mobile menu button is pressed. The integrator wires this to
   * U1's sidebar drawer (open/toggle). Optional so the header renders standalone;
   * when omitted the button is inert but still present + labelled.
   */
  onMenuClick?: () => void;
  /**
   * Called when the History button is pressed. The integrator wires this to the
   * git-history drawer (U6) for the current document. Omit to hide the button.
   */
  onHistoryClick?: () => void;
}

/** Best-effort human summary of a sync failure for the toast (features spec §10). */
function syncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Sync failed. Please try again.';
}

export function Header({ onMenuClick, onHistoryClick }: HeaderProps) {
  const { isDark, toggle } = useTheme();
  const openSearch = useSearchStore((s) => s.openSearch);
  const health = useHealth();
  const sync = useSync();

  // The toast is shown on a failed pull and dismissed either by the user or by
  // starting a new attempt. `sync.isError` latches until the next mutate().
  const [toastDismissed, setToastDismissed] = useState(false);
  useEffect(() => {
    if (sync.isPending) setToastDismissed(false);
  }, [sync.isPending]);

  // "Syncing" reflects an in-flight on-demand pull OR the background poller
  // (health.docsRepo === 'syncing'), so the indicator is honest either way.
  const isSyncing = sync.isPending || health.data?.docsRepo === 'syncing';
  const showToast = sync.isError && !toastDismissed;

  const handleSync = () => {
    if (isSyncing) return;
    setToastDismissed(false);
    sync.mutate();
  };

  const themeLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <div className="header">
      {/* Left: mobile menu + logo/repo title. */}
      <div className="header__left">
        <button
          type="button"
          className="header__icon-btn header__menu"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
        >
          <MenuIcon />
        </button>

        <Link to="/" className="header__logo" aria-label="git-wiki home">
          <LogoMark className="header__logo-mark" />
          <span className="header__logo-text">git-wiki</span>
        </Link>
      </div>

      {/* Center: search trigger (opens the U4 modal). */}
      <div className="header__center">
        <button
          type="button"
          className="header__search"
          aria-label="Search (Command K)"
          aria-keyshortcuts="Meta+K"
          onClick={() => openSearch()}
        >
          <SearchIcon className="header__search-icon" />
          <span className="header__search-label">Search</span>
          <kbd className="header__kbd">⌘K</kbd>
        </button>
      </div>

      {/* Right: sync status + Sync Now, theme toggle. */}
      <div className="header__right">
        <span
          className={
            'header__sync-status' +
            (isSyncing ? ' header__sync-status--syncing' : '')
          }
          data-status={isSyncing ? 'syncing' : (health.data?.docsRepo ?? '')}
        >
          <span className="header__sync-dot" aria-hidden="true" />
          <span className="header__sync-status-text">
            {isSyncing ? 'Syncing…' : 'Synced'}
          </span>
        </span>

        <button
          type="button"
          className="header__sync-btn"
          aria-label="Sync now"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <SyncIcon
            className={
              'header__sync-icon' +
              (isSyncing ? ' header__sync-icon--spinning' : '')
            }
          />
          <span className="header__sync-btn-text">
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </span>
        </button>

        {onHistoryClick ? (
          <button
            type="button"
            className="header__icon-btn header__history-btn"
            aria-label="Document history"
            onClick={onHistoryClick}
          >
            <HistoryIcon />
          </button>
        ) : null}

        <button
          type="button"
          className="header__icon-btn header__theme-toggle"
          aria-label={themeLabel}
          aria-pressed={isDark}
          onClick={() => toggle()}
        >
          <span className="header__theme-icons" aria-hidden="true">
            <SunIcon className="header__theme-icon header__theme-icon--sun" />
            <MoonIcon className="header__theme-icon header__theme-icon--moon" />
          </span>
        </button>

        <UserChip />
      </div>

      {showToast && (
        <div className="header__toast" role="alert">
          <span className="header__toast-text">
            {syncErrorMessage(sync.error)}
          </span>
          <button
            type="button"
            className="header__toast-close"
            aria-label="Dismiss sync error"
            onClick={() => setToastDismissed(true)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

export default Header;
