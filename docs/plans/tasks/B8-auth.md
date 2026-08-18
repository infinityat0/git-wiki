# B8 — Auth Middleware (JWT/JWKS) + `/api/auth/{me,dev,logout}`

**Area:** backend · **Milestone:** M3 · **Depends on:** F2, F3 · **Parallel-safe with:** other `B*`

## Scope
- Middleware: read the SSO cookie (`SESSION_COOKIE_NAME`), verify the **signed JWT** against `SSO_JWKS_URL` (cache by `kid`), enforce `exp`/`iss`/`aud`, **reject `alg:none`** and any non-asymmetric alg. Attach `req.user` (`provider`, `canWrite`, …). Unauthenticated reads honor `READ_ACCESS`.
- `GET /api/auth/me` → `AuthMe` from claims (no upstream call).
- `POST /api/auth/dev` → verify `DEV_AUTH_*`, mint a **locally-signed** dev JWT (`provider:dev, canWrite:true`); **`403` when `NODE_ENV=production` or `AUTH_DEV_MODE!=true`**.
- `POST /api/auth/logout` → clear cookie view, return SSO logout `redirect`.
- `requireWrite` guard for v1 endpoints: `403 FORBIDDEN` unless `canWrite`.

## Owns
- `server/auth/**`, `server/routes/auth.ts`.

## Acceptance
- **Guardrail test (required):** production-config boot → `POST /api/auth/dev` returns `403` even with `AUTH_DEV_MODE=true`.
- `alg:none` and wrong `aud`/`iss`/expired tokens rejected. Firebase-provider claim → `canWrite:false` enforced on a sample write route.

## Read first
- [ADR-0005](../../adrs/0005-auth-delegated-to-sso.md) · [features spec §5, §12](../../specs/wiki-features-specification.md) · [security-and-safety.md §4](../../specs/security-and-safety.md).
