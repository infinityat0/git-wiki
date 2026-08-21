/*
 * U7 — the sign-in gate (Design.md §5, features spec §5, §10, §12; ADR-0005).
 *
 * Rendered by the integrator when read access requires a session and none is
 * present (`READ_ACCESS=AUTHENTICATED` + unauthenticated). Two mutually
 * exclusive modes:
 *
 *   - **Production** (default): the wiki is a pure relying party and renders
 *     *no* provider buttons. It shows a brief centered "Redirecting to sign-in…"
 *     state and sends the browser to the SSO login URL, appending the current
 *     location as `?redirect=` so the SSO app can bounce back. GitHub (engineers)
 *     vs Google/Firebase (everyone else) is chosen *there*, not here.
 *
 *   - **Local dev** (`VITE_AUTH_DEV_MODE === 'true'`, and never in a production
 *     build): the dashed-border "Development sign-in" card is shown *in place of*
 *     the redirect. It POSTs `{ username, password }` to `/api/auth/dev`
 *     (apiClient.devLogin) and, on success, hydrates the auth store so the
 *     integrator's gate unmounts. Errors render inline (features spec §10),
 *     never as raw alerts.
 *
 * This component consumes F6 (`../../api`, `../../stores`) read-only and owns
 * only presentation + wiring. It holds no capability decision of its own — the
 * server verifies every session and enforces `canWrite` on writes (§12).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../api/index.js';
import { useAuthStore } from '../../stores/index.js';
import './Auth.css';

/** Sensible default when `VITE_SSO_LOGIN_URL` is unset (ADR-0005 hosted apps). */
const DEFAULT_SSO_LOGIN_URL = 'https://sso.prod.tapestry.app/login';

/** The configured SSO login URL, or the hosted-prod default. */
function readSsoLoginUrl(): string {
  const raw = import.meta.env.VITE_SSO_LOGIN_URL;
  return typeof raw === 'string' && raw.length > 0
    ? raw
    : DEFAULT_SSO_LOGIN_URL;
}

/**
 * Whether the dev sign-in card should replace the redirect. Gated on the flag
 * **and** a non-production build — mirroring the server's hard refusal of dev
 * login in production (ADR-0005 §6 / features spec §5.3), so the card can never
 * appear in a production bundle regardless of the flag.
 */
function devModeEnabled(): boolean {
  return !import.meta.env.PROD && import.meta.env.VITE_AUTH_DEV_MODE === 'true';
}

/** Append the current location as `?redirect=` so the SSO app can bounce back. */
function buildSsoUrl(loginUrl: string): string {
  const here = typeof window !== 'undefined' ? window.location.href : '/';
  const sep = loginUrl.includes('?') ? '&' : '?';
  return `${loginUrl}${sep}redirect=${encodeURIComponent(here)}`;
}

/** Best-effort human message for a failed dev sign-in (features spec §10). */
function devErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Sign-in failed. Check your credentials and try again.';
}

export interface SignInGateProps {
  /**
   * Optional hook fired after a successful dev sign-in, once the auth store has
   * been hydrated. The store update alone flips the integrator's gate; this is
   * only for extra side effects (e.g. analytics) the integrator may want.
   */
  onSignedIn?: () => void;
}

/** The dashed "Development sign-in" card (local dev only). */
function DevSignInCard({ onSignedIn }: SignInGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.devLogin({ username, password });
      // Hydrate the store directly so the integrator's gate unmounts without a
      // full reload; the dev cookie is now set for subsequent requests.
      useAuthStore
        .getState()
        .setFromAuthMe({ authenticated: true, user: result.user });
      onSignedIn?.();
    } catch (err) {
      setError(devErrorMessage(err));
      // Re-enable only on failure; on success this card is about to unmount.
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-devcard" onSubmit={handleSubmit} noValidate>
      <div className="auth-devcard__badge">Development sign-in</div>
      <p className="auth-devcard__hint">
        Local development only — not shown in production.
      </p>

      <label className="auth-field">
        <span className="auth-field__label">Username</span>
        <input
          className="auth-field__input"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
        />
      </label>

      <label className="auth-field">
        <span className="auth-field__label">Password</span>
        <input
          className="auth-field__input"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </label>

      {error && (
        <p className="auth-devcard__error" role="alert">
          {error}
        </p>
      )}

      <button
        className="auth-devcard__submit"
        type="submit"
        disabled={submitting}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

/** The redirect state shown in production (no provider buttons; Design §5). */
function RedirectToSso() {
  const ssoUrl = buildSsoUrl(readSsoLoginUrl());

  useEffect(() => {
    // Brief "Redirecting…" state, then hand off to the SSO app.
    window.location.assign(ssoUrl);
  }, [ssoUrl]);

  return (
    <div className="auth-gate__card" role="status" aria-live="polite">
      <span className="auth-gate__spinner" aria-hidden="true" />
      <p className="auth-gate__redirect">Redirecting to sign-in…</p>
      {/* Fallback affordance if the automatic redirect is blocked. */}
      <a className="auth-gate__link" href={ssoUrl}>
        Continue to sign-in
      </a>
    </div>
  );
}

export function SignInGate({ onSignedIn }: SignInGateProps = {}) {
  return (
    <div className="auth-gate">
      {devModeEnabled() ? (
        <DevSignInCard onSignedIn={onSignedIn} />
      ) : (
        <RedirectToSso />
      )}
    </div>
  );
}

export default SignInGate;
