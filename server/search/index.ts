/**
 * In-memory full-text search index over the docs cache (ADR-0003, features
 * spec §6.2).
 *
 * A single {@link MiniSearch} instance, built by walking `repo-cache/` and
 * indexing every non-hidden `.md` file as `{ path, title, headings, body }`
 * with field boosts (title > headings > body). Markdown is stripped to plain
 * text before indexing so search matches read like prose, not syntax.
 *
 * The index is **rebuilt from scratch** on boot and by the sync worker (B7)
 * after every successful pull — {@link rebuildSearchIndex}. For the expected
 * corpus (hundreds to low-thousands of docs) a full rebuild is sub-second and
 * far simpler than maintaining an incremental durable index. On completion the
 * shared {@link readiness} flag flips to `ready` so `GET /api/health` (and the
 * Kubernetes readiness probe) can gate traffic on a warm index.
 *
 * Search stays entirely server-side: the corpus is never shipped to the client,
 * and hidden docs are excluded at index-build time so they can never surface in
 * a result. Query the index with {@link searchDocs}.
 */

import fs from 'node:fs';
import path from 'node:path';

import MiniSearch from 'minisearch';
import type { SearchResult } from '@wiki/contracts';

import { config } from '../config/index.js';
import { readiness } from '../boot/readiness.js';
import { parseFrontmatter, resolveTitle } from '../lib/frontmatter.js';

/** Only markdown files are indexed. */
const DOC_EXTENSION = '.md';
/** Never traversed. */
const EXCLUDED_DIRS = new Set(['.git']);
/** Field boosts: a title hit outranks a heading hit outranks a body hit. */
const FIELD_BOOST = { title: 4, headings: 2, body: 1 } as const;
/** Characters of context kept on either side of a matched term in a snippet. */
const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 90;
/** Cap the number of snippet strings returned per hit. */
const MAX_SNIPPETS = 3;

/** One indexed document. `path` (relative to the docs root) is the id. */
interface IndexedDoc {
  /** Path relative to the docs root; also the MiniSearch id. */
  path: string;
  /** Resolved title (frontmatter → first H1 → prettified filename). */
  title: string;
  /** All heading texts joined by newlines. */
  headings: string;
  /** Markdown body stripped to plain text. */
  body: string;
}

/**
 * The live index. `null` until {@link rebuildSearchIndex} first runs, so
 * {@link searchDocs} degrades to "no results" before the index is warm rather
 * than throwing.
 */
let index: MiniSearch<IndexedDoc> | null = null;
/** Stored bodies keyed by path, used to build highlighted snippets. */
let bodies = new Map<string, string>();

/** Construct an empty MiniSearch configured for our document shape. */
function createIndex(): MiniSearch<IndexedDoc> {
  return new MiniSearch<IndexedDoc>({
    idField: 'path',
    fields: ['title', 'headings', 'body'],
    storeFields: ['path', 'title'],
  });
}

/**
 * Strip markdown syntax down to readable plain text. This is intentionally a
 * lightweight lexical scrub (not a full parse): it removes the constructs that
 * would otherwise pollute the index and snippets — fenced/inline code, image
 * and link syntax (keeping visible text), heading/emphasis/list/table markers,
 * blockquote arrows, and raw HTML tags — then collapses whitespace.
 */
export function stripMarkdown(source: string): string {
  return (
    source
      // Fenced code blocks (``` or ~~~) — drop entirely.
      .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, ' ')
      // Inline code — keep the text, drop the backticks.
      .replace(/`([^`]+)`/g, '$1')
      // Images — drop entirely (alt text is rarely useful prose).
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      // Links — keep the visible label.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Reference-style link/image definitions.
      .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, ' ')
      // ATX heading markers, blockquote arrows, list bullets.
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^[ \t]*>[ \t]?/gm, '')
      .replace(/^[ \t]*[-*+][ \t]+/gm, '')
      .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
      // Table cell/pipe separators.
      .replace(/\|/g, ' ')
      .replace(/^[ \t]*:?-{3,}:?[ \t]*$/gm, ' ')
      // Emphasis / bold / strikethrough markers.
      .replace(/(\*\*|__|\*|_|~~)/g, '')
      // Raw HTML tags.
      .replace(/<[^>]+>/g, ' ')
      // Collapse whitespace.
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Collect the text of every ATX heading (`#`..`######`) in `body`, skipping
 * fenced code blocks so a `#` comment in a code sample is never treated as a
 * heading. Trailing closing `#` runs are trimmed.
 */
export function extractHeadings(body: string): string[] {
  const headings: string[] = [];
  let fence: string | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trimEnd();
    const fenceMatch = line.trimStart().match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = line.match(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (h) {
      const text = h[1].trim();
      if (text.length > 0) headings.push(text);
    }
  }
  return headings;
}

