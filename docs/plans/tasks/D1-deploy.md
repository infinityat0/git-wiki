# D1 — Kubernetes Deployment

**Area:** infra · **Milestone:** M4 · **Depends on:** all `B*` + `U*` merged (a runnable app) · **Not parallel-safe** — do last in v0

## Scope
- Finalize the multi-stage Dockerfile (non-root, includes `git`, serves `client/dist` + API).
- Manifests: Deployment (probes → `/api/health`, 1 replica / `Recreate`), Service, Ingress (TLS, `wiki.prod.tapestry.app`, shares `prod.tapestry.app` so the SSO cookie is readable), ConfigMap, Secret (git machine credential only), PVC for `REPO_CACHE_DIR`.
- Set `NODE_ENV=production` (dev auth hard-off). Rollout gates on readiness (index built).

## Owns
- `Dockerfile` (final), `deploy/k8s/**`.

## Acceptance
- Image builds and boots; probes pass once index ready; cookie readable across `sso`/`wiki` subdomains in a test cluster; no auth secrets in the image.

## Read first
- [deployment-kubernetes.md](../../specs/deployment-kubernetes.md) · [ADR-0001 decision 5](../../adrs/0001-architecture-overview.md) · [ADR-0005](../../adrs/0005-auth-delegated-to-sso.md).
