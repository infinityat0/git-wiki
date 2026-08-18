# ADR 0004: Frontend State Management

## Status
Accepted — 2026-08-17.

## Context
The SPA has a handful of distinct state concerns: the current route/document, the file tree, the auth/session user, theme (light/dark), search modal state, and — in v1 — editor buffers and dirty/save state. We want to avoid both prop-drilling and a heavyweight global store.

Options: React Context only, Redux Toolkit, or a lightweight store (Zustand). Server data (tree, doc, history, search) is a separate axis best handled by a data-fetching/cache layer.

## Decision
- **Server state**: **TanStack Query (React Query)** for `/api/tree`, `/api/doc`, `/api/history`, `/api/search` — gives caching, request dedup, loading/error states, and background refetch after a sync for free (directly supports the error/empty/loading spec).
- **Client/UI state**: **Zustand** for small global slices — `theme`, `authUser`, `searchOpen`, and v1 `editor` (dirty buffers, active file). Zustand is ~1KB, needs no provider boilerplate, and is trivial to test.
- **React Context** is used only for truly static/rarely-changing values that must reach deep trees (e.g. a config context), not for frequently-updating state.

## Rationale
- Splitting *server cache* (React Query) from *UI state* (Zustand) keeps each simple; most "state management pain" in doc apps is really cache/loading management, which React Query owns.
- Zustand avoids Redux boilerplate while still giving a single, testable store for UI concerns.

## Consequences
- Loading/empty/error states are driven by React Query status flags — the UI spec references these directly.
- Theme and auth are readable anywhere without prop-drilling; theme persists to `localStorage` and syncs the `.dark` class on `<html>` (see Design.md §4).
- v1 editor state (unsaved buffers) lives in Zustand and can warn on navigation away from a dirty document.
