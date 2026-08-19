/**
 * Authentication & session contract.
 *
 * The wiki is a pure relying party: it verifies an SSO-issued JWT cookie and
 * reflects its claims (ADR-0005). `provider` + `canWrite` drive authorization
 * (features spec §12); the frontend uses `canWrite` to show/hide edit
 * affordances and the backend enforces it independently on every write.
 */

/**
 * Identity provider that established the session.
 * - `github`   → engineers, read + write (v1).
 * - `firebase` → Google sign-in, read-only.
 * - `dev`      → local development only, treated as read + write.
 */
export type AuthProvider = 'github' | 'firebase' | 'dev';

/**
 * The subset of verified JWT claims the UI consumes (features spec §6.1).
 * Mirrors the `GET /api/auth/me` `user` object and the `POST /api/auth/dev`
 * response `user`.
 */
export interface SessionUser {
  name: string;
  email: string;
  provider: AuthProvider;
  /** Derived write capability (ADR-0005 / features spec §12). */
  canWrite: boolean;
}

/**
 * Response of `GET /api/auth/me` (features spec §6.1).
 *
 * Unauthenticated → `{ "authenticated": false }` (no `user`).
 * Authenticated   → `{ "authenticated": true, "user": { ... } }`.
 */
export interface AuthMe {
  authenticated: boolean;
  user?: SessionUser;
}

/**
 * Request body of `POST /api/auth/dev` (local development only, features
 * spec §6.1). Verified against `DEV_AUTH_USERNAME` / `DEV_AUTH_PASSWORD`.
 */
export interface DevLoginRequest {
  username: string;
  password: string;
}

/** Response of a successful `POST /api/auth/dev` (features spec §6.1). */
export interface DevLoginResponse {
  success: true;
  user: SessionUser;
}

/**
 * Response of `POST /api/auth/logout` (features spec §6.1). `redirect` points
 * at the SSO logout so the shared cookie is cleared centrally.
 */
export interface LogoutResponse {
  success: true;
  redirect: string;
}
