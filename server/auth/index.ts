/**
 * Auth layer barrel (B8). The integrator imports the middleware + guards from
 * here and the router from `../routes/auth.js`.
 */

export type { AuthConfig, AuthUser } from './types.js';
export {
  ASYMMETRIC_ALGS,
  claimsToUser,
  createSsoKeySet,
  readCookie,
  verifyDevToken,
  verifySsoToken,
  type VerifyKey,
} from './verify.js';
export {
  authMiddleware,
  createAuthMiddleware,
  createRequireRead,
  requireRead,
  requireWrite,
  type AuthMiddlewareOptions,
} from './middleware.js';
export { sendError } from './errors.js';
