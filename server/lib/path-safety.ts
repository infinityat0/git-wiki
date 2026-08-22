/**
 * Path-safety / traversal-guard utility.
 *
 * This is a SECURITY primitive. Every endpoint that reads a file by a
 * user-supplied `path` (`/api/doc`, `/api/asset`, `/api/history`, and the v1
 * write endpoints) MUST route that path through {@link resolveInsideRoot}
 * before touching the filesystem.
 *
 * Containment logic implements docs/specs/security-and-safety.md §1 exactly:
 *   1. Reject absolute paths and any `..` segment before use.
 *   2. Resolve the candidate against a `realpath`'d root and assert the result
 *      is contained within `root + path.sep`.
 *   3. Re-assert containment after symlink resolution so a symlink *inside* the
 *      repo cannot escape the root.
 *   4. Enforce an extension allowlist (`isDoc` / `isAsset`); `.git/` is always
 *      excluded.
 *
 * All rejections throw {@link ValidationError}, which callers map to
 * `400 VALIDATION`.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Thrown for any input that fails validation. Callers map this to an HTTP
 * `400` response with an error code of `VALIDATION`.
 */
export class ValidationError extends Error {
  /** Stable machine-readable code; callers key their HTTP mapping off this. */
  readonly code = 'VALIDATION' as const;
  /** Suggested HTTP status for callers that map errors generically. */
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    // Restore prototype chain for `instanceof` across transpile targets.
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/** Document extensions served by `/api/doc`. Lower-case, dot-prefixed. */
export const DOC_EXTENSIONS: readonly string[] = ['.md', '.mdx'];

/** Asset extensions served by `/api/asset`. Lower-case, dot-prefixed. */
export const ASSET_EXTENSIONS: readonly string[] = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.pdf',
];

/** The version-control directory is never readable through the wiki. */
const EXCLUDED_SEGMENTS: readonly string[] = ['.git'];

/**
 * Fully percent-decode a candidate path so that URL-encoded traversal payloads
 * (`%2e%2e%2f`, and double-encoded variants like `%252e%252e`) are analysed in
 * their decoded form rather than being treated as opaque filenames.
 *
 * Bounded to a handful of passes; malformed encoding is rejected outright.
 */
function fullyDecode(input: string): string {
  let current = input;
  for (let pass = 0; pass < 6; pass++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      throw new ValidationError('path contains malformed percent-encoding');
    }
    if (next === current) return current;
    current = next;
  }
  // Still changing after 6 decode passes — pathologically nested encoding.
  throw new ValidationError('path is excessively percent-encoded');
}

/**
 * Validate the raw user input and return a decoded, separator-normalised path.
 *
 * Rejects (via {@link ValidationError}): non-strings, empty strings, null
 * bytes, absolute paths (POSIX `/…`, Windows `C:\…` or UNC), any `..` segment,
 * and any `.git` segment. Both `/` and `\` are treated as separators so a
 * backslash cannot smuggle a segment past the check on POSIX hosts.
 */
function validateInput(userPath: unknown): string {
  if (typeof userPath !== 'string') {
    throw new ValidationError('path must be a string');
  }
  if (userPath.length === 0) {
    throw new ValidationError('path must not be empty');
  }
  if (userPath.includes('\0')) {
    throw new ValidationError('path must not contain null bytes');
  }

  const decoded = fullyDecode(userPath);

  // Analyse with both separators unified to `/`.
  const unified = decoded.replace(/\\/g, '/');

  // Absolute forms: leading slash, Windows drive letter, or UNC path.
  if (
    unified.startsWith('/') ||
    /^[a-zA-Z]:/.test(unified) ||
    unified.startsWith('//')
  ) {
    throw new ValidationError('absolute paths are not allowed');
  }

  const segments = unified.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new ValidationError(
        'parent-directory ("..") segments are not allowed',
      );
    }
    if (EXCLUDED_SEGMENTS.includes(segment.toLowerCase())) {
      throw new ValidationError('".git" paths are not allowed');
    }
  }

  return decoded;
}

