# F4 — Path-Safety / Traversal-Guard Utility

**Area:** foundation · **Milestone:** M0 · **Depends on:** F1 · **Blocks:** B2, B3, B4, B5, B7

Everything that reads by `path` depends on this. Build and harden it once.

## Scope
- `resolveInsideRoot(root, userPath)` that: rejects absolute paths and `..` segments; resolves against a `realpath`'d root; asserts the result is contained within `root + sep`; re-checks after symlink resolution.
- Extension allowlists: `isDoc(path)` (`.md`/`.mdx`), `isAsset(path)` (image/pdf allowlist). Always exclude `.git/`.
- Throw a typed `ValidationError` → mapped to `400 VALIDATION` by callers.

## Out of scope
- HTTP wiring (callers do it).

## Owns
- `server/lib/path-safety.ts` (+ its test).

## Acceptance
- Test corpus of traversal payloads (`../`, URL-encoded, absolute, symlink escape, `.git/config`) all rejected; legitimate nested paths accepted.
- This test file is referenced by the security-regression suite.

## Read first
- [security-and-safety.md §1](../../specs/security-and-safety.md).
