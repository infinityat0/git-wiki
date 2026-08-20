/**
 * R5 — the `iframePlaceholder` slot (the visual layer).
 *
 * Shown in place of any iframe F7's `rehype-iframe-policy` refused to render as
 * a live frame: a non-allowlisted `src` (`reason: 'host'`) or a rejected
 * `srcdoc` document (`reason: 'srcdoc'`). It is a *card*, never a frame — the
 * blocked source is surfaced as text/link so the reader can follow it
 * deliberately, but nothing from it is embedded or executed.
 *
 * Design.md §7: link icon + the URL as a clickable link + a muted
 * "External embed not on allowlist" caption.
 */
import type { CSSProperties } from 'react';
import type { IframePlaceholderSlotProps } from '../components.js';

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
  padding: '0.75rem 1rem',
  maxWidth: '100%',
  border: '1px solid var(--border-muted)',
  borderRadius: '0.5rem',
  background: 'var(--bg-secondary)',
};

const iconStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--text-secondary)',
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  minWidth: 0,
};

const linkStyle: CSSProperties = {
  color: 'var(--text-accent)',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const captionStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.8125rem',
};

/** A link (chain) glyph — inline SVG so the card needs no icon dependency. */
function LinkIcon() {
  return (
    <svg
      style={iconStyle}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/**
 * The disallowed-embed card. `src` is the original blocked URL (may be empty
 * for a `srcdoc`-only iframe); `reason` is `'host' | 'srcdoc'` (surfaced as a
 * `data-*` hook for tests and styling).
 */
export function EmbedPlaceholder({ src, reason }: IframePlaceholderSlotProps) {
  return (
    <div
      className="iframe-placeholder"
      data-iframe-placeholder="true"
      data-iframe-reason={reason}
      style={cardStyle}
    >
      <LinkIcon />
      <span style={bodyStyle}>
        {src ? (
          <a
            href={src}
            style={linkStyle}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {src}
          </a>
        ) : null}
        <span style={captionStyle}>External embed not on allowlist</span>
      </span>
    </div>
  );
}

export default EmbedPlaceholder;
