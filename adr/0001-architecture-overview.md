# ADR 0001: Architecture Overview for Git-Backed Wiki

## Status
Proposed (Updated with Authentication & Backend Selection)

## Context
We are building a web application to host and render engineering documentation from a separate git repository called `docs`.
We need to support:
- Reading and rendering markdown files dynamically.
- Running full-text search.
- Pulling updates from a remote git repository (v0).
- Inline editing, committing, and pushing updates back to the git repository (v1).
- **New Requirements**:
  - GitHub Login (OAuth) for user authentication.
  - JWT verification (specifically validating tokens issued by external systems like Firebase Auth).

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

3. **Authentication Implementation**:
   - **GitHub Login**: Standard OAuth flow. The frontend redirects to GitHub; the backend processes the code, fetches the access token, verifies the user, and sets a secure httpOnly cookie session.
   - **Firebase JWT Validation**: The backend exposes a middleware that fetches Google's public keys (JWKS) to verify Firebase ID tokens (JWTs) passed in the `Authorization: Bearer <token>` header, extracting the user profile (email, name, uid).

4. **Docs Directory**:
   - The docs repository is nested inside the workspace at `docs/` and is git-ignored by the outer repository.

---

## Comparison of Backend Options Considered

| Backend Tech | Development Speed | Auth & JWT Ecosystem | Multi-User / Git Scaling | System Dependencies | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js (Express/TS)** | **Very High** | **Excellent** (native Firebase Admin SDK & passport) | High (async I/O, simple-git) | Node.js runtime only | **Selected** (Best alignment with Vite/React ecosystem) |
| **Go** | Medium | Good (jwks-rsa, oauth2) | Very High (superb concurrency, single binary) | Go compiler | *Rejected* (Higher boilerplate for OAuth/Firebase, language context switch) |
| **Python (FastAPI)** | High | Excellent (PyJWT, Authlib) | Medium (blocking I/O details, GitPython) | Python + pip envs | *Rejected* (Context switch, extra environment management) |
| **Kotlin (Ktor/Spring)** | Medium | Excellent (Firebase Java SDK) | High | Java Virtual Machine | *Rejected* (Heavy memory footprint, slow startup, complex setup) |

## Consequences
- **Session Management**: The backend will issue a short-lived JSON Web Token (JWT) or session cookie to the frontend after verifying a GitHub OAuth login or Firebase token.
- **Security**: The backend must handle environment variables safely (e.g. `GITHUB_CLIENT_SECRET`, `FIREBASE_PROJECT_ID`). Cors policy must be configured correctly between the Vite dev server (`http://localhost:5173`) and Express backend (`http://localhost:3000`).
