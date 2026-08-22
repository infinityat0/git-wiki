/**
 * U2 — right-hand Table of Contents + scroll-spy (Design.md §2, features spec
 * §2.2, §9).
 *
 * A controlled, presentational component: it takes the already-extracted H2/H3
 * `entries` (from F7's `extractToc` / `<Markdown onTocChange>`, forwarded by
 * U3's `AppRoutes`) and does no data fetching of its own. It renders the list,
 * highlights the section currently in view via an `IntersectionObserver` on the
 * rendered heading `id`s, and deep-links each item to its `#slug` with a
 * smooth scroll that collapses to an instant jump under
 * `prefers-reduced-motion: reduce`.
 *
 * Layout (sticky ≥1024px, hidden below) is owned by the Shell's `.shell__toc`
 * zone (F5); this component styles only its own inner chrome and mirrors the
 * breakpoint so it also behaves when mounted standalone (e.g. in tests).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TocEntry } from '../../markdown/index.js';
import './Toc.css';

export interface TocProps {
  /**
   * The ordered H2/H3 table-of-contents entries for the current document,
   * as produced by F7's extractor. When empty the component renders nothing.
   */
  entries: TocEntry[];
  /** Optional extra class on the root `<nav>`. */
  className?: string;
  /** Accessible label for the navigation landmark. */
  label?: string;
}

/** Read the user's reduced-motion preference, guarding non-DOM environments. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The right-hand table of contents.
 *
 * Renders `entries` as an indented H2/H3 list of anchor links. The section in
 * view is tracked with an `IntersectionObserver` over the heading elements and
 * marked with `aria-current` + an active class; clicking scrolls to the heading
 * (respecting reduced-motion) and updates the URL hash without a hard jump.
 */
export function Toc({
  entries,
  className,
  label = 'Table of contents',
}: TocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Latest per-heading visibility, kept across observer callbacks so we can
  // always resolve the topmost visible heading in document order.
  const visibilityRef = useRef<Map<string, boolean>>(new Map());

  // Seed the active item from the URL hash on mount / when entries change, so a
  // deep-linked load highlights the right section before any scrolling occurs.
  useEffect(() => {
    if (entries.length === 0) {
      setActiveId(null);
      return;
    }
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (hash && entries.some((e) => e.id === hash)) {
      setActiveId(hash);
    }
  }, [entries]);

  // Scroll-spy: observe every rendered heading and pick the first one (in TOC
  // order) that is currently within the top band of the viewport.
  useEffect(() => {
    if (entries.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const visibility = visibilityRef.current;
    visibility.clear();

    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          visibility.set(record.target.id, record.isIntersecting);
        }
        const next = entries.find((e) => visibility.get(e.id));
        if (next) setActiveId(next.id);
      },
      // Activate a heading once it reaches the top ~30% of the viewport.
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    for (const entry of entries) {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
      visibility.clear();
    };
  }, [entries]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      // Only intercept plain left-clicks; let modified clicks (new tab, etc.)
      // and non-primary buttons behave natively.
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
      event.preventDefault();

      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }
      // Update the hash for deep-linking without the browser's own hard jump.
      window.history.pushState(null, '', `#${id}`);
      setActiveId(id);
    },
    [],
  );

  if (entries.length === 0) return null;

  const classes = className ? `toc ${className}` : 'toc';

  return (
    <nav className={classes} aria-label={label}>
      <p className="toc__title" id="toc-title">
        On this page
      </p>
      <ul className="toc__list" aria-labelledby="toc-title">
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id} className="toc__item" data-depth={entry.depth}>
              <a
                className={
                  isActive ? 'toc__link toc__link--active' : 'toc__link'
                }
                href={`#${entry.id}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={(event) => handleClick(event, entry.id)}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Toc;
