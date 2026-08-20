/**
 * R6 — the `img` slot (features spec §8, "Images & assets").
 *
 * Markdown images carry one of two kinds of `src`:
 *   - a **relative** path (`./assets/architecture.png`, `../img/logo.svg`) that
 *     points at a non-markdown file living alongside the docs in `repo-cache/`.
 *     The browser can't fetch that directly, so we rewrite it to the backend
 *     asset endpoint `GET /api/asset?path=…` (B4), which streams the bytes with
 *     traversal-guarded path validation and an extension allowlist.
 *   - an **absolute** URL (`https://…`, `data:…`, protocol-relative `//…`) which
 *     is passed through untouched (still subject to the page CSP image policy).
 *
 * Relative paths are resolved against the **directory of the current document**
 * (`basePath`), which the content view (U3) injects. Absent it, resolution is
 * from the repo root — enough for the L1/L2 fixtures and a safe default.
 *
 * Presentation: the image is centered, corner-rounded, and constrained to
 * `max-width: 100%`; its `alt` text doubles as a small italic caption rendered
 * beneath it. The wrapper is a display-block `<span>`, not a `<figure>`:
 * react-markdown renders a standalone image inside a `<p>`, and block elements
 * (`figure`/`figcaption`) are invalid phrasing content there — the browser would
 * hoist them out of the paragraph and corrupt the DOM. Spans stay valid inside
 * a `<p>` while still laying out as blocks via `display`.
 */
import type { CSSProperties } from 'react';
import { API_ROUTES } from '@wiki/contracts';
import type { ImageSlotProps } from '../components.js';

/** Extra props U3 injects to resolve relative asset paths. */
export interface MdImageProps extends ImageSlotProps {
  /**
   * Directory of the current document, relative to `repo-cache/` (e.g. `guide`
   * for `guide/intro.md`). Relative image `src`s resolve against it. Defaults
   * to the repo root (`''`).
   */
  basePath?: string;
}

/** True for a `src` that already addresses a fetchable resource as-is. */
function isAbsolute(src: string): boolean {
  // scheme (http:, https:, data:, blob:, mailto:…) or protocol-relative `//host`.
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//');
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

const figureStyle: CSSProperties = {
  display: 'block',
  margin: '1.5rem auto',
  textAlign: 'center',
};

const imageStyle: CSSProperties = {
  display: 'block',
  margin: '0 auto',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '8px',
};

const captionStyle: CSSProperties = {
  display: 'block',
  marginTop: '0.5rem',
  fontSize: '0.85em',
  fontStyle: 'italic',
  opacity: 0.75,
};

export function MdImage({
  node: _node,
  basePath = '',
  src,
  alt,
  ...rest
}: MdImageProps) {
  const raw = typeof src === 'string' ? src : '';
  const resolvedSrc =
    raw && !isAbsolute(raw)
      ? `${API_ROUTES.asset}?${new URLSearchParams({
          path: resolveRepoPath(basePath, raw),
        }).toString()}`
      : raw;

  const caption = typeof alt === 'string' ? alt.trim() : '';

  return (
    <span className="md-figure" style={figureStyle}>
      <img
        {...rest}
        className="md-image"
        src={resolvedSrc}
        alt={alt ?? ''}
        style={imageStyle}
        loading="lazy"
      />
      {caption ? (
        <span className="md-figure-caption" style={captionStyle}>
          {caption}
        </span>
      ) : null}
    </span>
  );
}

export default MdImage;
