# U7 — Auth UI (SSO Redirect, User Chip, Dev Card, `canWrite` Gating)

**Area:** ui · **Milestone:** M3 · **Depends on:** F5, F6, B8 · **Parallel-safe with:** other `U*`

## Scope
- When `READ_ACCESS=AUTHENTICATED` and no session: show a brief "Redirecting to sign-in…" and send to `SSO_LOGIN` (Design.md §5). No provider buttons in the wiki.
- Signed-in: user chip (name/avatar from `useAuthMe`) + logout (uses `/api/auth/logout` `redirect`). **Edit affordances render only when `canWrite`.**
- **Dev only** (`AUTH_DEV_MODE`): the "Development sign-in" card (dashed border) in place of the redirect; inline errors (§10).

## Owns
- `client/src/components/Auth/**`.

## Acceptance
- Unauthed → redirect state; dev build → dev card; `canWrite:false` (Firebase) hides all edit controls; logout redirects to SSO. Dev card absent in a production build.

## Read first
- [ADR-0005](../../adrs/0005-auth-delegated-to-sso.md) · [features spec §5, §12](../../specs/wiki-features-specification.md) · [Design.md §5](../../designs/Design.md).
