/**
 * U3 — intercept in-app link clicks so doc-to-doc navigation is a client-side
 * route change, not a full page reload (features spec §9).
 *
 * R6's `MdLink` rewrites relative `.md` links to SPA routes and tags them
 * `data-internal-link="true"` with an already-correct `href` (route path +
 * optional `#anchor`). Rather than have every anchor be a router `<Link>` (the
 * pipeline emits plain `<a>`s), we delegate a single click handler on the
 * content container: a plain left-click on such an anchor is converted into a
 * `navigate()` call. Modifier clicks (new tab/window) and non-internal links
 * fall through to the browser untouched.
 */

import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns an `onClick` handler for the `DocView` container that turns clicks on
 * `a[data-internal-link]` into client-side navigations.
 */
export function useInternalLinkNav(): (event: MouseEvent<HTMLElement>) => void {
  const navigate = useNavigate();

  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      // Let the browser handle modified clicks (open in new tab/window, etc.).
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>(
        'a[data-internal-link]',
      );
      if (!anchor) return;

      // Broken links (target absent from the tree) are inert.
      if (anchor.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href) return;

      event.preventDefault();
      navigate(href);
    },
    [navigate],
  );
}
