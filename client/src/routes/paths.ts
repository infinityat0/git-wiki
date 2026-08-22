/**
 * U3 — route ↔ doc-path conversion (features spec §9).
 *
 * The SPA URL path mirrors the repo-relative doc path: the route
 * `/adr/0001-architecture-overview` addresses `adr/0001-architecture-overview.md`
 * under `repo-cache/`. These pure helpers are the single conversion site so the
 * router, the `DocView`, and consumers (U1 sidebar, U4 search, U5 header) all
 * agree on the mapping. No React, no I/O — trivially unit-testable.
 */

/**
 * Convert a repo-relative doc `path` (from the tree or a search result, e.g.
 * `adr/0001-architecture-overview.md`) into the SPA route that renders it
 * (`/adr/0001-architecture-overview`). The `.md` extension is stripped, each
 * segment is percent-encoded, and the result is absolute (leading `/`).
 *
 * This is the helper U1/U4/U5 use to turn a tree/search `path` into a
 * `<Link to>` / `navigate()` target.
 */
export function docPathToRoute(path: string): string {
  const withoutExt = path.replace(/\.md$/i, '');
  const segments = withoutExt
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg));
  return `/${segments.join('/')}`;
}

/**
 * Convert an SPA route path (e.g. `/adr/0001-architecture-overview`, typically
 * `useLocation().pathname`) into the repo-relative doc path that backs it
 * (`adr/0001-architecture-overview.md`). Percent-encoding is reversed and the
 * `.md` extension re-appended. The root route (`/`) maps to the empty path,
 * which addresses no document.
 */
export function routeToDocPath(routePath: string): string {
  const segments = routePath
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => safeDecode(seg));
  if (segments.length === 0) return '';
  return `${segments.join('/')}.md`;
}

/**
 * Directory of a repo-relative doc path, used as the `basePath` for resolving
 * that document's relative links and images (R6 contract): `adr/0001-x.md` →
 * `adr`, a root-level `intro.md` → `''`.
 */
export function docDirname(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

/** Decode a URI segment, tolerating malformed escapes rather than throwing. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
