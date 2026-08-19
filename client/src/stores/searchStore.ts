/*
 * Search modal UI state (ADR-0004). The ⌘K search modal (U4) reads `open` and
 * drives it via these actions; kept as a tiny dedicated slice so opening search
 * never re-renders unrelated consumers.
 */

import { create } from 'zustand';

interface SearchState {
  /** Whether the search modal is open. */
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  open: false,
  openSearch: () => set({ open: true }),
  closeSearch: () => set({ open: false }),
  toggleSearch: () => set((s) => ({ open: !s.open })),
}));