/**
 * Resolve `candidate` to a real filesystem path, transparently handling the
 * case where the leaf (or some ancestor) does not yet exist: it walks up to the
 * nearest existing ancestor, `realpath`s that (following any symlinks), then
 * re-appends the missing tail. This ensures a symlinked *ancestor directory* is
 * caught even when the target file itself is absent.
 */
function realpathLenient(candidate: string): string {
  const missingTail: string[] = [];
  let current = candidate;

  // Guard against an unbounded loop on exotic filesystems.
  for (let i = 0; i < 4096; i++) {
    try {
      const real = fs.realpathSync(current);
      // Re-append the missing tail (collected deepest-first, so reverse it).
      return missingTail.length === 0
        ? real
        : path.join(real, ...missingTail.slice().reverse());
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
      const parent = path.dirname(current);
      if (parent === current) {
        // Reached the filesystem root without finding anything real.
        throw new ValidationError('path could not be resolved');
      }
      missingTail.push(path.basename(current));
      current = parent;
    }
  }
  throw new ValidationError('path could not be resolved');
}

/** Assert that `candidate` lives strictly beneath `realRoot`. */
function assertContained(realRoot: string, candidate: string): void {
  if (!candidate.startsWith(realRoot + path.sep)) {
    throw new ValidationError('path escapes the repository root');
  }
}

/**
 * Resolve a user-supplied `userPath` to an absolute, symlink-resolved
 * filesystem path that is guaranteed to live inside `root`.
 *
 * @param root     The docs root (e.g. `REPO_CACHE_DIR`). It is `realpath`'d, so
 *                 it must exist; a missing/broken root throws.
 * @param userPath The untrusted, relative path from the request.
 * @returns        The absolute, real (symlink-resolved) path, safe to read.
 * @throws {ValidationError} for any absolute path, `..`/`.git` segment,
 *                 malformed encoding, or path that escapes `root` before or
 *                 after symlink resolution.
 */
export function resolveInsideRoot(root: string, userPath: string): string {
  if (typeof root !== 'string' || root.length === 0) {
    throw new ValidationError('root must be a non-empty string');
  }

  const safeRelative = validateInput(userPath);

  // Realpath the root itself so containment is checked against its true
  // location (e.g. when the root is reached through a symlink).
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    throw new ValidationError('repository root does not exist');
  }

  // (a) Lexical containment against the realpath'd root.
  const resolved = path.resolve(realRoot, safeRelative);
  assertContained(realRoot, resolved);

  // (b) Symlink-resolved containment: a symlink inside the repo must not point
  //     outside it. Re-assert after following links (including for a still
  //     nonexistent leaf, by resolving the nearest existing ancestor).
  const real = realpathLenient(resolved);
  assertContained(realRoot, real);

  return real;
}

/** Extract a lower-cased extension (with leading dot) from a path string. */
function extname(p: string): string {
  return path.extname(p).toLowerCase();
}

/** True if any segment of `p` is an excluded (`.git`) directory. */
function touchesExcluded(p: string): boolean {
  return p
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => EXCLUDED_SEGMENTS.includes(segment.toLowerCase()));
}

/**
 * True if `p` is a renderable document (`.md` / `.mdx`) and not inside `.git/`.
 * Extension check is case-insensitive. This is an allowlist classifier only —
 * containment is enforced separately by {@link resolveInsideRoot}.
 */
export function isDoc(p: string): boolean {
  if (typeof p !== 'string' || touchesExcluded(p)) return false;
  return DOC_EXTENSIONS.includes(extname(p));
}

/**
 * True if `p` is a servable asset (image/pdf allowlist) and not inside `.git/`.
 * Extension check is case-insensitive. This is an allowlist classifier only —
 * containment is enforced separately by {@link resolveInsideRoot}.
 */
export function isAsset(p: string): boolean {
  if (typeof p !== 'string' || touchesExcluded(p)) return false;
  return ASSET_EXTENSIONS.includes(extname(p));
}
