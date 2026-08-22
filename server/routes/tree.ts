/**
 * `GET /api/tree` — the hierarchical docs tree (features spec §6.2, §7).
 *
 * Walks the on-disk docs cache (`config.docs.repoCacheDir`) and returns a
 * {@link TreeNode}[] forest. Per node the sidebar-facing `title` is resolved
 * `frontmatter.title` → first `H1` → prettified filename (never the raw
 * filename); `order` is carried through; `hidden: true` nodes are dropped;
 * siblings sort by `order` ascending then title. `.git/` and non-`.md` files
 * are excluded (assets are not tree nodes).
 *
 * Directory metadata (title / order / hidden) is read from an optional
 * `_index.md` inside the directory (the convention chosen from features
 * spec §7); the `_index.md` file itself is not listed as its own child.
 *
 * The built tree is memoised. B7 (sync) must call {@link invalidateTreeCache}
 * after every pull so the next request rebuilds against fresh content.
 */

import fs from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TreeNode } from '@wiki/contracts';

import { config } from '../config/index.js';
import {
  parseFrontmatter,
  resolveTitle,
  prettifyFilename,
  type Frontmatter,
} from '../lib/frontmatter.js';

/** Only markdown files become document nodes. */
const DOC_EXTENSION = '.md';
/** Directory-metadata sidecar file (features spec §7 convention). */
const INDEX_FILE = '_index.md';
/** Never traversed. */
const EXCLUDED_DIRS = new Set(['.git']);

/** Memoised tree; `null` means "cold — rebuild on next request". */
let cache: TreeNode[] | null = null;

/**
 * Invalidate the memoised tree so the next `GET /api/tree` rebuilds it.
 *
 * Exposed as the cache-invalidation hook the sync task (B7) calls after a
 * successful git pull. Idempotent and cheap.
 */
export function invalidateTreeCache(): void {
  cache = null;
}

/** Read + parse a file's frontmatter and body; tolerant of read failures. */
function readMeta(absPath: string): { frontmatter: Frontmatter; body: string } {
  try {
    return parseFrontmatter(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return { frontmatter: {}, body: '' };
  }
}

/**
 * Sort sibling nodes by `order` ascending (absent orders sort last), then by
 * resolved title (case-insensitive), then by raw `name` as a final tie-break.
 */
function compareNodes(a: TreeNode, b: TreeNode): number {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  const at = a.title.toLowerCase();
  const bt = b.title.toLowerCase();
  if (at !== bt) return at < bt ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** Attach `order`/`hidden` from frontmatter only when present (contract-clean). */
function applyMeta(node: TreeNode, frontmatter: Frontmatter): void {
  if (frontmatter.order !== undefined) node.order = frontmatter.order;
  if (frontmatter.hidden !== undefined) node.hidden = frontmatter.hidden;
}

/**
 * Recursively build the tree rooted at `absDir`. `relDir` is the path of
 * `absDir` relative to the docs root (`''` at the top). Returns the sorted,
 * hidden-filtered children of `absDir`.
 */
function buildChildren(absDir: string, relDir: string): TreeNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    const name = entry.name;
    const absPath = path.join(absDir, name);
    const relPath = relDir ? `${relDir}/${name}` : name;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(name)) continue;

      // Directory metadata comes from an optional `_index.md`.
      const indexAbs = path.join(absPath, INDEX_FILE);
      let dirMeta: Frontmatter = {};
      if (fs.existsSync(indexAbs)) {
        dirMeta = readMeta(indexAbs).frontmatter;
      }
      if (dirMeta.hidden === true) continue;

      const children = buildChildren(absPath, relPath);
      // Prune directories with no visible document descendants.
      if (children.length === 0) continue;

      const node: TreeNode = {
        name,
        path: relPath,
        title:
          dirMeta.title !== undefined && dirMeta.title.length > 0
            ? dirMeta.title
            : prettifyFilename(name),
        type: 'directory',
        children,
      };
      applyMeta(node, dirMeta);
      nodes.push(node);
      continue;
    }

    if (!entry.isFile()) continue;
    if (name === INDEX_FILE) continue; // consumed as directory metadata
    if (path.extname(name).toLowerCase() !== DOC_EXTENSION) continue;

    const { frontmatter, body } = readMeta(absPath);
    if (frontmatter.hidden === true) continue;

    const node: TreeNode = {
      name,
      path: relPath,
      title: resolveTitle(name, frontmatter, body),
      type: 'file',
    };
    applyMeta(node, frontmatter);
    nodes.push(node);
  }

  nodes.sort(compareNodes);
  return nodes;
}

/**
 * Build the docs tree from an on-disk root. Pure with respect to the filesystem
 * (no caching) — the memoisation lives in the route handler. A missing root
 * yields an empty forest rather than an error, so the endpoint degrades
 * gracefully before the first successful clone.
 */
export function buildTree(rootDir: string): TreeNode[] {
  if (!fs.existsSync(rootDir)) return [];
  return buildChildren(path.resolve(rootDir), '');
}

/**
 * Return the memoised tree, building it (and caching) on a cold cache.
 * An empty result from a missing root is not cached, so the tree appears as
 * soon as the repo is present.
 */
function getTree(): TreeNode[] {
  if (cache !== null) return cache;
  const tree = buildTree(config.docs.repoCacheDir);
  if (tree.length > 0) cache = tree;
  return tree;
}

/**
 * Express router serving `GET /api/tree`. Mounted by the integrator (see the
 * mount snippet in the task report); this module never touches `src/index.ts`.
 */
export const treeRouter: Router = Router();

treeRouter.get('/api/tree', (_req: Request, res: Response) => {
  res.json(getTree());
});

export default treeRouter;
