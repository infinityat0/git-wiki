/**
 * R5 — the live-`iframe` slot (the visual layer).
 *
 * The security POLICY lives in F7: by the time this renderer runs, the
 * `rehype-iframe-policy` transform in `pipeline.ts` has already proven the host
 * is allowlisted, forced `sandbox="allow-scripts allow-same-origin allow-popups"`
 * and `loading="lazy"`, dropped `srcdoc`, and stripped every author-supplied
 * attribute outside the safe surface. A non-allowlisted or `srcdoc` iframe never
 * reaches here — it is swapped for the {@link EmbedPlaceholder} card upstream.
 *
 * This component adds ONLY presentation: it wraps the (already-sandboxed) frame
 * in a responsive 16:9 container per Design.md §7. It forwards the pipeline's
 * props verbatim so the forced `sandbox` + `loading="lazy"` survive untouched —
 * it deliberately does not re-derive or widen them.
 */
import type { CSSProperties } from 'react';
import type { IframeSlotProps } from '../components.js';

/**
 * Responsive 16:9 frame (Design.md §7): `max-width: 100%`, a 1px
 * `--border-muted` border, and `border-radius: 0.5rem`. The iframe fills it.
 */
const containerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '100%',
  aspectRatio: '16 / 9',
  border: '1px solid var(--border-muted)',
  borderRadius: '0.5rem',
  overflow: 'hidden',
};

const frameStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 0,
};

/**
 * Render an allowlisted embed. `node` (the hast node react-markdown threads
 * through) is dropped; every other prop — crucially `src`, `sandbox`,
 * `loading`, `title`, `allow` — is forwarded to the frame exactly as the
 * pipeline set it.
 */
export function Embed({ node: _node, style, ...props }: IframeSlotProps) {
  return (
    <div
      className="iframe-embed-container"
      data-iframe-embed="true"
      style={containerStyle}
    >
      <iframe {...props} style={{ ...frameStyle, ...style }} />
    </div>
  );
}

export default Embed;
