# F1 — Monorepo Scaffold, Build, CI Skeleton

**Area:** foundation · **Milestone:** M0 · **Depends on:** — · **Blocks:** everything

## Scope
- One repo, two workspaces: `client/` (Vite + React + TS) and `server/` (Express + TS), plus a shared `packages/contracts/` stub (F2 fills it).
- Single production image target: server serves `client/dist` statically **and** the API (same origin in prod). Multi-stage Dockerfile stub.
- Tooling: TypeScript strict, ESLint + Prettier, `vitest` present (config in F8), npm workspaces (or pnpm).
- CI skeleton (GitHub Actions): install → typecheck → lint → `vitest run`. Playwright job stubbed (F8 fills).
- `.editorconfig`, root `README` dev instructions.

## Out of scope
- Any endpoint logic, UI, or pipeline (later cards).
- Real Dockerfile hardening (D1 completes it).

## Owns
- `package.json` (root + workspaces), `tsconfig*.json`, `.eslintrc*`, `.prettierrc`, `vite.config.ts`, `client/`, `server/` entrypoints (hello-world), `Dockerfile` (stub), `.github/workflows/ci.yml`.

## Acceptance
- `npm install && npm run build` produces `client/dist` and a runnable server that serves it.
- `npm run typecheck && npm run lint && npm run test` all pass green (empty suites OK).
- CI runs the above on push.

## Read first
- [ADR-0001](../../adrs/0001-architecture-overview.md) (single-image, stack) · [implementation-plan.md](../implementation-plan.md) M0.
