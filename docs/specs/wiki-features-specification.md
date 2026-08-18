# Wiki Features Specification (v0 & v1)

This specification defines the functional, technical, and visual requirements for the Git-backed wiki system.

---

## 1. Overview & Architecture

The system consists of:
1. **Frontend**: Vite + React + TypeScript + Vanilla CSS. It provides a clean, fast, single-page application (SPA) reading experience.
2. **Backend**: Node.js + Express. It serves the built SPA and a JSON API, reads/writes markdown files, and executes Git commands. It runs locally during development and as a **container on Kubernetes** in production (single image serving both the SPA and API — same origin in prod). See [ADR-0001](../adrs/0001-architecture-overview.md) and [deployment-kubernetes.md](deployment-kubernetes.md).
3. **Docs Repository**: A separate git repository cloned into **`repo-cache/`** in the working directory (git-ignored by the app repo). In Kubernetes it is backed by a PersistentVolumeClaim so restarts don't force a re-clone.

> **Deployment model (resolves the earlier local-vs-hosted ambiguity):** this is a **hosted, multi-user service**. Authentication and authorization therefore matter in production; a local dev/test account exists only for development (§5).

---

## 2. Visual Design & Theme Guidelines (Inspired by Mintlify & VitePress)

To emulate the clean, premium documentation aesthetics of [VitePress](https://vitepress.dev/) and [Mintlify](https://mintlify.com/docs):

### 2.1 Design Language
- **Typography**: 
  - Sans-Serif: `Inter`, `system-ui`, `-apple-system`, `BlinkMacSystemFont` for reading text and UI elements.
  - Monospace: `JetBrains Mono`, `Fira Code`, `SFMono-Regular` for inline code and code blocks.
- **Colors (HSL Tailored CSS Variables)**:
  - **Light Theme**:
    - Primary Accent (Mint Green): `hsl(146, 67%, 26%)` (similar to `#166E3F`)
    - Primary Light: `hsl(148, 67%, 44%)` (similar to `#26BD6C`)
    - Background: `hsl(0, 0%, 100%)`
    - Text: `hsl(215, 25%, 27%)` (slate gray)
    - Border/Muted: `hsl(210, 16%, 93%)`
  - **Dark Theme**:
    - Primary Accent: `hsl(148, 67%, 44%)`
    - Background: `hsl(180, 13%, 5%)` (charcoal black `#0a0d0d`)
    - Text: `hsl(215, 15%, 75%)` (light slate)
    - Border/Muted: `hsl(180, 8%, 14%)`

### 2.2 Layout Structure
- **Global Sticky Header**:
  - Left: Logo / Repository Title.
  - Middle: Search bar (with keyboard shortcut `⌘K` or `/`).
  - Right: Manual Sync status/button & Theme toggle (Sun/Moon icon).
- **Navigation Sidebar (Left)**:
  - Scrollable navigation showing a structured folder/file tree of markdown documents.
  - Caps-locked group headers for directories.
  - Sleek hover indicators (rounded hover boxes, color shift) and text-shadow weight on active links.
- **Content Area (Center)**:
  - Max reading width of `768px` (`48rem`) to optimize readability.
  - Proper letter spacing, line height (`1.7`), and margin scales.
- **Table of Contents Sidebar (Right)**:
  - Hidden on mobile, sticky on desktop (`min-width: 1024px`).
  - List of headings (`H2` and `H3`) in the current page, highlighting the active section based on scroll position.

---

## 3. Markdown Element Specs

The wiki must render the following markdown elements using pure, clean CSS selectors:

| Markdown Element | Render Description | Visual Guide |
| :--- | :--- | :--- |
| **Headings (H1-H6)** | Large, bold fonts. `H1` and `H2` have subtle bottom borders. Anchor icon appears on hover for linking. | Inter-bold, letter-spacing -0.02em |
| **Paragraphs** | Comfortable padding, readable line-height (1.75), margins. | Slate color text |
| **Bold & Italic** | High-contrast font weights. | Font-weight 600 or 700 |
| **Unordered Lists** | Indented lines, modern bullets, padded block spacing. | Custom rounded bullets |
| **Ordered Lists** | Auto-incrementing numbers with customized colored styling. | Custom numbers |
| **Inline Code** | Monospace, light-gray or dark-charcoal background block with padding and border-radius. | Rounded `0.25rem` |
| **Code Blocks** | Syntax-highlighted code with language tag, rounded frame, custom scrollbars, and "Copy" button. | JetBrains Mono font, dark background |
| **Tables** | Alternating row shading (zebra), top/bottom borders, column alignment padding. | Muted borders, padded cells |
| **Blockquotes** | Indented block with a vertical left border using the primary brand color. | Italicized text, 4px green left border |
| **Images** | Centered, max-width 100%, rounded corners, captions in small italic text. | 8px border-radius, drop-shadow |
| **Alerts / Callouts** | Indented box with custom left-border, background color, title, and descriptive icon. | Green (Tip), Blue (Note), Orange (Warning), Red (Danger) |
| **Embedded iframes** | Raw `<iframe>` in markdown renders as a responsive 16:9 framed embed with a rounded border. **Sandboxed and host-allowlisted** — non-allowlisted sources show a placeholder card with the link instead of a live frame. | Lazy-loaded, `sandbox` forced (see [ADR-0002](../adrs/0002-markdown-rendering-pipeline.md) & security spec) |
| **Diagrams (Mermaid)** | ` ```mermaid ` fenced blocks render to inline SVG (flowcharts, sequence, etc.), themed to match light/dark. | Lazy-loaded mermaid; centered, max-width 100% |
| **Math (KaTeX)** | Inline `$…$` and block `$$…$$` render via KaTeX (CSS-only, no runtime script). | Scrollable if wide |

### 3.1 Alert/Callout Markdown Syntax
Alert blocks will be processed using standard GitHub/Mintlify syntax:
```markdown
> [!NOTE]
> This is a note alert with a blue background and info icon.

> [!TIP]
> This is a tip alert with a green background and check/tip icon.

> [!WARNING]
> This is a warning alert with an orange background and alert triangle icon.

> [!CAUTION]
> This is a danger/caution alert with a red background and stop icon.
```

---

## 4. Phase-Specific Roadmap

### 4.1 v0 Features (Read-only + Synchronization)
1. **Repository Parsing**: Backend parses the nested `docs/` folder, mapping out the directory tree.
2. **File Tree Sidebar**: Renders files and folders dynamically based on the parsed directory tree, labeled by **document title** (not filename — see §7). Clicking a file loads its content.
3. **Rich Markdown Renderer**: Renders markdown files with correct headers, syntax highlighting, custom lists, callout alerts, **sandboxed iframe embeds, Mermaid diagrams, and KaTeX math** (see [ADR-0002](../adrs/0002-markdown-rendering-pipeline.md)).
4. **Table of Contents (TOC)**: Renders heading lists dynamically for the active document.
   4a. **Internal link & asset resolution**: Relative `.md` links between docs are rewritten to SPA routes (§9); relative image/asset paths resolve through a backend asset endpoint (§8) so images embedded in markdown render correctly.
   4b. **Frontmatter & ordering**: Sidebar labels and order derive from optional YAML frontmatter (`title`, `order`), falling back to the first `H1` / filename and alphabetical order (§7).
5. **Full-text Search**:
   - Backend indexer processes all `.md` files in `docs/`.
   - Frontend displays search results in a modal with keyword highlighting.
6. **Git History Log**:
   - A drawer/panel showing the git commit history for the current document (timestamp, author, commit message) by running `git log --follow <filename>`.
7. **Sync Engine (Pulling)**:
   - UI displays current git sync status.
   - On-demand pull: A "Sync Now" button triggers git pull on the main branch.
   - Background polling: Backend polls the remote every 5 minutes (configurable) to check for updates and pull them if detected.

### 4.2 v1 Features (Write/Editing + Push/PR)
1. **Document Management**: UI triggers to create files/folders, rename files/folders, or delete files/folders.
2. **Inline Markdown Editor**:
   - Split pane or tabbed view (Write / Preview).
   - Auto-saving to local filesystem.
3. **Commit Flow**:
   - Prompt user to input a commit message when changes are saved.
   - Run `git add <file> && git commit -m "<message>"` via backend.
4. **Sync Engine (Pushing)**:
   - Automatically or manually push commits upstream (`git push`).
   - (Optional) Branch creation and pull request submissions for collaborative setups.

---

## 5. Authentication & Session Management

**Authentication is delegated to an external SSO app** ([ADR-0005](../adrs/0005-auth-delegated-to-sso.md)). The wiki is a pure relying party: it does not run OAuth or Firebase flows itself. The GitHub-vs-Google distinction (and therefore read-only vs read+write) is decided by the SSO app and conveyed to the wiki as **claims in a signed JWT cookie**.

- **Hosted apps**: SSO at `https://sso.prod.tapestry.app`, wiki at `https://wiki.prod.tapestry.app`, shared parent domain `prod.tapestry.app`.

1. **Sign-in (production)**:
   - The user hits the wiki; if there's no valid session cookie, the wiki redirects to `https://sso.prod.tapestry.app/login?redirect=https://wiki.prod.tapestry.app/...`.
   - The SSO app authenticates the user via **GitHub** (engineers) or **Google/Firebase** (everyone else) and sets a cookie on `Domain=prod.tapestry.app`.
   - The cookie value is a **signed JWT** (asymmetric signature, short TTL). The wiki reads it on subsequent requests.

2. **Session verification (wiki side)**:
   - Middleware verifies the JWT against SSO's **JWKS** (`https://sso.prod.tapestry.app/.well-known/jwks.json`, cached by `kid`), checking signature, `exp`, `iss`, and `aud=wiki.prod.tapestry.app`. The wiki holds no signing key.
   - Verified claims (`sub`, `email`, `name`, `provider`, `canWrite`, `roles`) are attached to `req.user`. `provider` ∈ `github | firebase | dev` drives capability (§12): `firebase` ⇒ read-only, `github` ⇒ read+write.

3. **Dev/Test Account (local development only)**:
   - The SSO app is not needed locally. `POST /api/auth/dev` verifies `DEV_AUTH_USERNAME`/`DEV_AUTH_PASSWORD` and mints a **locally-signed JWT** with `provider: "dev", canWrite: true`, verified by a local dev key instead of the prod JWKS.
   - **Gated**: available only when `AUTH_DEV_MODE=true` **and** `NODE_ENV !== 'production'`. The server **hard-refuses** dev login when `NODE_ENV=production` regardless of the flag. CI asserts this.
   - Attribution for v1 commits uses `DEV_AUTH_NAME`/`DEV_AUTH_EMAIL`.

> **The JWT authenticates the person to the wiki — it is not a GitHub credential.** Git network operations (clone/pull/push) use a separate server-side machine credential, not anything from the cookie. See §11 and [ADR-0005](../adrs/0005-auth-delegated-to-sso.md).

---

## 6. API Contracts (Backend Node/Express)

All endpoints return JSON responses.

### 6.0 Conventions

- **Errors**: non-2xx responses use a consistent shape `{ "error": { "code": "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "SYNC_FAILED" | "VALIDATION" | "INTERNAL", "message": "<human readable>" } }`. Clients map `code` to the error UI states in §10.
- **Auth**: read endpoints are readable per the authorization policy (§12); write endpoints (v1) require an authenticated session.
- **Path params**: every `path` query/body parameter is validated to stay inside `repo-cache/` (see security spec) — traversal attempts return `400 VALIDATION`.

#### GET `/api/health`
Liveness/readiness probe for Kubernetes. Returns `{ "status": "ok", "searchIndex": "ready" | "building", "docsRepo": "clean" | "syncing" }`. Never requires auth.

### 6.1 Authentication Endpoints

> GitHub OAuth and Firebase/Google login are **owned by the SSO app** (`sso.prod.tapestry.app`), not the wiki. The wiki only verifies the JWT cookie and exposes the endpoints below. See [ADR-0005](../adrs/0005-auth-delegated-to-sso.md).

#### GET `/api/auth/me`
Reflects the claims of the current verified JWT session (no upstream call).
- **Response** (unauthenticated → `{ "authenticated": false }`):
  ```json
  {
    "authenticated": true,
    "user": {
      "name": "Ada Lovelace",
      "email": "user@tapestry.app",
      "provider": "github",
      "canWrite": true
    }
  }
  ```

#### POST `/api/auth/logout`
Clears the local view of the session and returns a redirect target to the SSO logout so the shared cookie is cleared centrally.
- **Response**:
  ```json
  { "success": true, "redirect": "https://sso.prod.tapestry.app/logout?redirect=https://wiki.prod.tapestry.app/" }
  ```

#### POST `/api/auth/dev`
**Local development only.** Verifies the dev/test username/password and mints a locally-signed dev JWT session. Returns `403 FORBIDDEN` when `NODE_ENV=production` or `AUTH_DEV_MODE` is not `true`.
- **Request Body**:
  ```json
  {
    "username": "<DEV_AUTH_USERNAME>",
    "password": "<DEV_AUTH_PASSWORD>"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "user": { "name": "dev", "email": "dev@localhost", "provider": "dev", "canWrite": true }
  }
  ```

### 6.2 Documentation Endpoints

#### GET `/api/tree`
Returns the hierarchical tree structure of the markdown files inside the `repo-cache/` docs repository. Each node includes a **`title`** — the human-readable label the sidebar renders (frontmatter `title` → first `H1` → prettified filename). `name` (the raw filename) is included only for reference/tie-break sorting; **the sidebar renders `title`, never `name`** (§7).
- **Response**:
  ```json
  [
    {
      "name": "README.md",
      "path": "README.md",
      "title": "Overview",
      "type": "file"
    },
    {
      "name": "adr",
      "path": "adr",
      "title": "Architecture Decisions",
      "type": "directory",
      "order": 10,
      "children": [
        {
          "name": "0001-architecture-overview.md",
          "path": "adr/0001-architecture-overview.md",
          "title": "Architecture Overview",
          "order": 1,
          "type": "file"
        }
      ]
    }
  ]
  ```

#### GET `/api/doc?path=<relative_path>`
Fetches the raw content and metadata of a specific markdown document.
- **Response**:
  ```json
  {
    "path": "adr/0001-architecture-overview.md",
    "content": "# Architecture Overview\n...",
    "lastModified": "2026-08-18T05:22:15Z"
  }
  ```

#### GET `/api/history?path=<relative_path>`
Fetches the Git commit log for a given file.
- **Response**:
  ```json
  [
    {
      "hash": "568d7c2a71bf62bf62c129bd95eeec0216508933",
      "author": "Sunny",
      "date": "2026-08-17T22:32:31-07:00",
      "message": "Initial docs commit"
    }
  ]
  ```

#### GET `/api/search?q=<query>`
Performs a full-text search across all markdown files.
- **Response**:
  ```json
  [
    {
      "path": "adr/0001-architecture-overview.md",
      "title": "Architecture Overview",
      "matches": ["...split into a **Vite** frontend and **Express** backend..."]
    }
  ]
  ```

#### GET `/api/asset?path=<relative_path>`
Serves a non-markdown asset (image, etc.) referenced by a document, streamed from `repo-cache/`. Path is validated against traversal; content-type is inferred; only an allowlist of asset extensions is served. Used to resolve relative image paths embedded in markdown (§8).

#### POST `/api/sync/pull`
Triggers an immediate git pull in the `repo-cache/` docs repository.
- **Response**:
  ```json
  {
    "success": true,
    "changesPulled": true,
    "log": "Already up to date."
  }
  ```
- **On failure** (e.g. network error, or local uncommitted edits in v1 blocking the pull): `409 CONFLICT` or `502 SYNC_FAILED` with the error shape from §6.0.

---

## 7. Frontmatter, Sidebar Ordering & Titles

- Each markdown file may begin with optional YAML frontmatter:
  ```yaml
  ---
  title: Getting Started      # overrides sidebar label & search title
  order: 10                   # lower sorts first within its folder
  hidden: false               # if true, excluded from tree & search
  ---
  ```
- **Label resolution (sidebar & tabs)**: the displayed label is always the resolved **title**, never the raw filename — resolve `frontmatter.title` → first `H1` in the doc → a prettified filename (strip extension, replace `-`/`_` with spaces, title-case; e.g. `0001-architecture-overview.md` → "Architecture Overview" only as a last-resort fallback). The `.md` extension and ordering prefixes are never shown.
- **Ordering**: within a folder, files/folders sort by `order` (ascending), then alphabetically for ties/absentees. Folders may carry an `_index.md` or `.order` convention (implementation choice) for group ordering; document whichever is chosen.
- `hidden: true` removes a doc from the tree and the search index but it remains directly linkable.

## 8. Internal Links & Static Assets

- **Doc-to-doc links**: relative markdown links ending in `.md` (e.g. `../adr/0001-...md`) are rewritten during render to SPA routes (§9) and handled by the client router (no full page reload). Anchors (`#section`) are preserved.
- **Broken internal links**: a link whose target doesn't exist in the tree renders with a subtle "broken link" affordance rather than 404-ing the page.
- **Images & assets**: relative asset paths in markdown resolve to `GET /api/asset?path=…`. Absolute `http(s)` image URLs are passed through (subject to the same CSP/embed policy as iframes).

## 9. Frontend Routing & Deep Links

- The SPA uses client-side routing where the URL path mirrors the doc path, e.g. `/adr/0001-architecture-overview` ↔ `repo-cache/adr/0001-architecture-overview.md`.
- Every document is deep-linkable; heading anchors (`#slug`, from `rehype-slug`) are deep-linkable and drive TOC scroll-spy.
- Search results (§6.2) map their `path` to a route so selecting a result navigates there.
- Unknown routes render an in-app 404 doc view (§10), not a blank page.

## 10. Error, Empty & Loading States

Driven by the data layer status flags (see [ADR-0004](../adrs/0004-frontend-state-management.md)). Every async surface specifies all three states:

| Surface | Loading | Empty | Error |
| :--- | :--- | :--- | :--- |
| File tree | Skeleton rows | "No documents yet" with sync hint | Retry banner |
| Document view | Content skeleton (title + lines) | — | "Couldn't load this doc" + retry; in-app 404 for unknown path |
| Search | Spinner in modal; "index warming up" if `searchIndex=building` | "No results for '<q>'" | Inline error row |
| History drawer | Skeleton list | "No history" | Retry |
| Sync | Button → spinner "Syncing…" | — | Toast with git error summary (from §6.0), non-blocking |
| Auth | Buttons disabled + spinner | — | Inline "Sign-in failed" message |

- Global network loss shows a dismissible offline banner; reads fall back to React Query cache where available.

## 11. Git Credentials, Pull & Push (v0 + v1)

**The SSO JWT is identity-only and carries no GitHub token**, so it never drives git network auth. All git operations against the docs remote use a **server-side machine credential** — a **GitHub App installation token** (recommended) or a deploy key scoped to the docs repo, stored as a Kubernetes Secret ([ADR-0005](../adrs/0005-auth-delegated-to-sso.md), [configuration.md](configuration.md)).

- **v0 pull**: `repo-cache/` is a single shared server-side working tree. The backend clones/pulls with the machine credential. Pull is **not per-user** — the cookie only governs whether a user may view sync status or trigger a manual sync.
- **v1 pull → commit → push (per engineer)**:
  1. The JWT is used for **authorization** (`provider=github` + `canWrite`) and **attribution** only: the commit is authored as the engineer via `git commit --author="<name> <email>"` from the claims.
  2. The backend runs `git pull --rebase` and `git push` (or opens a PR via the GitHub API) with the **machine credential** — so the engineer needs no local git setup and pushes no personal token to the wiki.
  3. Net effect: commits are **authored** by the engineer, **pushed** by the App. Branch protection and human review still apply in PR mode.
- **Alternative (not default)**: vend each engineer's own GitHub token from SSO so pushes use their native GitHub permissions. Rejected as default (re-introduces per-user tokens into the wiki); see [ADR-0005](../adrs/0005-auth-delegated-to-sso.md).

### 11.1 Concurrency & Conflict Handling

Because edits are committed to a shared git repo, concurrent changes are expected:
- **Before edit**: the editor records the base commit SHA of the file.
- **On save/commit**: backend commits locally, then attempts `git pull --rebase` before `git push`.
- **Clean case**: rebase applies cleanly → push succeeds → UI confirms.
- **Conflict case**: rebase reports a conflict → backend aborts the rebase, leaves the working tree clean, and returns `409 CONFLICT` with the conflicting paths. The UI surfaces a "someone else changed this file" state offering: reload latest, or (recommended default) **open a branch + pull request** instead of pushing to the main branch.
- **Branch/PR mode** (from §4.2, promoted from "optional" to the recommended collaborative default): edits land on a generated branch and a PR is opened via the GitHub API, avoiding direct writes to the protected main branch entirely.

## 12. Authorization

Authentication (§5) establishes *who*; authorization establishes *what they may do*. **Capability is derived from the auth provider**, because the wiki serves the whole company — most viewers (non-engineers, people with no GitHub account) sign in with Google via Firebase and get a **read-only** experience, while engineers sign in with GitHub and can edit.

| Provider | Typical user | Capability |
| :--- | :--- | :--- |
| **Firebase / Google** | Any employee with a Google account | **Read-only.** Edit controls are hidden in the UI and all write endpoints reject the session. |
| **GitHub OAuth** | Engineers / doc maintainers | **Read + write** (v1), subject to `EDIT_ALLOWLIST` / PR-mode repo permissions. |
| **Dev/test account** | Local development only | Treated as a read+write editor, local dev only. |

- The session carries `provider` and a derived `canWrite` boolean; the frontend uses `canWrite` to show/hide edit affordances and the backend independently enforces it on every write endpoint (never trust the client).
- **Read access scope**: `READ_ACCESS` env controls whether reading requires *any* authenticated session (`AUTHENTICATED`, the default for a company-internal wiki) or is open (`PUBLIC`). Firebase sign-in satisfies `AUTHENTICATED`.
- **Write** additionally requires a GitHub (or dev) session; a Firebase-only session attempting a write returns `403 FORBIDDEN`.

## 13. Accessibility

- All interactive elements are keyboard-reachable with visible `:focus-visible` styles; the search modal traps focus and restores it on close (Esc).
- Semantic landmarks (`<header> <nav> <main> <aside>`), proper heading order, and ARIA labels on icon-only buttons (theme toggle, sync, menu).
- Respect `prefers-reduced-motion` for the theme toggle, modal, and drawer animations (see Design.md §4).
- Color choices meet WCAG AA contrast in both themes; the dark/light callout backgrounds in Design.md §3.3 are chosen accordingly.

## 14. Testing Strategy (summary)

**Markdown rendering** has a dedicated contract: [testing-markdown-rendering.md](testing-markdown-rendering.md). A single fixture corpus (`test/fixtures/markdown/`) plus a manifest drive three levels — Vitest DOM assertions, golden HTML snapshots, and Playwright light/dark visual regression — and a **coverage guard** fails CI if any §3 element lacks a fixture/baseline, so new elements are tested against the standard set by construction.

Beyond rendering, at minimum:
- **Unit**: markdown pipeline (callouts, iframe sanitization allow/deny, mermaid/math), path-traversal validation, frontmatter parsing/ordering.
- **Integration**: each API endpoint incl. the **dev-auth production guardrail** (must 403 under `NODE_ENV=production`), sync success/failure, search index build.
- **E2E**: read flow (tree → doc → TOC → search), sign-in via dev account, and v1 edit → commit → conflict path.
- **Security regression**: path traversal, git-arg injection, iframe host-allowlist bypass attempts.
