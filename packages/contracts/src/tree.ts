/**
 * File-tree contract for `GET /api/tree` (features spec §6.2, §7).
 *
 * The sidebar renders the resolved `title` (frontmatter `title` → first `H1` →
 * prettified filename), never the raw `name`. `name` is included only for
 * reference and tie-break sorting.
 */

/** Node kind in the docs tree. */
export type TreeNodeType = 'file' | 'directory';

/**
 * A single node in the docs tree. Directories carry `children`; files do not.
 * `order`/`hidden` come from frontmatter (features spec §7).
 */
export interface TreeNode {
  /** Raw filename, e.g. `0001-architecture-overview.md`. Reference/tie-break only. */
  name: string;
  /** Path relative to `repo-cache/`, e.g. `adr/0001-architecture-overview.md`. */
  path: string;
  /** Resolved human-readable label the sidebar renders (features spec §7). */
  title: string;
  type: TreeNodeType;
  /** Sort key within a folder (ascending); absent nodes sort after, alphabetically. */
  order?: number;
  /** `true` excludes the node from tree + search, but it stays directly linkable. */
  hidden?: boolean;
  /** Present on directories. */
  children?: TreeNode[];
}

/** Response of `GET /api/tree`: the top-level forest of tree nodes. */
export type TreeResponse = TreeNode[];
