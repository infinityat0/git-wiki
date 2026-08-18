# ADR 0001: Architecture Overview for Git-Backed Wiki

## Status
Accepted — 2026-08-17. Supersedes the earlier "local single-user tool" framing: the app is a **hosted, multi-user service on Kubernetes** with GitHub SSO + Firebase in production and a local-only dev/test account.

## Context
We are building a web application to host and render engineering documentation from a separate git repository (the "docs repo").
We need to support:
- Reading and rendering markdown files dynamically.
- Running full-text search.
- Pulling updates from a remote git repository (v0).
- Inline editing, committing, and pushing updates back to the git repository (v1).
- **New Requirements**:
  - GitHub Login (OAuth) for user authentication (production).
  - JWT verification (specifically validating tokens issued by external systems like Firebase Auth) (production).
  - A **local dev/test account** (username + password) so the app can be exercised end-to-end without a live GitHub/Firebase setup. This path must be disabled in production.
  - The app is **deployed to Kubernetes** as a containerized service; local development runs the same server outside the cluster.

The development stack must be Vite + React (TypeScript) for the frontend. We must decide whether to stick with a lightweight Node.js/Express backend or transition to a Go, Python, or Kotlin backend.

## Decisions

1. **Backend Language & Framework**:
   - **Decision**: Node.js + Express (or Fastify) with TypeScript.
   - **Rationale**:
     - **Ease of Auth Integration**: Node.js has the most mature libraries for Firebase Auth integration (`firebase-admin` SDK) and GitHub OAuth (e.g., `passport` or direct standard fetch implementation).
     - **Unified Language**: Using TypeScript on both the Vite frontend and Express backend allows sharing interface definitions (e.g., API contracts, directory tree typings) and reduces developer cognitive load.
     - **Git Utility**: Libraries like `simple-git` or native `child_process` execution are highly stable and simple to configure in Node.js.
     - **Tooling Footprint**: Running frontend and backend under the Node ecosystem simplifies local dependencies (only `npm install` and Node.js are required).

2. **Frontend-Backend Split**:
   - **Frontend**: A client-side Single Page Application (SPA) built using **Vite + React (TypeScript)**.
   - **Backend**: A local/hosted Node.js helper server providing JSON endpoints. It handles filesystem reads, local search indexing, git operations, and acts as the OAuth callback receiver and JWT validator.

3. **Authentication Implementation** (three modes, one shared session layer):
   > **Superseded by [ADR-0005](0005-auth-delegated-to-sso.md)**: the OAuth/Firebase *flows* below now run in an external SSO app; the wiki verifies a signed-JWT cookie. The **capability model** (GitHub = write, Firebase/Google = read-only, dev = local write) is unchanged — it's now conveyed via JWT claims.
   - **GitHub Login (production)**: Standard OAuth flow. The frontend redirects to GitHub; the backend processes the code, fetches the access token, verifies the user, and sets a secure httpOnly cookie session. This identity is used to attribute git commits in v1.
   - **Firebase / Google JWT Validation (production, read-only)**: The wiki hosts **all company documentation** and must be reachable by non-engineers who have no GitHub account but do have a company Google account. Because the app runs on **GCP**, these users authenticate via **Firebase Authentication** (Google provider) and the backend validates the resulting ID token against Google's JWKS (checking `iss`/`aud` = `FIREBASE_PROJECT_ID`). Firebase sessions are **read-only** (`canWrite: false`); write access requires a GitHub identity. This is why both providers exist — they serve different audiences and capabilities, not the same one twice.
   - **Dev/Test Account (local only)**: A single username/password account, sourced from environment variables (`DEV_AUTH_USERNAME`, `DEV_AUTH_PASSWORD`), lets developers exercise the full authenticated experience without registering an OAuth app or Firebase project. It is gated behind `AUTH_DEV_MODE=true` **and** hard-refused whenever `NODE_ENV=production`, so it can never be reachable in the deployed cluster even if the flag is misconfigured. Credentials are never hardcoded or committed.
   - All three modes converge on the same server-issued httpOnly session cookie, so downstream code (git author attribution, authorization checks) is auth-mode agnostic.

4. **Docs Content Repository**:
   - The docs repository is cloned into `repo-cache/` in the working directory. It is git-ignored by the outer (application) repository so docs content and app code stay decoupled.
   - In Kubernetes, `repo-cache/` lives on a mounted volume (see decision 5) so a pod restart does not force a full re-clone.

5. **Deployment (Kubernetes)**:
   - **Decision**: The backend and the built frontend are packaged into a single container image; the Express server serves the static SPA build and the JSON API. The service is deployed to Kubernetes.
   - **Rationale**: A single image keeps CORS trivial (same origin in prod), simplifies session-cookie handling, and gives one artifact to roll out. The docs clone is the only stateful concern.
   - **Cluster shape**: Deployment + Service + Ingress (TLS) on `wiki.prod.tapestry.app`. The wiki's only sensitive secret is the **git machine credential** (`DOCS_GIT_APP_*` / deploy key) for the docs repo, from Kubernetes Secrets, not the image — auth secrets (GitHub OAuth, Firebase) live in the SSO app ([ADR-0005](0005-auth-delegated-to-sso.md)). `repo-cache/` is backed by a PersistentVolumeClaim. Liveness/readiness probes hit a `/api/health` endpoint. See [deployment-kubernetes spec](../specs/deployment-kubernetes.md).

---

## Comparison of Backend Options Considered

| Backend Tech | Development Speed | Auth & JWT Ecosystem | Multi-User / Git Scaling | System Dependencies | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js (Express/TS)** | **Very High** | **Excellent** (native Firebase Admin SDK & passport) | High (async I/O, simple-git) | Node.js runtime only | **Selected** (Best alignment with Vite/React ecosystem) |
| **Go** | Medium | Good (jwks-rsa, oauth2) | Very High (superb concurrency, single binary) | Go compiler | *Rejected* (Higher boilerplate for OAuth/Firebase, language context switch) |
| **Python (FastAPI)** | High | Excellent (PyJWT, Authlib) | Medium (blocking I/O details, GitPython) | Python + pip envs | *Rejected* (Context switch, extra environment management) |
| **Kotlin (Ktor/Spring)** | Medium | Excellent (Firebase Java SDK) | High | Java Virtual Machine | *Rejected* (Heavy memory footprint, slow startup, complex setup) |

## Consequences
- **Session Management**: The backend issues an httpOnly session cookie after verifying a GitHub OAuth login, a Firebase token, or dev credentials. All three modes share one session shape.
- **Security**: The backend verifies the SSO-issued JWT via JWKS (holds no signing key) and handles only the git machine credential via Kubernetes Secrets, never baking it into the image ([ADR-0005](0005-auth-delegated-to-sso.md)). In local dev, CORS must be configured between the Vite dev server (`http://localhost:5173`) and the Express backend (`http://localhost:3000`); in production the SPA is served same-origin so CORS is not a concern. Because the backend reads files by path and shells out to git, path-traversal and git-argument-injection are first-class risks — see [security-and-safety spec](../specs/security-and-safety.md).
- **Dev-auth guardrail**: The dev/test account is a deliberate, narrowly-scoped exception. CI should assert that a `NODE_ENV=production` build refuses dev login even with `AUTH_DEV_MODE=true`.
- **Related decisions**: markdown/embed rendering pipeline ([ADR-0002](0002-markdown-rendering-pipeline.md)), search engine ([ADR-0003](0003-search-engine.md)), frontend state ([ADR-0004](0004-frontend-state-management.md)).
