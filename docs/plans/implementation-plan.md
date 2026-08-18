# Implementation Plan

Sequenced build plan tying together the ADRs and specs. Each milestone is independently shippable and testable.

## M0 — Scaffold & config
- Vite + React + TS frontend; Express + TS backend in one repo; single-image build ([ADR-0001](../adrs/0001-architecture-overview.md)).
- Config loader + startup validation and `.env.example` ([configuration.md](../specs/configuration.md)).
- `GET /api/health`; path-safety utility (traversal guard) landed first, since everything reads paths ([security-and-safety.md](../specs/security-and-safety.md) §1).
- Clone/attach `repo-cache/` on boot.

## M1 — Read experience (v0 core)
- `GET /api/tree` with frontmatter title/order/hidden ([features spec](../specs/wiki-features-specification.md) §7); `GET /api/doc`.
- Markdown pipeline ([ADR-0002](../adrs/0002-markdown-rendering-pipeline.md)): gfm, callouts, syntax highlighting, TOC/slugs — **plus sanitized iframe embeds, mermaid, KaTeX**.
- Layout per Design.md (header, left tree, content, right TOC); routing & deep links (§9); internal-link rewriting + `GET /api/asset` (§8).
- Loading/empty/error states (§10, Design §6). React Query + Zustand wiring ([ADR-0004](../adrs/0004-frontend-state-management.md)).

## M2 — Search & history & sync
- `GET /api/search` via MiniSearch, index built on boot + after sync ([ADR-0003](../adrs/0003-search-engine.md)); `⌘K` modal with focus trap.
- `GET /api/history` (`git log --follow -- <file>`, safely invoked).
- `POST /api/sync/pull` + background polling; sync status UI + failure toasts.

## M3 — Authentication (relying-party on SSO)
- JWT-cookie verification middleware: validate against SSO JWKS (`iss`/`aud`/`exp`, asymmetric alg allowlist); attach `req.user` + `canWrite` ([ADR-0005](../adrs/0005-auth-delegated-to-sso.md)).
- Redirect-to-SSO when unauthenticated; `GET /api/auth/me`; logout → SSO logout redirect.
- **Dev/test account** `POST /api/auth/dev` — mints a locally-signed dev JWT; production 403 guardrail + CI test ([security-and-safety.md](../specs/security-and-safety.md) §4).
- Enforce authorization policy server-side (§12): Firebase claims = read-only, GitHub claims = writable.
- GitHub OAuth flow and Firebase validation themselves are **out of scope for the wiki** (owned by the SSO app).

## M4 — Kubernetes deployment
- Dockerfile (multi-stage, non-root, includes git); manifests: Deployment/Service/Ingress/ConfigMap/Secret/PVC ([deployment-kubernetes.md](../specs/deployment-kubernetes.md)).
- Probes on `/api/health`; secrets from k8s Secrets; `NODE_ENV=production` (dev auth off).

## M5 — Editing (v1)
- Document CRUD; inline editor (write/preview) with dirty-state warnings.
- Commit flow; **concurrency/conflict handling** with rebase + Branch/PR fallback ([features spec](../specs/wiki-features-specification.md) §11); push/PR via GitHub API.

## Cross-cutting (every milestone)
- Tests per [features spec](../specs/wiki-features-specification.md) §14 (unit/integration/e2e/security regression).
- **Markdown rendering**: fixture corpus + manifest already exist under `test/fixtures/markdown/`; wire the Vitest (L1/L2) + Playwright (L3) harness and the coverage guard in **M1** per [testing-markdown-rendering.md](../specs/testing-markdown-rendering.md). Every element built in M1 lands with its fixture assertions + light/dark baseline.
- Accessibility (Design §8) and reduced-motion honored as components are built, not retrofitted.

## Open questions
- ~~Firebase's exact role vs GitHub SSO~~ **Resolved**: Firebase/Google = read-only access for non-engineers (no GitHub account); GitHub = editors. Capability derived from provider (`canWrite`). See [features spec §12](../specs/wiki-features-specification.md).
- Folder-group ordering convention (`_index.md` vs `.order`) — pick one during M1.
- Shiki vs react-syntax-highlighter for code blocks (bundle size vs theme fidelity).
