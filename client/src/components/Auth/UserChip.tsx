/*
 * U7 — the signed-in user chip (Design.md §5; features spec §5, §10; ADR-0005).
 *
 * Reads the verified session user from the F6 auth store (`useAuthUser`) and
 * renders an initials avatar + name plus a logout action. Logout POSTs
 * `/api/auth/logout` (apiClient.logout) and follows the returned `redirect`
 * (the SSO logout, which clears the shared cookie centrally). The integrator
 * mounts this in the U5 header when a session exists.
 *
 * `SessionUser` carries no avatar URL (contract: name/email/provider/canWrite),
 * so the avatar is a deterministic initials monogram.
 */

import { useState } from 'react';
import { apiClient } from '../../api/index.js';
import { useAuthStore, useAuthUser } from '../../stores/index.js';
import './Auth.css';

/** Up-to-two-letter monogram from a display name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function UserChip() {
  const user = useAuthUser();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defensive: the integrator mounts this only when authenticated, but never
  // render a chip without a user.
  if (!user) return null;

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const result = await apiClient.logout();
      // Clear the cached session immediately, then follow the SSO logout.
      useAuthStore.getState().clear();
      window.location.assign(result.redirect);
    } catch {
      setError('Sign-out failed. Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <div className="user-chip">
      <span
        className="user-chip__avatar"
        data-provider={user.provider}
        aria-hidden="true"
      >
        {initialsOf(user.name)}
      </span>
      <span className="user-chip__name" title={user.email}>
        {user.name}
      </span>
      <button
        className="user-chip__logout"
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
      {error && (
        <span className="user-chip__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default UserChip;
