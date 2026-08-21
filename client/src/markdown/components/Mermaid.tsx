import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ThemeContext } from '../../theme/theme-context.js';
import type { MermaidSlotProps } from '../components.js';

/**
 * R2 — Mermaid diagram renderer for the F7 `mermaid` slot.
 *
 * This component is the diagram **trust boundary**: a ```mermaid fence reaches
 * `rehype-sanitize` as inert text, so sanitize never sees the SVG. Mermaid turns
 * that text into SVG in the browser, *after and outside* the sanitize pass — so
 * every diagram control lives here (ADR-0002 "Mermaid & client-rendered
 * diagrams", security-and-safety §3.1, Design §7):
 *
 *   - mermaid is initialized `securityLevel: 'strict'` + `htmlLabels: false`;
 *   - author `%%{init}%%` directives (which could downgrade security or re-enable
 *     HTML labels) and `click`/`callback` interaction directives are stripped
 *     from the source before rendering;
 *   - the generated SVG is additionally hardened (script/`foreignObject`
 *     removed, `on*` handlers and `javascript:` URLs stripped) before it is ever
 *     inserted — the app never injects unsanitized diagram output;
 *   - a syntax error renders an inline error card, scoped to this block, and
 *     never throws to the page;
 *   - the mermaid library is lazy-imported so its heavy chunk stays out of the
 *     initial bundle and only loads when a diagram is present;
 *   - the SVG gets `role="img"` + an accessible `<title>`/`aria-label`;
 *   - the diagram re-renders when the F5 theme toggles.
 */

/** Mermaid theme name mapped from the active light/dark palette. */
type MermaidTheme = 'dark' | 'neutral' | 'default';

/** Minimal shape we rely on from the lazily-imported mermaid module. */
interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    text: string,
  ) => Promise<{ svg: string; bindFunctions?: unknown }>;
}

/**
 * Resolve the mermaid theme. A pinned `window.__MERMAID_THEME__` (set by the L3
 * visual harness for deterministic baselines) wins; otherwise it follows the
 * active F5 theme.
 */
function resolveMermaidTheme(isDark: boolean): MermaidTheme {
  if (typeof window !== 'undefined') {
    const pinned = (window as { __MERMAID_THEME__?: unknown })
      .__MERMAID_THEME__;
    if (pinned === 'dark' || pinned === 'neutral' || pinned === 'default') {
      return pinned;
    }
  }
  return isDark ? 'dark' : 'neutral';
}

/**
 * Consume the F5 theme. Read directly from the context so the diagram re-renders
 * on toggle, but tolerate a missing provider (the L3 visual harness renders
 * `<Markdown>` without one, driving the palette via the `.dark` class instead) —
 * a thrown `useTheme()` there would crash the whole render.
 */
function useIsDark(): boolean {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx.isDark;
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark');
  }
  return false;
}

/**
 * Strip author `%%{init}%%` directives and `click`/`callback` interaction
 * directives from the diagram source. This neutralizes attempts to widen the
 * security level, re-enable HTML labels, or bind a JS handler / navigation —
 * defense in depth on top of `securityLevel: 'strict'`.
 */
function sanitizeSource(code: string): string {
  const withoutInit = code.replace(/%%\{[\s\S]*?\}%%/g, '');
  return withoutInit
    .split('\n')
    .filter((line) => !/^\s*(click|callback)\b/i.test(line))
    .join('\n');
}

/** Derive a short accessible title/label from the diagram source. */
function deriveTitle(code: string): string {
  for (const raw of sanitizeSource(code).split('\n')) {
    const line = raw.trim();
    if (line) return line.length > 80 ? `${line.slice(0, 77)}…` : line;
  }
  return 'Diagram';
}

/**
 * Harden a generated SVG string before insertion: remove `<script>` and
 * `<foreignObject>` (HTML injection vector for `htmlLabels`), strip every `on*`
 * event-handler attribute and any `javascript:` URL, and stamp `role="img"` +
 * an accessible `<title>`. Runs even though mermaid at strict level already
 * sanitizes — the app never trusts raw diagram output.
 */
