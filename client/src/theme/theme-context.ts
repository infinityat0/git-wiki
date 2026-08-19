/*
 * Theme context + consumer hook.
 *
 * Split from ThemeProvider.tsx so the provider file only exports a component
 * (keeps react-refresh happy) and so consumers can import the hook without
 * pulling in the provider implementation.
 */

import { createContext, useContext } from 'react';
import type { Theme } from './theme-core';

export interface ThemeContextValue {
  /** The active theme. */
  theme: Theme;
  /** Convenience flag: `theme === 'dark'`. */
  isDark: boolean;
  /** Set (and persist) an explicit theme. */
  setTheme: (theme: Theme) => void;
  /** Flip between light and dark (and persist). */
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read the current theme + controls. Must be called under <ThemeProvider>.
 * The header theme toggle (U5) and any theme-aware surface consume this.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
