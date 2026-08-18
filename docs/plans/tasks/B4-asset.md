# B4 — `GET /api/asset?path=`

**Area:** backend · **Milestone:** M1 · **Depends on:** F2, F4 · **Parallel-safe with:** all other `B*`

## Scope
- Validate `path` via F4 (`isAsset` + containment). Stream the file with an inferred `Content-Type`; only the asset extension allowlist is served.
- Set caching headers; reject anything not on the allowlist with `400 VALIDATION`.

## Owns
- `server/routes/asset.ts`.

## Acceptance
- Serves an allowlisted image; rejects `.md`, `.git/config`, traversal, and disallowed extensions. Correct content-type.

## Read first
- [features spec §6.2, §8](../../specs/wiki-features-specification.md) · [security-and-safety.md §1](../../specs/security-and-safety.md).