function hardenSvg(rawSvg: string, title: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = rawSvg.trim();
  const frag = tpl.content;

  // Walk every element and compare lowercased tag names — the HTML template
  // parser lowercases SVG element names (`foreignObject` → `foreignobject`) and
  // does so inconsistently across engines, so a camelCase selector is unsafe.
  for (const el of Array.from(frag.querySelectorAll('*'))) {
    const tag = (el.localName || el.tagName).toLowerCase();
    if (tag === 'script' || tag === 'foreignobject') {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.replace(/[\s-]+/g, '').toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === 'href' || name === 'xlink:href' || name === 'src') &&
        value.startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }

  const svgEl = frag.querySelector('svg');
  if (svgEl) {
    svgEl.setAttribute('role', 'img');
    svgEl.setAttribute('aria-label', title);
    let titleEl = svgEl.querySelector(':scope > title');
    if (!titleEl) {
      titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      svgEl.insertBefore(titleEl, svgEl.firstChild);
    }
    titleEl.textContent = title;
    svgEl.style.maxWidth = '100%';
    svgEl.style.height = 'auto';
  }

  return tpl.innerHTML;
}

type RenderState =
  | { status: 'loading' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string };

export function Mermaid({ code }: MermaidSlotProps) {
  const isDark = useIsDark();
  const theme = resolveMermaidTheme(isDark);
  const reactId = useId();
  const renderId = useMemo(
    () => `mermaid-${reactId.replace(/[^a-zA-Z0-9-]/g, '')}`,
    [reactId],
  );
  const title = useMemo(() => deriveTitle(code), [code]);
  const [state, setState] = useState<RenderState>({ status: 'loading' });
  // Bumped whenever a new render starts so a slow prior render can't win a race.
  const runRef = useRef(0);

  useEffect(() => {
    const run = ++runRef.current;
    setState({ status: 'loading' });

    void (async () => {
      try {
        // Lazy import keeps the mermaid chunk out of the initial bundle.
        const mod = (await import('mermaid')) as unknown as {
          default: MermaidApi;
        };
        const mermaid = mod.default;

        // mermaid parses colors itself (outside any CSS context), so passing
        // CSS `var(...)` values throws "Unsupported color format". Resolve the
        // design tokens to concrete values here — re-read each render so a
        // theme toggle picks up the new palette.
        const rootStyle = getComputedStyle(document.documentElement);
        const cssVar = (name: string, fallback: string): string =>
          rootStyle.getPropertyValue(name).trim() || fallback;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          htmlLabels: false,
          theme,
          // Deterministic ids/seed keep L3 visual baselines stable.
          deterministicIds: true,
          deterministicIDSeed: 'git-wiki',
          flowchart: { htmlLabels: false },
          themeVariables: {
            fontFamily: cssVar('--font-sans', 'Inter, system-ui, sans-serif'),
            lineColor: cssVar('--text-secondary', '#64748b'),
            textColor: cssVar('--text-secondary', '#64748b'),
            primaryColor: cssVar('--brand-green-light', '#26bd6c'),
            primaryBorderColor: cssVar('--brand-green-dark', '#166e3f'),
          },
        });

        const { svg } = await mermaid.render(renderId, sanitizeSource(code));
        if (run !== runRef.current) return;
        setState({ status: 'ready', svg: hardenSvg(svg, title) });
      } catch (err) {
        if (run !== runRef.current) return;
        const message =
          err instanceof Error ? err.message : String(err ?? 'Unknown error');
        setState({ status: 'error', message });
      }
    })();
  }, [code, theme, renderId, title]);

  if (state.status === 'loading') {
    return (
      <div
        className="mermaid-diagram mermaid-loading"
        data-mermaid-status="loading"
        role="status"
        aria-live="polite"
        aria-label="Loading diagram"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '8rem',
          margin: '1.25rem 0',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-muted, hsl(210, 16%, 93%))',
          background: 'var(--surface-muted, transparent)',
          color: 'var(--text-secondary, hsl(215, 15%, 45%))',
          fontSize: '0.8125rem',
        }}
      >
        Loading diagram…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className="mermaid-diagram mermaid-error"
        data-mermaid-status="error"
        role="alert"
        style={{
          margin: '1.25rem 0',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--warning-border, hsl(45, 90%, 55%))',
          background: 'var(--warning-bg, hsla(45, 90%, 55%, 0.08))',
          color: 'var(--text-primary, hsl(215, 25%, 20%))',
        }}
      >
        <strong
          className="mermaid-error-title"
          style={{ display: 'block', marginBottom: '0.375rem' }}
        >
          Diagram failed to render
        </strong>
        <code
          className="mermaid-error-message"
          style={{
            display: 'block',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary, hsl(215, 15%, 45%))',
          }}
        >
          {state.message}
        </code>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram mermaid-ready"
      data-mermaid-status="ready"
      style={{
        display: 'flex',
        justifyContent: 'center',
        maxWidth: '100%',
        margin: '1.25rem 0',
        overflowX: 'auto',
        background: 'transparent',
      }}
      // Diagram output is hardened by `hardenSvg` above before insertion.
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  );
}

export default Mermaid;
