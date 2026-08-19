/*
 * Auth/session UI state (ADR-0004).
 *
 * Holds the verified session user so any component can read identity and the
 * derived `canWrite` capability without prop-drilling. The store is *hydrated*
 * from the server via `useAuthMe` → `useHydrateAuth` (see hooks); it is the
 * cached mirror, not the source of truth. The backend re-checks `canWrite` on
 * every write (features spec §12) — this flag only gates UI affordances.
 */

import { create } from 'zustand';
import type { AuthMe, SessionUser } from '@wiki/contracts';

interface AuthState {
  /** The verified session user, or `null` when unauthenticated / not yet loaded. */
  user: SessionUser | null;
  /** Whether a verified session exists. Mirrors `AuthMe.authenticated`. */
  authenticated: boolean;
  /** Replace state from a `GET /api/auth/me` payload. */
  setFromAuthMe: (authMe: AuthMe) => void;
  /** Clear the session (logout). */
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authenticated: false,
  setFromAuthMe: (authMe) =>
    set({
      authenticated: authMe.authenticated,
      user: authMe.authenticated && authMe.user ? authMe.user : null,
    }),
  clear: () => set({ user: null, authenticated: false }),
}));

/** The current session user, or `null`. */
export const useAuthUser = (): SessionUser | null => useAuthStore((s) => s.user);

/** Whether the current user may write (edit affordance gate; features spec §12). */
export const useCanWrite = (): boolean =>
  useAuthStore((s) => s.user?.canWrite ?? false);
