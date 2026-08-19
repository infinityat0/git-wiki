/*
 * Theme core — framework-agnostic, side-effect-free helpers.
 *
 * Kept separate from the React provider so the resolution / persistence /
 * DOM-application logic is unit-testable in isolation (jsdom) and can also run
 * synchronously before React mounts (no flash of the wrong theme — Design §4.3).
 */

export type Theme = 'light' | 'dark';

/** localStorage key holding the user's explicit choice ('light' | 'dark'). */
export const THEME_STORAGE_KEY = 'wiki-theme';

/** The class toggled on <html> to activate the dark palette (tokens.css). */
export const DARK_CLASS = 'dark';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The user's persisted choice, or null if they've never chosen (follow OS). */
export function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    // Private-mode / disabled storage: fall back to the system preference.
    return null;
  }
}

/** Persist an explicit choice. Swallows storage errors (private mode). */
export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* no-op */
  }
}

/** True when the OS prefers dark. Safe under SSR / jsdom (no matchMedia). */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Stored choice wins; otherwise follow the OS; default light. */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light');
}

/** Toggle the `.dark` class on <html> to match `theme`. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(DARK_CLASS, theme === 'dark');
}

/** The opposite theme — used by the toggle control. */
export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}
