/**
 * Unit tests for the frontmatter parser + title-resolution helpers
 * (features spec §7). Focus: the label chain never falls through to the raw
 * filename, and the three understood keys parse correctly.
 */

import { describe, expect, it } from 'vitest';

import {
  firstH1,
  parseFrontmatter,
  prettifyFilename,
  resolveTitle,
} from './frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses title, order, and hidden with inline comments stripped', () => {
    const src = [
      '---',
      'title: Getting Started      # overrides sidebar label',
      'order: 10                   # lower sorts first',
      'hidden: false               # visible',
      '---',
      '# Body Heading',
      'text',
    ].join('\n');
    const { frontmatter, body } = parseFrontmatter(src);
    expect(frontmatter).toEqual({
      title: 'Getting Started',
      order: 10,
      hidden: false,
    });
    expect(body).toBe('# Body Heading\ntext');
  });

  it('preserves a quoted title containing a hash', () => {
    const { frontmatter } = parseFrontmatter('---\ntitle: "C# Guide"\n---\n');
    expect(frontmatter.title).toBe('C# Guide');
  });

  it('treats a file with no frontmatter as pure body', () => {
    const src = '# Just A Doc\n\ncontent';
    expect(parseFrontmatter(src)).toEqual({ frontmatter: {}, body: src });
  });

  it('treats an unterminated block as pure body', () => {
    const src = '---\ntitle: Nope\nstill going';
    expect(parseFrontmatter(src)).toEqual({ frontmatter: {}, body: src });
  });

  it('ignores unknown keys and non-numeric order', () => {
    const { frontmatter } = parseFrontmatter(
      '---\nauthor: Sunny\norder: notanumber\n---\n',
    );
    expect(frontmatter).toEqual({});
  });

  it('handles CRLF line endings', () => {
    const { frontmatter } = parseFrontmatter(
      '---\r\ntitle: Windows\r\norder: 3\r\n---\r\nbody',
    );
    expect(frontmatter).toEqual({ title: 'Windows', order: 3 });
  });
});

describe('firstH1', () => {
  it('returns the first ATX H1 text, trimming closing hashes', () => {
    expect(firstH1('intro\n# Real Title #\nmore')).toBe('Real Title');
  });

  it('ignores a hash inside a fenced code block', () => {
    const body = ['```sh', '# not a heading', '```', '# Actual Title'].join(
      '\n',
    );
    expect(firstH1(body)).toBe('Actual Title');
  });

  it('does not treat H2+ as an H1', () => {
    expect(firstH1('## Subheading\ntext')).toBeUndefined();
  });
});

describe('prettifyFilename', () => {
  it('strips extension, order prefix, separators and title-cases', () => {
    expect(prettifyFilename('0001-architecture-overview.md')).toBe(
      'Architecture Overview',
    );
  });

  it('handles underscores and mixed case', () => {
    expect(prettifyFilename('release_NOTES.md')).toBe('Release Notes');
  });
});

describe('resolveTitle', () => {
  it('prefers frontmatter title', () => {
    expect(
      resolveTitle('02-plain-file.md', { title: 'Chosen' }, '# H1 Title'),
    ).toBe('Chosen');
  });

  it('falls back to the first H1', () => {
    expect(resolveTitle('02-plain-file.md', {}, '# H1 Title')).toBe('H1 Title');
  });

  it('falls back to the prettified filename, never the raw name', () => {
    const raw = '02-plain-file.md';
    const title = resolveTitle(raw, {}, 'no heading here');
    expect(title).toBe('Plain File');
    expect(title).not.toBe(raw);
  });
});
