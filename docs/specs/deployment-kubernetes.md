# Deployment: Kubernetes

Per [ADR-0001](../adrs/0001-architecture-overview.md) decision 5, the app ships as a single container serving both the built SPA and the JSON API. This document sketches the cluster shape; concrete manifests live with the deploy tooling.

## Container image

- Multi-stage build: stage 1 builds the Vite SPA; stage 2 is the Node runtime that serves `dist/` statically **and** the Express API. Same origin in prod → no CORS.
- Runs as a non-root user. No secrets baked in. Includes `git` in the runtime image (needed for sync/commit).
- Exposes `PORT` (default 3000) and a `GET /api/health` endpoint for probes.

## Cluster objects

| Object | Purpose |
| :--- | :--- |
| **Deployment** | Runs the app. `readinessProbe`/`livenessProbe` → `/api/health` (ready only when the search index is built and the docs clone is present). Start with 1 replica (see stateful note). |
| **Service** (ClusterIP) | Stable in-cluster address. |
| **Ingress** (TLS) | Public HTTPS endpoint for `wiki.prod.tapestry.app`; terminates TLS; routes to the Service. Shares the parent domain `prod.tapestry.app` with `sso.prod.tapestry.app` so the SSO session cookie (`Domain=prod.tapestry.app`) is readable here. |
| **ConfigMap** | Non-secret config: `DOCS_REPO_URL`, `DOCS_REPO_BRANCH`, `SYNC_POLL_INTERVAL`, `READ_ACCESS`, `IFRAME_ALLOWED_HOSTS`, `SSO_JWKS_URL`, `SSO_ISSUER`, `SSO_AUDIENCE`, `SESSION_COOKIE_NAME`, `SSO_LOGOUT_URL`. |
| **Secret** | The **git machine credential** (`DOCS_GIT_APP_ID`/`DOCS_GIT_APP_PRIVATE_KEY`/`DOCS_GIT_APP_INSTALLATION_ID` or a deploy key) and any CSRF secret. Mounted as env vars. **No** GitHub OAuth or Firebase secrets — those live in the SSO app ([ADR-0005](../adrs/0005-auth-delegated-to-sso.md)). |
| **PersistentVolumeClaim** | Backs `REPO_CACHE_DIR` (`repo-cache/`) so restarts don't force a full re-clone. |

## Stateful considerations (docs clone)

- The docs clone is local write state. With a single `ReadWriteOnce` PVC, run **1 replica** (or a `Recreate` strategy) to avoid two pods pulling/pushing the same working tree concurrently.
- To scale reads horizontally later: either (a) make the clone read-only per-pod and centralize writes via PR-mode (writes go to GitHub, not the local tree), or (b) move to a shared `ReadWriteMany` volume with a single writer. Documented as a future step, not v0.
- On startup: if `repo-cache/` is empty, clone `DOCS_REPO_URL`; otherwise `git pull`. Build the search index once the tree is present.

## Config & guardrails in-cluster

- `NODE_ENV=production` is set in the Deployment → dev auth is hard-disabled regardless of `AUTH_DEV_MODE` (security spec §4).
- Rollout: standard rolling update on new image tags; `/api/health` gates readiness so traffic only shifts once the new pod's index is ready.
- Backups: the source of truth is the upstream git remote, so the PVC is a cache, not a system of record — it can be rebuilt by re-cloning.
