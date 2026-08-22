/*
 * ThemeProvider — owns theme state and keeps it in sync with <html> + storage.
 *
 * No-flash guarantee (Design.md §4.3): the `.dark` class is applied to <html>
 * inside the useState initializer, which runs during React's synchronous
 * initial mount — i.e. before the browser's first paint. The initial #root is
 * empty markup, so there is never a frame showing the wrong palette.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  readStoredTheme,
  resolveInitialTheme,
  storeTheme,
  systemPrefersDark,
  toggleTheme,
  type Theme,
} from './theme-core';
import { ThemeContext, type ThemeContextValue } from './theme-context';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = resolveInitialTheme();
    applyTheme(initial); // before first paint — no flash.
    return initial;
  });

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    storeTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next = toggleTheme(current);
      applyTheme(next);
      storeTheme(next);
      return next;
    });
  }, []);

  // Follow OS changes only while the user hasn't made an explicit choice.
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readStoredTheme() !== null) return; // explicit choice wins
      const next: Theme = systemPrefersDark() ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
