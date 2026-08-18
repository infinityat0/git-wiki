# ADR 0003: Full-Text Search Engine

## Status
Accepted — 2026-08-17.

## Context
v0 requires full-text search over all markdown in the docs repo (`repo-cache/`), returning ranked results with highlighted snippets, surfaced in a `⌘K` modal. Options considered:

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **`ripgrep` shell-out per query** | Zero index, always fresh | No ranking, no fuzzy, re-scans on every keystroke, another shell-out to secure |
| **SQLite FTS5** | Real ranking (BM25), durable index | Native dependency; heavier than needed for a modest doc set |
| **`MiniSearch` (in-memory, backend)** | Pure JS, BM25-ish ranking, fuzzy + prefix, tiny | Index held in memory; rebuild on sync |
| **Client-side index (FlexSearch in browser)** | No search API round-trip | Ships the whole corpus to the client; poor for large/private repos |

## Decision
Use **`MiniSearch`** built **in-memory on the backend**, exposed via `GET /api/search`.

- The indexer walks `repo-cache/`, strips markdown to text, and indexes `{ path, title (from frontmatter or first H1), headings, body }` with field boosts (title > headings > body).
- The index is **rebuilt after every successful sync/pull** and on startup. For the expected corpus size (hundreds to low-thousands of docs) an in-memory rebuild is sub-second and simpler than maintaining an incremental durable index.
- Search stays **server-side** so private docs are never shipped wholesale to unauthenticated clients, and so ranking/highlighting logic is shared, not duplicated per client.

## Rationale
- Pure-JS keeps the container image slim and avoids a native build step in the Node image.
- Server-side indexing aligns with the auth model (results can later be filtered by what a user may read).
- If the corpus outgrows in-memory search, SQLite FTS5 is the documented upgrade path behind the same `/api/search` contract.

## Consequences
- Search availability is tied to a successful index build; expose index state (`ready` / `building`) so the UI can show a "search warming up" state.
- Snippet highlighting is computed backend-side and returned in the `matches` array (see spec §6.2).
- Reindex cost scales with repo size; if it ever becomes noticeable, move reindexing off the request path into the sync worker (already the plan).
