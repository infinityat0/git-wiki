/*
 * Shell — the four-zone application layout (Design.md §2).
 *
 *   +-----------------------------------------------------------+
 *   |                        HEADER                             |
 *   +-------------+-------------------------------+-------------+
 *   |   LEFT      |           MAIN                |   RIGHT     |
 *   |   SIDEBAR   |           CONTENT             |   TOC       |
 *   +-------------+-------------------------------+-------------+
 *
 * F5 owns ONLY the layout: sizing, stickiness, and responsive collapse. Each
 * zone is an empty named slot filled by later U* tasks:
 *   - `header`  → U5 (logo, search trigger, sync status, theme toggle)
 *   - `sidebar` → U1 (file navigation tree; becomes a drawer on mobile)
 *   - `toc`     → U2 (table of contents + scroll-spy)
 *   - `children`→ U3 (content view + routing)
 *
 * Responsive behaviour (§2.2), driven purely by CSS in Shell.css:
 *   - Desktop (≥1024px): all three columns.
 *   - Tablet (768–1023px): right TOC hidden.
 *   - Mobile (<768px): left sidebar + right TOC hidden (drawer lives in U1/U5).
 */

import './Shell.css';

export interface ShellProps {
  /** Top bar zone (fixed height, sticky, frosted). U5 fills this. */
  header?: React.ReactNode;
  /** Left navigation zone (sticky, scrollable). U1 fills this. */
  sidebar?: React.ReactNode;
  /** Right table-of-contents zone (sticky). U2 fills this. */
  toc?: React.ReactNode;
  /** Main reading area (max-width, centered). U3 fills this. */
  children?: React.ReactNode;
}

export function Shell({ header, sidebar, toc, children }: ShellProps) {
  return (
    <div className="shell">
      <header className="shell__header">{header}</header>

      <div className="shell__body">
        <aside className="shell__sidebar" aria-label="Site navigation">
          {sidebar}
        </aside>

        <main className="shell__content" id="main-content">
          <div className="shell__content-inner">{children}</div>
        </main>

        <aside className="shell__toc" aria-label="Table of contents">
          {toc}
        </aside>
      </div>
    </div>
  );
}
