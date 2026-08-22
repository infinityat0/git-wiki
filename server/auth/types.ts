/**
 * Auth request-context types (B8).
 *
 * `AuthUser` is the verified-session view the middleware attaches to
 * `req.user`; it extends the wire-facing {@link SessionUser} (features spec
 * §6.1) with the extra verified claims the backend may consult (`sub`,
 * `roles`) but does not expose over the API.
 *
 * `AuthConfig` is the exact slice of the process {@link Config} the auth layer
 * reads — declared as a `Pick` so the middleware/router accept an injected
 * config in tests without depending on the full singleton.
 */

import type { SessionUser } from '@wiki/contracts';

import type { Config } from '../config/index.js';

/** Verified session identity attached to `req.user` after the middleware runs. */
export interface AuthUser extends SessionUser {
  /** JWT `sub` (stable user id), when present. */
  sub?: string;
  /** JWT `roles` claim, when present. Informational for v0. */
  roles?: string[];
}

/** The config surface the auth middleware and router depend on. */
export type AuthConfig = Pick<
  Config,
  'sso' | 'readAccess' | 'isProduction' | 'authDevMode' | 'devAuth'
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augmentation must use the `Express` namespace.
  namespace Express {
    interface Request {
      /** Verified session, populated by the auth middleware; absent when unauthenticated. */
      user?: AuthUser;
    }
  }
}
