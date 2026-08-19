/**
 * Security-regression suite for the path-safety primitive.
 *
 * Referenced by docs/specs/security-and-safety.md §7 (traversal payloads:
 * `../`, URL-encoded, absolute, symlink escape, `.git/config`).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ASSET_EXTENSIONS,
  DOC_EXTENSIONS,
  ValidationError,
  isAsset,
  isDoc,
  resolveInsideRoot,
} from './path-safety.js';

// A realistic docs root, plus a sibling "outside" dir that traversal/symlinks
// would try to reach. Using os.tmpdir keeps the test hermetic.
let workdir: string; // realpath'd temp workspace
let root: string; // the docs root (a subdir of workdir)
let outsideSecret: string; // a file that lives OUTSIDE root

beforeAll(() => {
  workdir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'path-safety-')));
  root = path.join(workdir, 'repo-cache');

  fs.mkdirSync(path.join(root, 'guides', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });

  // Legitimate files inside the root.
  fs.writeFileSync(path.join(root, 'index.md'), '# root');
  fs.writeFileSync(path.join(root, 'guides', 'intro.md'), '# intro');
  fs.writeFileSync(path.join(root, 'guides', 'nested', 'deep.mdx'), '# deep');
  fs.writeFileSync(path.join(root, 'assets', 'logo.png'), 'PNG');
  fs.writeFileSync(path.join(root, '.git', 'config'), '[core]');

  // A secret that lives outside the root; symlink/traversal targets it.
  outsideSecret = path.join(workdir, 'outside-secret.md');
  fs.writeFileSync(outsideSecret, 'TOP SECRET');
});

afterAll(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
});

describe('resolveInsideRoot — legitimate paths', () => {
  it('accepts a top-level doc', () => {
    expect(resolveInsideRoot(root, 'index.md')).toBe(path.join(root, 'index.md'));
  });

  it('accepts a nested doc', () => {
    expect(resolveInsideRoot(root, 'guides/intro.md')).toBe(
      path.join(root, 'guides', 'intro.md'),
    );
  });

  it('accepts a deeply nested doc', () => {
    expect(resolveInsideRoot(root, 'guides/nested/deep.mdx')).toBe(
      path.join(root, 'guides', 'nested', 'deep.mdx'),
    );
  });

  it('accepts an asset', () => {
    expect(resolveInsideRoot(root, 'assets/logo.png')).toBe(
      path.join(root, 'assets', 'logo.png'),
    );
  });

  it('accepts a path with a harmless "." segment', () => {
    expect(resolveInsideRoot(root, './guides/intro.md')).toBe(
      path.join(root, 'guides', 'intro.md'),
    );
  });

  it('accepts a not-yet-existing file inside root (write endpoints)', () => {
    expect(resolveInsideRoot(root, 'guides/new-page.md')).toBe(
      path.join(root, 'guides', 'new-page.md'),
    );
  });
});

describe('resolveInsideRoot — traversal payloads are rejected', () => {
  // Each of these must throw ValidationError and never resolve outside root.
  const payloads: Array<[label: string, value: string]> = [
    ['simple ../', '../outside-secret.md'],
    ['nested ../', 'guides/../../outside-secret.md'],
    ['multi ../', '../../../../../../etc/passwd'],
    ['trailing ..', 'guides/..'],
    ['bare ..', '..'],
    ['URL-encoded ..%2f', '..%2foutside-secret.md'],
    ['URL-encoded %2e%2e', '%2e%2e/outside-secret.md'],
    ['fully-encoded %2e%2e%2f', '%2e%2e%2foutside-secret.md'],
    ['double-encoded %252e%252e', '%252e%252e/outside-secret.md'],
    ['absolute POSIX', '/etc/passwd'],
    ['windows drive', 'C:\\Windows\\system32\\config'],
    ['UNC path', '\\\\server\\share\\file.md'],
    ['backslash traversal', '..\\outside-secret.md'],
    ['backslash nested traversal', 'guides\\..\\..\\outside-secret.md'],
    ['null byte', 'index.md\0.png'],
    ['.git/config', '.git/config'],
    ['nested .git', 'guides/../.git/config'],
    ['.GIT case-insensitive', '.GIT/config'],
    ['empty string', ''],
  ];

  for (const [label, value] of payloads) {
    it(`rejects ${label}`, () => {
      expect(() => resolveInsideRoot(root, value)).toThrow(ValidationError);
    });
  }

  it('rejects the absolute path to the outside secret', () => {
    expect(() => resolveInsideRoot(root, outsideSecret)).toThrow(ValidationError);
  });
});

describe('resolveInsideRoot — symlink escape is rejected', () => {
  it('rejects a symlink inside root that points OUTSIDE root (file)', () => {
    const link = path.join(root, 'escape-file.md');
    fs.symlinkSync(outsideSecret, link);
    try {
      expect(() => resolveInsideRoot(root, 'escape-file.md')).toThrow(ValidationError);
    } finally {
      fs.rmSync(link, { force: true });
    }
  });

  it('rejects a path THROUGH a symlinked directory that escapes root', () => {
    const linkDir = path.join(root, 'escape-dir');
    fs.symlinkSync(workdir, linkDir); // points to the parent of root
    try {
      // escape-dir -> workdir, then /outside-secret.md is outside root.
      expect(() => resolveInsideRoot(root, 'escape-dir/outside-secret.md')).toThrow(
        ValidationError,
      );
    } finally {
      fs.rmSync(linkDir, { force: true });
    }
  });

  it('accepts a symlink that stays INSIDE root', () => {
    const link = path.join(root, 'alias.md');
    fs.symlinkSync(path.join(root, 'index.md'), link);
    try {
      expect(resolveInsideRoot(root, 'alias.md')).toBe(path.join(root, 'index.md'));
    } finally {
      fs.rmSync(link, { force: true });
    }
  });
});

describe('resolveInsideRoot — root handling', () => {
  it('rejects the bare root itself (not a file within it)', () => {
    expect(() => resolveInsideRoot(root, '.')).toThrow(ValidationError);
  });

  it('rejects a non-existent root', () => {
    expect(() => resolveInsideRoot(path.join(workdir, 'nope'), 'index.md')).toThrow(
      ValidationError,
    );
  });

  it('rejects an empty root', () => {
    expect(() => resolveInsideRoot('', 'index.md')).toThrow(ValidationError);
  });

  it('thrown errors carry code=VALIDATION and status=400', () => {
    try {
      resolveInsideRoot(root, '../escape');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).code).toBe('VALIDATION');
      expect((err as ValidationError).status).toBe(400);
    }
  });
});

describe('isDoc', () => {
  it('accepts .md and .mdx (case-insensitive)', () => {
    expect(isDoc('a/b/c.md')).toBe(true);
    expect(isDoc('a/b/c.mdx')).toBe(true);
    expect(isDoc('a/b/C.MD')).toBe(true);
  });

  it('rejects non-doc extensions', () => {
    for (const ext of ['.txt', '.png', '.pdf', '.html', '.js', '']) {
      expect(isDoc(`file${ext}`)).toBe(false);
    }
  });

  it('rejects anything under .git/', () => {
    expect(isDoc('.git/config.md')).toBe(false);
    expect(isDoc('a/.git/b.md')).toBe(false);
  });

  it('exposes the expected allowlist', () => {
    expect(DOC_EXTENSIONS).toEqual(['.md', '.mdx']);
  });
});

describe('isAsset', () => {
  it('accepts each allowlisted asset extension (case-insensitive)', () => {
    for (const ext of ASSET_EXTENSIONS) {
      expect(isAsset(`assets/file${ext}`)).toBe(true);
      expect(isAsset(`assets/file${ext.toUpperCase()}`)).toBe(true);
    }
  });

  it('rejects non-asset extensions', () => {
    for (const ext of ['.md', '.mdx', '.txt', '.exe', '.bmp', '.tiff', '']) {
      expect(isAsset(`file${ext}`)).toBe(false);
    }
  });

  it('rejects anything under .git/', () => {
    expect(isAsset('.git/logo.png')).toBe(false);
    expect(isAsset('a/.git/logo.png')).toBe(false);
  });

  it('matches the documented allowlist', () => {
    expect(ASSET_EXTENSIONS).toEqual(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf']);
  });
});
