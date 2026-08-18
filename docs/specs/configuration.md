# Configuration Specification

All runtime configuration is via environment variables. Local dev uses a git-ignored `.env`; production uses Kubernetes ConfigMaps (non-secret) and Secrets (secret). See [deployment-kubernetes.md](deployment-kubernetes.md).

## Environment variables

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | all | `development` | `production` in the cluster. Hard-disables dev auth. |
| `PORT` | all | `3000` | Backend HTTP port. |
| `READ_ACCESS` | all | `AUTHENTICATED` | `PUBLIC` or `AUTHENTICATED` — who may read docs (§12 of features spec). |
| **SSO session verification** (prod — [ADR-0005](../adrs/0005-auth-delegated-to-sso.md)) | | | |
| `SSO_JWKS_URL` | prod | `https://sso.prod.tapestry.app/.well-known/jwks.json` | Public keys used to verify the session JWT. Wiki holds **no** signing key. |
| `SSO_ISSUER` | prod | `https://sso.prod.tapestry.app` | Expected `iss` claim. |
| `SSO_AUDIENCE` | prod | `wiki.prod.tapestry.app` | Expected `aud` claim. |
| `SESSION_COOKIE_NAME` | all | `tapestry_session` | Name of the shared cookie set by SSO on `Domain=prod.tapestry.app`. |
| `SSO_LOGOUT_URL` | prod | `https://sso.prod.tapestry.app/logout` | Central logout target. |
| **Docs repo & git credential** | | | |
| `DOCS_REPO_URL` | all | — | Remote git URL cloned into `repo-cache/`. |
| `DOCS_REPO_BRANCH` | all | `main` | Branch to track. |
| `REPO_CACHE_DIR` | all | `./repo-cache` | Local path of the docs clone (a PVC mount in k8s). |
| `SYNC_POLL_INTERVAL` | all | `300` | Background pull interval, seconds (v0). `0` disables polling. |
| `DOCS_GIT_APP_ID` / `DOCS_GIT_APP_PRIVATE_KEY` / `DOCS_GIT_APP_INSTALLATION_ID` | **secret** | — | GitHub App used for **all** clone/pull/push against the docs repo (§11). Alternatively a deploy key. Not per-user. |
| `EDIT_ALLOWLIST` | all | — | Comma-separated usernames/emails permitted to write (v1). Empty = rely on PR-mode repo perms / SSO-supplied `roles`. |
| **Dev/test auth** (local only) | | | |
| `AUTH_DEV_MODE` | dev only | `false` | Enables `POST /api/auth/dev`. Ignored when `NODE_ENV=production`. |
| `DEV_AUTH_USERNAME` | dev only | — | Dev account username. |
| `DEV_AUTH_PASSWORD` | dev only | — | Dev account password (never committed). |
| `DEV_JWT_SIGNING_KEY` | dev only | — | Local key used to sign/verify the dev session JWT (replaces prod JWKS locally). |
| `DEV_AUTH_NAME` / `DEV_AUTH_EMAIL` | dev only | `dev` / `dev@localhost` | Git author identity for dev-mode commits. |
| **Rendering/embeds** | | | |
| `IFRAME_ALLOWED_HOSTS` | all | `youtube-nocookie.com,youtube.com,codesandbox.io` | Host allowlist for iframe `src` and CSP `frame-src`. |

## Precedence & validation

- On startup the server validates required vars for the active `NODE_ENV` and **fails fast** with a clear message if a required value is missing (e.g. `SSO_JWKS_URL`/`SSO_ISSUER`/`SSO_AUDIENCE` and the `DOCS_GIT_APP_*` credential in production).
- In production, if `AUTH_DEV_MODE=true` is set, the server logs a warning and still refuses dev login (guardrail in the security spec §4).
- A committed `.env.example` documents every variable with placeholder values; real `.env` is git-ignored.
