/**
 * U3 — `docExists` selector (features spec §8 "Internal Links", §9 "Routing").
 *
 * A predicate answering "is there a document at this repo-relative `.md` path?"
 * built from the `/api/tree` forest. Two consumers:
 *   - the router / `DocView` — decide whether an unknown route is an in-app 404;
 *   - R6's `MdLink` — flag doc-to-doc links whose target is missing (broken-link
 *     affordance) instead of letting the click 404 the page.
 *
 * `hidden` nodes stay directly linkable (features spec §7: excluded from the
 * tree UI + search, but still addressable), so this predicate treats them as
 * existing.
 */

import type { TreeNode, TreeResponse } from '@wiki/contracts';
import { useMemo } from 'react';
import { useTree } from '../hooks/useTree.js';

/** A repo-relative path → existence predicate. */
export type DocExists = (path: string) => boolean;

/**
 * Collect every file path in the tree into a set. Directories are skipped;
 * their `children` are walked recursively.
 */
function collectFilePaths(
  nodes: readonly TreeNode[],
  acc: Set<string>,
): Set<string> {
  for (const node of nodes) {
    if (node.type === 'file') {
      acc.add(node.path);
    }
    if (node.children && node.children.length > 0) {
      collectFilePaths(node.children, acc);
    }
  }
  return acc;
}

/**
 * Build a {@link DocExists} predicate from a tree forest. When the tree is
 * `undefined` (not yet loaded / errored) the predicate is permissive — it
 * returns `true` — so a valid deep link is never prematurely treated as a 404
 * and links are not spuriously marked broken before the tree arrives.
 */
export function makeDocExists(tree: TreeResponse | undefined): DocExists {
  if (tree === undefined) {
    return () => true;
  }
  const paths = collectFilePaths(tree, new Set<string>());
  return (path: string) => paths.has(path);
}

/**
 * True only once the tree has definitively loaded AND does not contain `path`.
 * The router uses this to render the in-app 404 for a genuinely unknown route
 * without false-positiving while the tree is still loading.
 */
export function isKnownMissing(
  tree: TreeResponse | undefined,
  path: string,
): boolean {
  if (tree === undefined || path.length === 0) return false;
  return !makeDocExists(tree)(path);
}

/**
 * Hook form: reads the shared tree query and returns a memoized
 * {@link DocExists} predicate. R6 slots and the router consume this.
 */
export function useDocExists(): DocExists {
  const { data } = useTree();
  return useMemo(() => makeDocExists(data), [data]);
}
