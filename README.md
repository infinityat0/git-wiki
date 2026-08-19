# git-wiki

A git-backed wiki system: it renders engineering documentation from a separate
"docs" git repository, with full-text search, git sync, and (later) inline
editing. See [`docs/adrs/0001-architecture-overview.md`](docs/adrs/0001-architecture-overview.md)
for the architecture and [`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md)
for the roadmap.

## Repository layout

This is an **npm workspaces** monorepo:

| Path                 | Package           | Purpose                                                       |
| -------------------- | ----------------- | ------------------------------------------------------------- |
| `client/`            | `client`          | Vite + React + TypeScript SPA (the wiki UI).                  |
| `server/`            | `server`          | Express + TypeScript API; also serves the built SPA in prod.  |
| `packages/contracts` | `@wiki/contracts` | Shared API contract types consumed by both client and server. |

In production a **single container image** runs the Express server, which
serves both the JSON API and the static `client/dist` build from the same
origin (ADR-0001).

## Prerequisites

- Node.js **>= 20**
- npm **>= 9** (ships with Node 20)

## Getting started

```bash
npm install        # installs all workspaces + builds @wiki/contracts
npm run dev        # client on http://localhost:5173, server on http://localhost:3000
```

In dev the Vite server proxies `/api/*` to the Express server, so the app is
reachable at http://localhost:5173.

## Production-style run

```bash
npm run build      # builds contracts -> client (client/dist) -> server (server/dist)
npm start          # runs the server; open http://localhost:3000
```

The server serves the built SPA and the API from the same origin, mirroring the
production single-image setup.

## Scripts (run from the repo root)

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Runs client (Vite) and server (tsx watch) together.    |
| `npm run build`     | Builds contracts, then client, then server.            |
| `npm start`         | Starts the built server (`server/dist/index.js`).      |
| `npm run typecheck` | Strict `tsc --noEmit` across every workspace.          |
| `npm run lint`      | ESLint over the whole repo.                            |
| `npm run format`    | Prettier check (`format:write` to apply).              |
| `npm test`          | `vitest run` (empty suites pass; harness lands in F8). |

## Docker

`Dockerfile` is a **stub** that captures the single-image shape only; task D1
hardens it. Build/run:

```bash
docker build -t git-wiki .
docker run -p 3000:3000 git-wiki
```

## Adding a shared type

Types shared between client and server live in `@wiki/contracts` and are
imported as `import { Foo } from '@wiki/contracts'`. The real payload types are
defined by task F2 — the package currently ships a placeholder only.

## CI

`.github/workflows/ci.yml` runs install → typecheck → lint → format → test →
build on every push and PR. A second, stubbed job reserves the Playwright E2E
slot that task F8 fills in.