/** Recursively collect absolute paths of every `.md` file under `absDir`. */
function collectMarkdown(absDir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectMarkdown(path.join(absDir, entry.name), out);
    } else if (
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === DOC_EXTENSION
    ) {
      out.push(path.join(absDir, entry.name));
    }
  }
}

/**
 * Read the docs root and produce the indexable documents. Hidden docs
 * (`hidden: true` frontmatter) are dropped here, so they are never present in
 * the index and can never appear in a result. Pure w.r.t. the index singleton
 * (returns data), which keeps it unit-testable.
 */
export function collectDocs(rootDir: string): IndexedDoc[] {
  const resolved = path.resolve(rootDir);
  if (!fs.existsSync(resolved)) return [];

  const files: string[] = [];
  collectMarkdown(resolved, files);
  files.sort(); // stable, deterministic order

  const docs: IndexedDoc[] = [];
  for (const abs of files) {
    let raw: string;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const { frontmatter, body } = parseFrontmatter(raw);
    if (frontmatter.hidden === true) continue; // excluded from the index

    const rel = path.relative(resolved, abs).split(path.sep).join('/');
    const name = path.basename(abs);
    docs.push({
      path: rel,
      title: resolveTitle(name, frontmatter, body),
      headings: extractHeadings(body).join('\n'),
      body: stripMarkdown(body),
    });
  }
  return docs;
}

/**
 * Rebuild the in-memory search index from scratch over `rootDir`
 * (default: `config.docs.repoCacheDir`).
 *
 * Called on boot and by the sync worker (B7) after every successful pull. The
 * shared {@link readiness} flag is flipped to `building` while the new index is
 * assembled and to `ready` on completion — the index reference is swapped
 * atomically so in-flight queries always see a fully-built index.
 */
export function rebuildSearchIndex(
  rootDir: string = config.docs.repoCacheDir,
): void {
  readiness.setSearchIndex('building');

  const docs = collectDocs(rootDir);
  const next = createIndex();
  next.addAll(docs);

  const nextBodies = new Map<string, string>();
  for (const doc of docs) nextBodies.set(doc.path, doc.body);

  index = next;
  bodies = nextBodies;

  readiness.setSearchIndex('ready');
}

/**
 * Build up to {@link MAX_SNIPPETS} highlighted snippets from `text` around the
 * matched `terms`. Each matched term is wrapped in `**…**` (markdown bold, as
 * in the spec §6.2 example) and each snippet is elided with `…` where it was
 * cut from the surrounding text.
 */
export function buildSnippets(text: string, terms: string[]): string[] {
  if (text.length === 0 || terms.length === 0) return [];
  const lower = text.toLowerCase();
  const needles = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 0);

  const snippets: string[] = [];
  const usedRanges: Array<[number, number]> = [];

  for (const needle of needles) {
    if (snippets.length >= MAX_SNIPPETS) break;
    const at = lower.indexOf(needle);
    if (at === -1) continue;

    const start = Math.max(0, at - SNIPPET_BEFORE);
    const end = Math.min(text.length, at + needle.length + SNIPPET_AFTER);
    // Skip a window we've already emitted (overlapping term hits).
    if (usedRanges.some(([s, e]) => start < e && end > s)) continue;
    usedRanges.push([start, end]);

    let slice = text.slice(start, end);
    // Bold every matched term occurrence within this window (case-insensitive).
    for (const n of needles) {
      slice = slice.replace(
        new RegExp(escapeRegExp(n), 'gi'),
        (m) => `**${m}**`,
      );
    }
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    snippets.push(`${prefix}${slice.trim()}${suffix}`);
  }
  return snippets;
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Query the search index. Returns ranked {@link SearchResult}[] — highest score
 * first — each with highlighted `matches` snippets. Prefix + fuzzy matching is
 * enabled so partial words and small typos still hit. An empty query, or a
 * query issued before the index is built, yields `[]`.
 */
export function searchDocs(query: string, limit = 20): SearchResult[] {
  const q = query.trim();
  if (index === null || q.length === 0) return [];

  const raw = index.search(q, {
    boost: FIELD_BOOST,
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  });

  const results: SearchResult[] = [];
  for (const hit of raw.slice(0, limit)) {
    const docPath = hit.id as string;
    const title = (hit as { title?: string }).title ?? docPath;
    const terms = hit.terms ?? [];
    const body = bodies.get(docPath) ?? '';

    let matches = buildSnippets(body, terms);
    if (matches.length === 0) {
      // No body hit (e.g. a title-only match): fall back to a title snippet,
      // then to a leading body excerpt, so a result never has empty matches.
      const titleSnippet = buildSnippets(title, terms);
      matches =
        titleSnippet.length > 0
          ? titleSnippet
          : body.length > 0
            ? [body.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER).trim() + '…']
            : [title];
    }

    results.push({ path: docPath, title, matches });
  }
  return results;
}

/** Whether the index has been built at least once (for tests / diagnostics). */
export function isIndexBuilt(): boolean {
  return index !== null;
}
