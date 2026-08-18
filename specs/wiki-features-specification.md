# Wiki Features Specification (v0 & v1)

This specification defines the functional, technical, and visual requirements for the Git-backed wiki system.

---

## 1. Overview & Architecture

The system consists of:
1. **Frontend**: Vite + React + TypeScript + Vanilla CSS. It provides a clean, fast, single-page application (SPA) reading experience.
2. **Backend**: Node.js + Express. Running locally on the user's system, it handles reading/writing markdown files and executing Git commands.
3. **Docs Repository**: A nested, separate git repository located at `docs/` in the project root.

---

## 2. Visual Design & Theme Guidelines (Inspired by Mintlify & VitePress)

To emulate the clean, premium documentation aesthetics of [VitePress](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart) and [Mintlify](https://www.mintlify.com/docs):

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
2. **File Tree Sidebar**: Renders files and folders dynamically based on the parsed directory tree. Clicking a file loads its content.
3. **Rich Markdown Renderer**: Renders markdown files with correct headers, syntax highlighting, custom lists, and callout alerts.
4. **Table of Contents (TOC)**: Renders heading lists dynamically for the active document.
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

To support secure deployments and multi-user tracking (especially when editing files), the wiki application integrates authentication:

1. **GitHub OAuth Flow**:
   - The user clicks "Sign in with GitHub".
   - Frontend redirects the user to the GitHub authorization page.
   - Upon success, GitHub redirects the user back to the backend callback endpoint `/api/auth/github/callback`.
   - The backend requests a token from GitHub, retrieves the user's profile (username, email, avatar), and establishes a secure session using an encrypted `httpOnly` cookie.
   - This authentication session is used to identify the user for Git commits in v1 (attributing edits to the correct author).

2. **Firebase JWT Validation**:
   - The backend validates Firebase Client ID Tokens sent in the `Authorization: Bearer <JWT>` header.
   - The backend decodes the token and verifies it against Google's public JWK keys (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`).
   - Verified user credentials (uid, email) are attached to `req.user`.

---

## 6. API Contracts (Backend Node/Express)

All endpoints return JSON responses.

### 6.1 Authentication Endpoints

#### GET `/api/auth/github`
Redirects the user to GitHub's OAuth login page.

#### GET `/api/auth/github/callback?code=<code>`
Handles the callback redirect from GitHub. Trades the OAuth code for an access token, stores the user session, and redirects to the frontend homepage.

#### POST `/api/auth/firebase`
Verifies a Firebase ID token sent in the body or Authorization header and starts a session.
- **Request Body**:
  ```json
  {
    "token": "<firebase_id_token>"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "user": {
      "uid": "firebase-uid",
      "email": "user@example.com"
    }
  }
  ```

#### GET `/api/auth/me`
Retrieves the logged-in user profile, if authenticated.
- **Response**:
  ```json
  {
    "authenticated": true,
    "user": {
      "username": "github-username",
      "email": "user@example.com",
      "avatar": "https://avatar-url..."
    }
  }
  ```

#### POST `/api/auth/logout`
Destroys the current authenticated session.
- **Response**:
  ```json
  {
    "success": true
  }
  ```

### 6.2 Documentation Endpoints

#### GET `/api/tree`
Returns the hierarchical tree structure of the markdown files inside the `docs/` repository.
- **Response**:
  ```json
  [
    {
      "name": "README.md",
      "path": "README.md",
      "type": "file"
    },
    {
      "name": "adr",
      "path": "adr",
      "type": "directory",
      "children": [
        {
          "name": "0001-architecture-overview.md",
          "path": "adr/0001-architecture-overview.md",
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

#### POST `/api/sync/pull`
Triggers an immediate git pull in the `docs/` repository.
- **Response**:
  ```json
  {
    "success": true,
    "changesPulled": true,
    "log": "Already up to date."
  }
  ```
