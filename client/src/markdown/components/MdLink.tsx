/**
 * R6 — the `a` slot (features spec §8 "Internal Links", §9 "Routing").
 *
 * Markdown anchors fall into three buckets:
 *   - **External** (`https://…`, `mailto:…`, protocol-relative `//…`): left
 *     untouched except that we add `target="_blank"` + `rel="noopener
 *     noreferrer"` so they open safely in a new tab.
 *   - **Same-page anchors** (`#section`): passed straight through; the browser /
 *     scroll-spy handles them.
 *   - **Doc-to-doc** relative `.md` links (`./callouts.md`,
 *     `../adr/0001-x.md#anchor`): rewritten to the SPA route that mirrors the
 *     doc path (§9 — `repo-cache/adr/0001-x.md` ↔ `/adr/0001-x`). The `.md`
 *     extension is stripped and any `#anchor` fragment preserved. The rewritten
 *     anchor is tagged `data-internal-link` so the router (U3) can intercept the
 *     click and navigate without a full reload.
 *
 * A doc-to-doc link whose target is **not present in the tree** renders with a
 * subtle "broken link" affordance (`data-broken-link`) rather than letting the
 * click 404 the whole page (§8). Existence is decided by the injected
 * `docExists` predicate; when it is absent we assume the target exists (a
 * permissive default so the link still works before the tree is wired in).
 */
import type { AnchorSlotProps } from '../components.js';

/** Extra props U3 injects for route resolution + existence checking. */
export interface MdLinkProps extends AnchorSlotProps {
  /**
   * Predicate answering "is there a document at this repo-relative `.md` path?"
   * (e.g. `adr/0001-architecture-overview.md`). Injected by U3 from the tree.
   * When omitted, every internal target is treated as existing.
   */
  docExists?: (path: string) => boolean;
  /**
   * Directory of the current document, relative to `repo-cache/` (e.g. `guide`
   * for `guide/intro.md`). Relative link targets resolve against it. Defaults
   * to the repo root (`''`).
   */
  basePath?: string;
}

/** True for an href that already addresses a resource outside the SPA. */
function isExternal(href: string): boolean {
  // scheme (http:, https:, mailto:, tel:…) or protocol-relative `//host`.
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

/**
 * Resolve a relative path against a base directory into a normalized
 * repo-relative path (no leading slash), collapsing `.` and `..` segments.
 */
function resolveRepoPath(basePath: string, relative: string): string {
  const segments = relative.startsWith('/')
    ? []
    : basePath.split('/').filter(Boolean);
  for (const seg of relative.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') segments.pop();
    else segments.push(seg);
  }
  return segments.join('/');
}

export function MdLink({
  node: _node,
  href,
  docExists,
  basePath = '',
  children,
  ...rest
}: MdLinkProps) {
  const raw = typeof href === 'string' ? href : '';

  // External links: open safely in a new tab, otherwise untouched.
  if (isExternal(raw)) {
    return (
      <a {...rest} href={raw} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  // Same-page anchors and non-`.md` relative links: pass straight through.
  const [pathPart, ...hashRest] = raw.split('#');
  const hash = hashRest.length ? `#${hashRest.join('#')}` : '';
  if (raw.startsWith('#') || !/\.md$/i.test(pathPart)) {
    return (
      <a {...rest} href={raw}>
        {children}
      </a>
    );
  }

  // Doc-to-doc `.md` link → SPA route mirroring the doc path (§9).
  const docPath = resolveRepoPath(basePath, pathPart); // e.g. adr/0001-x.md
  const route = `/${docPath.replace(/\.md$/i, '')}${hash}`;

  const exists = docExists ? docExists(docPath) : true;
  if (!exists) {
    return (
      <a
        {...rest}
        href={route}
        className="md-link md-link-broken"
        data-broken-link="true"
        data-internal-link="true"
        aria-disabled="true"
        title="This page does not exist"
      >
        {children}
      </a>
    );
  }

  return (
    <a {...rest} href={route} className="md-link" data-internal-link="true">
      {children}
    </a>
  );
}

export default MdLink;
