# ADR 0005: Authentication Delegated to an External SSO Service

## Status
Accepted — 2026-08-17. Supersedes the *auth-flow* mechanics in [ADR-0001](0001-architecture-overview.md) decision 3 (GitHub OAuth + Firebase now live in the SSO app, not the wiki). The **capability model is unchanged**: GitHub identity = read+write, Firebase/Google identity = read-only.

## Context
The wiki hosts all company documentation for a mixed audience (engineers with GitHub, non-engineers with Google/Firebase). Rather than each internal app re-implementing OAuth and Firebase validation, a dedicated **SSO login app** owns authentication and issues a session that relying-party apps consume.

Hosted apps (GCP):
- **SSO**: `https://sso.prod.tapestry.app`
- **Wiki**: `https://wiki.prod.tapestry.app`
- Shared parent domain: `prod.tapestry.app` — this is what makes cookie sharing possible.

## Decision

1. **The wiki is a pure relying party.** It performs *no* OAuth or Firebase flows. It only verifies a session cookie and reads claims.

2. **Session = signed JWT in a cookie.** After the user authenticates (GitHub or Google/Firebase), the SSO app sets a cookie:
   - `Domain=prod.tapestry.app`, `Path=/`, `httpOnly`, `Secure`, `SameSite=Lax`.
   - Value is a **signed JWT** (asymmetric, e.g. RS256/EdDSA). Short TTL (e.g. 15–60 min) + SSO-side refresh.

3. **The wiki verifies statelessly via JWKS.** The wiki fetches SSO's public keys from `https://sso.prod.tapestry.app/.well-known/jwks.json` (cached, keyed by `kid`) and verifies signature, `exp`, `iss=https://sso.prod.tapestry.app`, and `aud=wiki.prod.tapestry.app`. **The wiki holds no signing key** — it can verify but never mint prod tokens (least privilege).

4. **Claims the wiki relies on:**
   ```json
   {
     "sub": "user-id",
     "email": "user@tapestry.app",
     "name": "Ada Lovelace",
     "provider": "github" | "firebase" | "dev",
     "canWrite": true,
     "roles": ["editor"],
     "iss": "https://sso.prod.tapestry.app",
     "aud": "wiki.prod.tapestry.app",
     "exp": 0
   }
   ```
   `provider` + `canWrite` drive authorization (features spec §12). The wiki **trusts** these claims — the SSO app is the source of truth for who may edit.

5. **What the wiki keeps vs. hands off:**
   - **Handed to SSO**: GitHub OAuth flow, Firebase token validation, `GITHUB_CLIENT_SECRET`, Firebase admin creds.
   - **Kept in wiki**: cookie-verification middleware, `GET /api/auth/me` (reflects claims), logout = `302` to `https://sso.prod.tapestry.app/logout?redirect=…`, and the local dev path (below).

6. **Local development.** The SSO app is not required locally. `POST /api/auth/dev` mints a **locally-signed JWT** (a local dev keypair/secret) with `provider: "dev", canWrite: true`, verified by a dev verifier instead of the prod JWKS. Gated on `AUTH_DEV_MODE=true` **and** `NODE_ENV !== 'production'`; hard-refused in production regardless of flag.

## How git operations work (the JWT is identity-only)

**Critical distinction: the SSO JWT authenticates the *person to the wiki*; it is not a GitHub credential.** It carries no GitHub access token, so the wiki cannot act *as the user* against GitHub with it. Git network operations therefore use a **server-side machine credential**, independent of the cookie:

- **Docs remote access** = a **GitHub App installation token** (recommended) or a deploy key, scoped to the docs repo, stored as a Kubernetes Secret. This is what clones/pulls/pushes `repo-cache/`.
- **v0 pull** is not per-user at all: `repo-cache/` is one shared server-side working tree; the backend pulls with the machine credential. The cookie only gates whether a user may *see* sync status / trigger a manual sync.
- **v1 write** uses the JWT for two things only — **authorization** (`provider=github` + `canWrite`) and **attribution** (`git commit --author="<name> <email>"` from the claims). The actual `fetch`/`pull --rebase`/`push` (or PR creation via the GitHub API) run with the **machine credential**, not the user's identity.
- Result: commits are *authored* by the engineer (from claims) but *pushed* by the App. Branch-protection and human review still apply in PR mode (features spec §11).

**Alternative considered — per-user GitHub tokens:** the SSO app could vend the user's own GitHub OAuth token to the wiki (via token-exchange/introspection), so pushes use each engineer's real GitHub permissions and native attribution. Rejected as the default: it re-introduces sensitive per-user tokens into the wiki and couples it to SSO token-vending. Revisit if native per-user GitHub authorization/audit becomes a hard requirement.

## Consequences
- Wiki config drops `GITHUB_CLIENT_*`/Firebase creds and gains `SSO_JWKS_URL`, `SSO_ISSUER`, `SSO_AUDIENCE`, `SESSION_COOKIE_NAME`, plus the git machine credential (`DOCS_GIT_APP_*` / deploy key). See [configuration.md](../specs/configuration.md).
- **Revocation** is bounded by JWT TTL (stateless). Keep TTL short; add an SSO introspection call later if instant revocation is required.
- **JWKS availability**: cache keys aggressively; a brief SSO outage doesn't break already-issued sessions. Rotation handled via `kid`.
- **Authorization source of truth** (roles / `EDIT_ALLOWLIST`) shifts toward SSO; the wiki enforces `canWrite` on every write endpoint regardless (never trusts the frontend).
- **CSRF**: `SameSite=Lax` + a CSRF token on state-changing endpoints; the wiki API is same-origin to `wiki.prod.tapestry.app`.
