# ADR 0001: Architecture Overview for Git-Backed Wiki

## Status
Proposed

## Context
We are building a web application to host and render engineering documentation from a separate git repository called `docs`.
The wiki system needs to support:
- Reading and rendering markdown files dynamically.
- Running full-text search.
- Pulling updates from a remote git repository (v0).
- Inline editing, committing, and pushing updates back to the git repository (v1).

The development stack must be Vite + React (TypeScript) for the frontend.

## Decisions

1. **Frontend-Backend Split**:
   - **Frontend**: A client-side Single Page Application (SPA) built using **Vite + React (TypeScript)**. It handles markdown rendering, UI layouts, navigation, and user interaction.
   - **Backend**: A lightweight local helper server built with **Node.js + Express**. It acts as a bridge between the browser and the system, providing endpoints to read/write filesystem markdown files and execute local `git` commands.

2. **Docs Directory**:
   - The docs repository is nested inside the workspace at `docs/`.
   - It is initialized as its own independent git repository.
   - It is ignored by the outer `git-wiki` repository using `.gitignore`.

3. **Git Integration**:
   - The backend runs standard shell commands via `child_process.exec` (e.g. `git pull`, `git log`, `git add`, `git commit`, `git push`) inside the `docs/` directory to fulfill git operations.

4. **Styling**:
   - We will use **Vanilla CSS** with CSS Custom Properties (variables) for all styles. No Tailwind CSS or CSS-in-JS libraries will be loaded, keeping the application lightweight and in line with core project requirements.

## Alternatives Considered

### Alternative A: Isomorphic Git in the Browser (Client-Only)
- **Description**: Run git commands entirely inside the browser using `isomorphic-git` and use the Web File System Access API to read/write local files.
- **Why Rejected**: 
  - `isomorphic-git` requires a CORS proxy for remote repository operations (pushing/pulling) when talking to GitHub/GitLab, introducing external dependencies and potential credentials leakage.
  - The File System Access API has limited browser support (Chrome/Edge only) and requires annoying user permission prompts on every page load/edit.
  - Background polling/syncing from a remote repo cannot easily run in a purely offline or static client-only app without a persistent daemon.

### Alternative B: Next.js Monolith
- **Description**: Build a unified Next.js application with api routes and server components.
- **Why Rejected**: The user specifically requested Vite + React (TypeScript) for the client application.

## Consequences
- **Security**: The Express backend runs locally. It must only listen to `localhost` to prevent unauthorized remote code execution or file reads.
- **Performance**: Very high. Reading files from local disk and serving them over local JSON endpoints is near-instantaneous.
- **Portability**: The project setup remains highly modular. The docs repository can easily be swapped or mounted at another location.
- **System Requirements**: Requires Node.js and a git CLI installation on the host system to run.
