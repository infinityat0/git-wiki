# Security & Safety Specification

The backend reads files by path, shells out to `git`, renders author-supplied HTML/iframes, and handles auth. Each is a distinct attack surface. This document is the single source of truth for the safety controls; it is referenced by [ADR-0001](../adrs/0001-architecture-overview.md) and [ADR-0002](../adrs/0002-markdown-rendering-pipeline.md).

## 1. Path traversal (filesystem reads/writes)

Every endpoint that accepts a `path` (`/api/doc`, `/api/history`, `/api/asset`, and v1 write endpoints) must:
1. Reject absolute paths and any segment equal to `..` before use.
2. Resolve the candidate against the docs root and assert containment:
   ```
   const root = fs.realpathSync(REPO_CACHE_DIR);
   const resolved = path.resolve(root, userPath);
   if (!resolved.startsWith(root + path.sep)) → 400 VALIDATION
   ```
3. Follow-symlink check: resolve the real path and re-assert containment so a symlink inside the repo can't escape the root.
4. Enforce an **extension allowlist** — `/api/doc` serves only `.md`/`.mdx`; `/api/asset` serves only an image/asset allowlist (`.png .jpg .jpeg .gif .svg .webp .pdf` …). `.git/` is always excluded.

## 2. Git argument & command injection

- Prefer a library API (`simple-git`) or `execFile('git', [args])` — **never** `exec` with an interpolated shell string, and never pass user input as an option-looking value.
- All git invocations run with a fixed `cwd` of `repo-cache/` and an explicit argument array.
- For `git log --follow <file>`, pass the file via `--` separator (`git log --follow -- <file>`) so a filename starting with `-` can't be read as a flag.
- The remote URL, branch, and poll interval come from config (§Configuration spec), not from request input.

## 3. Rendered-content safety (XSS, iframes, embeds)

Docs are authored in git but **rendered to every reader**, so treat rendered HTML as untrusted:
- Central `rehype-sanitize` allowlist is the only place raw HTML is permitted (see [ADR-0002](../adrs/0002-markdown-rendering-pipeline.md)).
- Strip `<script>`, inline event handlers, and `javascript:`/`data:` (except image `data:` if explicitly allowed) URLs.
- **Iframes**: allowed only with a forced `sandbox` (`allow-scripts allow-same-origin allow-popups`; no `allow-top-navigation`/`allow-forms` unless deliberately widened), `loading="lazy"`, and a **host allowlist** from `IFRAME_ALLOWED_HOSTS`. `srcdoc` is rejected. Non-allowlisted `src` renders a placeholder card, not a frame.
- A **Content-Security-Policy** response header backstops the sanitizer: restrict `default-src`, set `frame-src` to the same iframe host allowlist, `script-src 'self'`, and disallow inline event handlers. CSP and the sanitizer allowlist must be kept in sync.

## 4. Authentication & session safety

Authentication is delegated to the SSO app; the wiki verifies a **signed JWT** carried in a cookie ([ADR-0005](../adrs/0005-auth-delegated-to-sso.md)).

- Cookie set by SSO: `httpOnly`, `Secure`, `SameSite=Lax`, `Domain=prod.tapestry.app`.
- **JWT verification** (wiki): validate signature against SSO's JWKS (cached by `kid`), and enforce `exp`, `iss=https://sso.prod.tapestry.app`, and `aud=wiki.prod.tapestry.app`. Reject `alg: none` and any algorithm not on an explicit allowlist (asymmetric only). The wiki holds no signing key, so it can never mint prod sessions.
- **Trust the claims, but enforce server-side**: `provider`/`canWrite` come from the JWT; the wiki still enforces `canWrite` on every write endpoint and never lets the frontend assert capability.
- **Revocation** is bounded by TTL (stateless). Keep TTL short; add SSO introspection if instant revocation is needed.
- **Dev/test account guardrail**: `POST /api/auth/dev` returns `403` whenever `NODE_ENV=production`, independent of `AUTH_DEV_MODE`. Covered by an integration test that runs a production-config boot. The dev JWT is signed by a local key (`DEV_JWT_SIGNING_KEY`), never the prod path.
- **CSRF**: `SameSite=Lax` plus a CSRF token on state-changing endpoints (the shared parent-domain cookie is sent on cross-subdomain top-level navigation).

## 5. Secrets management

- No secret is baked into the container image. In Kubernetes, the **git machine credential** (`DOCS_GIT_APP_*` / deploy key) and any CSRF secret come from **Kubernetes Secrets** mounted as env vars (see [deployment-kubernetes.md](deployment-kubernetes.md)). The wiki no longer holds `GITHUB_CLIENT_SECRET` or Firebase admin creds — those live in the SSO app.
- The `DOCS_GIT_APP_*` credential grants write to the docs repo and is the most sensitive secret the wiki holds; scope the GitHub App to only that repo.
- `.env` files are git-ignored and used only for local dev; the dev/test password and `DEV_JWT_SIGNING_KEY` live there, never in the repo.

## 6. Denial-of-service / resource limits

- Cap `/api/doc` response size and reject pathologically large files with a friendly message.
- Debounce/limit `/api/search` and cap query length.
- Run git operations with timeouts; a hung `git pull` must not wedge the request pool (run sync in a worker/queue).

## 7. Security testing (regression)

Automated tests must cover: traversal payloads (`../`, encoded, symlink), git-arg injection (`-`-prefixed filenames), iframe host-allowlist bypass and `srcdoc` rejection, and the dev-auth production 403 guardrail.
