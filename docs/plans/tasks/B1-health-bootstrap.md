# B1 — `/api/health` + Repo-Cache Bootstrap + Git Credential Provider

**Area:** backend · **Milestone:** M0/M1 · **Depends on:** F1, F3 · **Parallel-safe with:** all other `B*`

## Scope
- On boot: if `REPO_CACHE_DIR` is empty, clone `DOCS_REPO_URL@DOCS_REPO_BRANCH`; else `git pull`. Use the **git credential provider** (below), never per-user creds.
- Git credential provider module: builds an authenticated git environment from `DOCS_GIT_APP_*` (GitHub App installation token) or a deploy key. Shared by B7 (sync) and v1 push. All git runs via `execFile('git', [...])` with `cwd=REPO_CACHE_DIR`.
- `GET /api/health` → `HealthResponse` (`status`, `searchIndex: ready|building`, `docsRepo: clean|syncing`). No auth. Used by k8s probes; report `building` until B6's index signals ready (expose a shared readiness flag).

## Owns
- `server/boot/repo-cache.ts`, `server/lib/git-credential.ts`, `server/routes/health.ts`.

## Acceptance
- Fresh dir → clone; existing dir → pull; both logged. Health returns `building` before index ready, `ok` after.
- No secret is logged.

## Read first
- [ADR-0005 "How git operations work"](../../adrs/0005-auth-delegated-to-sso.md) · [deployment-kubernetes.md](../../specs/deployment-kubernetes.md) · [features spec §6.0, §11](../../specs/wiki-features-specification.md).
