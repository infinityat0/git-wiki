// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DARK_CLASS,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveInitialTheme,
  storeTheme,
  systemPrefersDark,
  toggleTheme,
} from './theme-core';

function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: prefersDark && query.includes('dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

// jsdom's localStorage is non-functional under an opaque origin, so provide a
// deterministic in-memory Storage for these tests.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  document.documentElement.classList.remove(DARK_CLASS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage', () => {
  it('round-trips a stored theme', () => {
    storeTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readStoredTheme()).toBeNull();
  });
});

describe('applyTheme', () => {
  it('adds .dark for dark and removes it for light', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
  });
});

describe('toggleTheme', () => {
  it('flips the theme', () => {
    expect(toggleTheme('light')).toBe('dark');
    expect(toggleTheme('dark')).toBe('light');
  });
});

describe('systemPrefersDark', () => {
  it('reflects the media query result', () => {
    stubMatchMedia(true);
    expect(systemPrefersDark()).toBe(true);
    stubMatchMedia(false);
    expect(systemPrefersDark()).toBe(false);
  });
});

describe('resolveInitialTheme', () => {
  it('prefers an explicit stored choice over the OS', () => {
    stubMatchMedia(true); // OS wants dark…
    storeTheme('light'); // …but the user chose light.
    expect(resolveInitialTheme()).toBe('light');
  });

  it('falls back to the OS preference when unset', () => {
    stubMatchMedia(true);
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('defaults to light with no choice and no OS preference', () => {
    stubMatchMedia(false);
    expect(resolveInitialTheme()).toBe('light');
  });
});
