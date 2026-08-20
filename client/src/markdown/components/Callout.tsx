import type { ReactNode } from 'react';
import type { CalloutSlotProps } from '../components.js';
import type { CalloutType } from '../callouts.js';

interface CalloutThemeConfig {
  borderColor: string;
  bgLight: string;
  bgDark: string;
  titleColor: string;
  titleColorDark: string;
  icon: ReactNode;
}

/**
 * Inline SVG Icons for Callout types (no external dependencies).
 */
function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="callout-icon-svg"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="callout-icon-svg"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="callout-icon-svg"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CautionIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="callout-icon-svg"
    >
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ImportantIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="callout-icon-svg"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/**
 * Design.md §3.3 Alert & Callout Blocks specification:
 * NOTE:    #0284c7, Light: hsl(200, 100%, 97%), Dark: hsl(200, 30%, 10%)
 * TIP:     #166e3f, Light: hsl(148, 40%, 97%),  Dark: hsl(148, 30%, 10%)
 * WARNING: #d97706, Light: hsl(38, 100%, 97%),  Dark: hsl(38, 30%, 10%)
 * CAUTION: #dc2626, Light: hsl(0, 100%, 97%),   Dark: hsl(0, 30%, 10%)
 */
const CALLOUT_CONFIG: Record<CalloutType, CalloutThemeConfig> = {
  note: {
    borderColor: '#0284c7',
    bgLight: 'hsl(200, 100%, 97%)',
    bgDark: 'hsl(200, 30%, 10%)',
    titleColor: '#0284c7',
    titleColorDark: '#38bdf8',
    icon: <InfoIcon />,
  },
  tip: {
    borderColor: '#166e3f',
    bgLight: 'hsl(148, 40%, 97%)',
    bgDark: 'hsl(148, 30%, 10%)',
    titleColor: '#166e3f',
    titleColorDark: '#26bd6c',
    icon: <TipIcon />,
  },
  warning: {
    borderColor: '#d97706',
    bgLight: 'hsl(38, 100%, 97%)',
    bgDark: 'hsl(38, 30%, 10%)',
    titleColor: '#d97706',
    titleColorDark: '#fbbf24',
    icon: <WarningIcon />,
  },
  caution: {
    borderColor: '#dc2626',
    bgLight: 'hsl(0, 100%, 97%)',
    bgDark: 'hsl(0, 30%, 10%)',
    titleColor: '#dc2626',
    titleColorDark: '#f87171',
    icon: <CautionIcon />,
  },
  important: {
    borderColor: '#8250df',
    bgLight: 'hsl(260, 100%, 97%)',
    bgDark: 'hsl(260, 30%, 10%)',
    titleColor: '#8250df',
    titleColorDark: '#a855f7',
    icon: <ImportantIcon />,
  },
};

const CALLOUT_STYLES = `
:root {
  --callout-bg-note: hsl(200, 100%, 97%);
  --callout-title-note: #0284c7;

  --callout-bg-tip: hsl(148, 40%, 97%);
  --callout-title-tip: #166e3f;

  --callout-bg-warning: hsl(38, 100%, 97%);
  --callout-title-warning: #d97706;

  --callout-bg-caution: hsl(0, 100%, 97%);
  --callout-title-caution: #dc2626;

  --callout-bg-important: hsl(260, 100%, 97%);
  --callout-title-important: #8250df;
}

.dark, [data-theme="dark"] {
  --callout-bg-note: hsl(200, 30%, 10%);
  --callout-title-note: #38bdf8;

  --callout-bg-tip: hsl(148, 30%, 10%);
  --callout-title-tip: #26bd6c;

  --callout-bg-warning: hsl(38, 30%, 10%);
  --callout-title-warning: #fbbf24;

  --callout-bg-caution: hsl(0, 30%, 10%);
  --callout-title-caution: #f87171;

  --callout-bg-important: hsl(260, 30%, 10%);
  --callout-title-important: #a855f7;
}

.callout-content > :first-child {
  margin-top: 0;
}

.callout-content > :last-child {
  margin-bottom: 0;
}
`;

function ensureCalloutStyles() {
  if (
    typeof document !== 'undefined' &&
    !document.getElementById('callout-styles')
  ) {
    const style = document.createElement('style');
    style.id = 'callout-styles';
    style.textContent = CALLOUT_STYLES;
    document.head.appendChild(style);
  }
}

// Inject styles on module load when DOM is available
ensureCalloutStyles();

/**
 * R4 — Callout Component for the markdown pipeline's `callout` slot.
 *
 * Implements Design.md §3.3:
 * - 4px vertical left border with type-specific color.
 * - Tinted background color for light and dark themes.
 * - Header with matching color, inline SVG icon, and title text.
 * - Body container for nested markdown children.
 */
export function Callout({ type, title, children }: CalloutSlotProps) {
  ensureCalloutStyles();

  const normalizedType = type && CALLOUT_CONFIG[type] ? type : 'note';
  const config = CALLOUT_CONFIG[normalizedType];
  const displayTitle =
    title || normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);

  return (
    <div
      className={`callout callout-${normalizedType}`}
      data-callout={normalizedType}
      data-callout-title={displayTitle}
      style={{
        borderLeft: `4px solid ${config.borderColor}`,
        backgroundColor: `var(--callout-bg-${normalizedType}, ${config.bgLight})`,
        borderRadius: '0.375rem',
        margin: '1.25rem 0',
        padding: '1rem 1.25rem',
      }}
    >
      <div
        className="callout-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          color: `var(--callout-title-${normalizedType}, ${config.titleColor})`,
        }}
      >
        <span
          className="callout-icon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {config.icon}
        </span>
        <span className="callout-title-text">{displayTitle}</span>
      </div>
      {children && (
        <div
          className="callout-content"
          style={{
            marginTop: '0.5rem',
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Callout;
