/**
 * F8 — L3 visual-regression harness page.
 *
 * A standalone Vite entry (kept OUT of `client/src`) that renders any fixture
 * from the shared corpus through F7's `<Markdown>` component, so Playwright can
 * screenshot the real rendered pixels. It intentionally reuses the app's own
 * design tokens + bundled fonts (`client/src/styles`) so baselines match what
 * ships, and adds `determinism.css` to freeze motion.
 *
 * URL contract (driven by the Playwright spec):
 *   /?fixture=<id>&theme=<light|dark>
 *
 * `?fixture` is a manifest element id (e.g. `headings`); `?theme=dark` toggles
 * the F5 `.dark` class on <html> exactly as the real ThemeProvider does.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Markdown } from '../../../client/src/markdown/index.js';
import '../../../client/src/styles/index.css';
import './determinism.css';

// Eagerly bundle every fixture as a raw string; the query param selects one.
const fixtures = import.meta.glob('../../fixtures/markdown/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function fixtureSource(name: string): string {
  const hit = Object.entries(fixtures).find(([path]) =>
    path.endsWith(`/${name}.md`),
  );
  return hit ? hit[1] : `# Unknown fixture: ${name}\n\nCheck the manifest id.`;
}

const params = new URLSearchParams(window.location.search);
const fixture = params.get('fixture') ?? 'headings';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

// F5 activates the dark palette via the `.dark` class on <html> (tokens.css).
document.documentElement.classList.toggle('dark', theme === 'dark');

// Placeholder for R2 (mermaid): the Playwright config pins a fixed theme/seed
// via this global so diagram output is deterministic once R2 lands.
(window as unknown as { __MERMAID_THEME__?: string }).__MERMAID_THEME__ =
  theme === 'dark' ? 'dark' : 'neutral';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <main className="markdown-body" data-testid="markdown-root">
      <Markdown content={fixtureSource(fixture)} />
    </main>
  </StrictMode>,
);
