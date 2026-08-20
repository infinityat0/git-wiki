/**
 * Minimal server-side frontmatter parser + title-resolution helpers.
 *
 * Implements the metadata layer of features spec §7: optional leading YAML
 * frontmatter carrying only the three keys the wiki understands — `title`,
 * `order`, `hidden` — plus the label-resolution chain the sidebar renders:
 *
 *   frontmatter `title` → first `H1` in the body → prettified filename.
 *
 * This is deliberately a *tiny* parser rather than a full YAML dependency: the
 * frontmatter surface is a flat block of `key: value` scalars, so a line-based
 * reader is sufficient, dependency-free, and easy to reason about for the
 * security-sensitive server. Unknown keys are ignored.
 */

/** The three frontmatter keys the wiki understands (features spec §7). */
export interface Frontmatter {
  /** Overrides the sidebar/tab label and search title. */
  title?: string;
  /** Ascending sort key within a folder; absent nodes sort after. */
  order?: number;
  /** `true` excludes the node from the tree + search (stays linkable). */
  hidden?: boolean;
}

/** Result of splitting a markdown file into its frontmatter and body. */
export interface ParsedMarkdown {
  /** Parsed frontmatter (empty object when none / unrecognised). */
  frontmatter: Frontmatter;
  /** Document text with any frontmatter block removed. */
  body: string;
}

/** Matches a frontmatter fence line: `---` (optionally with trailing spaces). */
const FENCE = /^---[ \t]*$/;

/**
 * Strip surrounding matching quotes from a scalar, if present. A quoted value
 * is returned verbatim (inline `#` is not a comment inside quotes); an unquoted
 * value has any ` #…` trailing comment removed and is then trimmed.
 */
function parseScalar(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'") && value.endsWith(first)) {
      return value.slice(1, -1);
    }
  }
  // Strip a YAML inline comment (whitespace, then `#`, to end of line).
  const commentAt = value.search(/\s#/);
  return (commentAt === -1 ? value : value.slice(0, commentAt)).trim();
}

/**
 * Parse a markdown source into `{ frontmatter, body }`.
 *
 * A frontmatter block is recognised only when the very first line is `---` and
 * a closing `---` follows. Anything else is treated as pure body with empty
 * frontmatter. Only `title` / `order` / `hidden` are extracted; `order` must
 * parse as a finite number and `hidden` as `true`/`false` (case-insensitive)
 * to take effect.
 */
export function parseFrontmatter(source: string): ParsedMarkdown {
  // Normalise CRLF so the fence and line splitting behave identically on both.
  const normalised = source.replace(/\r\n/g, '\n');
  const lines = normalised.split('\n');

  if (lines.length === 0 || !FENCE.test(lines[0])) {
    return { frontmatter: {}, body: source };
  }

  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      closing = i;
      break;
    }
  }
  if (closing === -1) {
    // Unterminated block — treat the whole file as body (spec: optional).
    return { frontmatter: {}, body: source };
  }

  const frontmatter: Frontmatter = {};
  for (let i = 1; i < closing; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const rawValue = line.slice(sep + 1);

    if (key === 'title') {
      const title = parseScalar(rawValue);
      if (title.length > 0) frontmatter.title = title;
    } else if (key === 'order') {
      const n = Number(parseScalar(rawValue));
      if (Number.isFinite(n)) frontmatter.order = n;
    } else if (key === 'hidden') {
      const v = parseScalar(rawValue).toLowerCase();
      if (v === 'true') frontmatter.hidden = true;
      else if (v === 'false') frontmatter.hidden = false;
    }
  }

  const body = lines.slice(closing + 1).join('\n');
  return { frontmatter, body };
}

/**
 * Return the text of the first ATX `H1` (`# Heading`) in `body`, or
 * `undefined`. Content inside fenced code blocks (``` / ~~~) is skipped so a
 * `#` comment in a code sample is never mistaken for a heading. A trailing run
 * of `#` (closed ATX form) is trimmed.
 */
export function firstH1(body: string): string | undefined {
  let fence: string | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trimEnd();
    const fenceMatch = line.trimStart().match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h1 = line.match(/^#[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (h1) {
      const text = h1[1].trim();
      if (text.length > 0) return text;
    }
  }
  return undefined;
}

/**
 * Prettify a raw filename into a last-resort label (features spec §7):
 * drop the extension, strip a leading numeric ordering prefix (`0001-`),
 * turn `-`/`_` into spaces, collapse whitespace, and Title-Case the words.
 * e.g. `0001-architecture-overview.md` → `Architecture Overview`.
 */
export function prettifyFilename(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, '');
  const withoutPrefix = withoutExt.replace(/^\d+[-_ ]+/, '');
  const words = withoutPrefix
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const pretty = words.join(' ');
  // Degenerate names (e.g. all separators) fall back to the base name.
  return pretty.length > 0 ? pretty : withoutExt;
}

/**
 * Resolve the human-readable label for a node (features spec §7):
 * `frontmatter.title` → first `H1` in the body → prettified filename.
 * Never returns the raw filename.
 */
export function resolveTitle(
  name: string,
  frontmatter: Frontmatter,
  body: string,
): string {
  if (frontmatter.title !== undefined && frontmatter.title.length > 0) {
    return frontmatter.title;
  }
  const heading = firstH1(body);
  if (heading !== undefined) return heading;
  return prettifyFilename(name);
}
