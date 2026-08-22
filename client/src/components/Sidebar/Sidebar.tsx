/**
 * U1 — left sidebar navigation tree (Design.md §3.1, features spec §7, §10).
 *
 * Renders `useTree()` as a nested navigation tree. The label of every entry is
 * the node's resolved **`title`**, never the raw filename or `.md` extension
 * (features spec §7); long titles truncate with an ellipsis and expose the full
 * text via a `title` tooltip. Directories become all-caps group headers; each
 * nesting level adds indentation. File entries are `<Link>`s whose target comes
 * from `docPathToRoute(node.path)` (U3), and the entry matching the current
 * route (`useLocation` → `routeToDocPath`) is marked active with the text-shadow
 * weight trick so activation never shifts the row width (Design.md §3.1).
 *
 * The four async states (features spec §10) are handled: a shimmer skeleton
 * while loading, "No documents yet" when the tree is empty, an inline retry
 * banner on error, and the tree itself when ready.
 *
 * Mobile: the same component doubles as the slide-in drawer. When the integrator
 * (U5) passes the controlled `isOpen` / `onClose` props, the sidebar renders a
 * dismissable drawer — backdrop click, the close button, `Escape`, and following
 * any link all invoke `onClose`. Rendered without those props (the desktop Shell
 * slot) it is a plain in-flow navigation column.
 */

import { useCallback, useEffect, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { TreeNode, TreeResponse } from '@wiki/contracts';
import { useTree } from '../../hooks/useTree.js';
import { deriveAsyncStatus, isTreeEmpty } from '../../hooks/status.js';
import { docPathToRoute, routeToDocPath } from '../../routes/index.js';
import {
  SidebarSkeleton,
  SidebarEmpty,
  SidebarError,
} from './SidebarStates.js';
import './Sidebar.css';

export interface SidebarProps {
  /**
   * Drawer visibility (mobile). Wired by the integrator (U5). When provided
   * alongside {@link onClose} the sidebar renders as a controlled drawer;
   * `true` slides it in, `false` keeps it off-canvas. Omit both for the plain
   * in-flow desktop column.
   */
  isOpen?: boolean;
  /**
   * Drawer dismiss handler (mobile). Its presence turns the sidebar into a
   * drawer. Invoked on backdrop click, the close button, `Escape`, and after
   * following any navigation link so the drawer closes on selection.
   */
  onClose?: () => void;
}

/** Indentation for a given nesting depth: 0.75rem base + 0.75rem per level. */
function indentStyle(depth: number): CSSProperties {
  return { paddingInlineStart: `${0.75 + depth * 0.75}rem` };
}

/**
 * Sort siblings by `order` ascending (absent orders last), then by `title`
 * alphabetically, and drop `hidden` nodes. The server already does this; the
 * component repeats it defensively so it renders correctly regardless of the
 * source ordering (features spec §7).
 */
function orderedVisible(nodes: readonly TreeNode[]): TreeNode[] {
  return nodes
    .filter((node) => node.hidden !== true)
    .slice()
    .sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });
}

interface TreeLevelProps {
  nodes: readonly TreeNode[];
  depth: number;
  activePath: string;
  onNavigate?: () => void;
}

/** One nested `<ul>` level of the tree, rendered recursively. */
function TreeLevel({ nodes, depth, activePath, onNavigate }: TreeLevelProps) {
  const visible = orderedVisible(nodes);
  if (visible.length === 0) return null;

  return (
    <ul className="sidebar__list" role="list">
      {visible.map((node) =>
        node.type === 'directory' ? (
          <li key={node.path} className="sidebar__group">
            <div
              className="sidebar__group-header"
              style={indentStyle(depth)}
              title={node.title}
            >
              <span className="sidebar__label">{node.title}</span>
            </div>
            <TreeLevel
              nodes={node.children ?? []}
              depth={depth + 1}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          </li>
        ) : (
          <li key={node.path}>
            <TreeLink
              node={node}
              depth={depth}
              active={node.path === activePath}
              onNavigate={onNavigate}
            />
          </li>
        ),
      )}
    </ul>
  );
}

interface TreeLinkProps {
  node: TreeNode;
  depth: number;
  active: boolean;
  onNavigate?: () => void;
}

/** A single file entry: a route `<Link>` labelled by the resolved title. */
function TreeLink({ node, depth, active, onNavigate }: TreeLinkProps) {
  return (
    <Link
      to={docPathToRoute(node.path)}
      className="sidebar__link"
      style={indentStyle(depth)}
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      title={node.title}
      onClick={onNavigate}
    >
      <span className="sidebar__label">{node.title}</span>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const activePath = routeToDocPath(location.pathname);

  const tree = useTree();
  const status = deriveAsyncStatus<TreeResponse>(tree, isTreeEmpty);

  const isDrawer = onClose !== undefined;

  // Drawer: close on Escape while open (Design.md §8 keyboard access).
  useEffect(() => {
    if (!isDrawer || !isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDrawer, isOpen, onClose]);

  // In drawer mode, following a link dismisses the drawer.
  const onNavigate = useCallback(() => {
    if (isDrawer) onClose?.();
  }, [isDrawer, onClose]);

  let body: React.ReactNode;
  if (status.isLoading) {
    body = <SidebarSkeleton />;
  } else if (status.isError) {
    body = (
      <SidebarError
        message={status.error?.message}
        onRetry={() => void tree.refetch()}
      />
    );
  } else if (status.isEmpty) {
    body = <SidebarEmpty />;
  } else {
    body = (
      <TreeLevel
        nodes={tree.data ?? []}
        depth={0}
        activePath={activePath}
        onNavigate={onNavigate}
      />
    );
  }

  const nav = (
    <nav
      className="sidebar"
      data-drawer={isDrawer ? 'true' : undefined}
      data-open={isDrawer ? (isOpen ? 'true' : 'false') : undefined}
      aria-label="Documentation navigation"
      aria-hidden={isDrawer && !isOpen ? 'true' : undefined}
    >
      {isDrawer ? (
        <div className="sidebar__drawer-header">
          <button
            type="button"
            className="sidebar__close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
      {body}
    </nav>
  );

  if (!isDrawer) return nav;

  return (
    <>
      <div
        className="sidebar__backdrop"
        data-open={isOpen ? 'true' : 'false'}
        onClick={onClose}
        aria-hidden="true"
      />
      {nav}
    </>
  );
}

export default Sidebar;
