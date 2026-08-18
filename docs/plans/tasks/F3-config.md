# F3 — Config Loader + Env Validation + `.env.example`

**Area:** foundation · **Milestone:** M0 · **Depends on:** F1 · **Blocks:** `B*` (server)

## Scope
- A typed config module that reads every variable in [configuration.md](../../specs/configuration.md), applies defaults, and **fails fast** in production if a required value is missing (`SSO_JWKS_URL`/`SSO_ISSUER`/`SSO_AUDIENCE`, `DOCS_GIT_APP_*`).
- Enforce the dev-auth guardrail at config level: if `NODE_ENV==='production'`, `AUTH_DEV_MODE` is forced false and a warning logged.
- Commit `.env.example` documenting every var with placeholder values.

## Out of scope
- Consuming the config in endpoints (each `B*` does that).

## Owns
- `server/config/**`, `.env.example`.

## Acceptance
- Unit test: production config missing a required secret → process refuses to start with a clear message.
- Unit test: `NODE_ENV=production` + `AUTH_DEV_MODE=true` → config reports dev mode **off**.

## Read first
- [configuration.md](../../specs/configuration.md) · [security-and-safety.md §4–5](../../specs/security-and-safety.md).
