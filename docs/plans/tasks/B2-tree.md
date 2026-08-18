# B2 — `GET /api/tree`

**Area:** backend · **Milestone:** M1 · **Depends on:** F2, F4 · **Parallel-safe with:** all other `B*`

## Scope
- Walk `REPO_CACHE_DIR`, build the `TreeNode[]` hierarchy from `@wiki/contracts`.
- Per node resolve **`title`** = frontmatter `title` → first `H1` → prettified filename (features spec §7). Include `order`; drop `hidden:true` nodes.
- Sort within a folder by `order` asc, then title/name. Exclude `.git/`, non-`.md` files from the doc tree (assets aren't tree nodes).
- Cache the tree; invalidate on sync (expose an invalidation hook B7 calls).

## Owns
- `server/routes/tree.ts`, `server/lib/frontmatter.ts` (if not already from F7 shared — coordinate; prefer a tiny server-side parser).

## Acceptance
- Returns `title` (never raw filename) per node; ordering honored; hidden excluded.
- Unit test over a fixture tree.

## Read first
- [features spec §6.2, §7](../../specs/wiki-features-specification.md).
