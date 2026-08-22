/*
 * Theme public API. Consumers (e.g. the U5 header theme toggle) import from
 * here: `import { ThemeProvider, useTheme } from '@/theme'` (or a relative path).
 */

export { ThemeProvider } from './ThemeProvider';
export { useTheme, type ThemeContextValue } from './theme-context';
export {
  type Theme,
  THEME_STORAGE_KEY,
  DARK_CLASS,
  resolveInitialTheme,
  applyTheme,
  toggleTheme,
} from './theme-core';
