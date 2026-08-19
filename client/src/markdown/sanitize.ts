/**
 * F7 — The security boundary.
 *
 * This module is the **single source of truth** for what raw HTML the markdown
 * pipeline is allowed to render. Everything dangerous is denied here by
 * construction: `<script>`, inline event handlers (`on*`), `javascript:` URLs,
 * and any iframe that does not satisfy the embed policy.
 *
 * It exports two things the rest of the pipeline composes:
 *   1. `sanitizeSchema` — the allowlist passed to `rehype-sanitize`.
 *   2. The iframe embed policy (`IFRAME_ALLOWED_HOSTS`, `FORCED_SANDBOX`,
 *      `isAllowedIframeSrc`) that the `rehype-iframe-policy` transform in
 *      `pipeline.ts` enforces *before* sanitize runs.
 *
 * Per ADR-0002 and security-and-safety.md §3/§3.1, the sanitize allowlist IS
 * the iframe policy. Any change here is security-critical and is guarded by
 * `sanitize.test.ts` — the tests must change with the schema.
 */

import { defaultSchema } from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';

/**
 * Hosts an `<iframe src>` may point at. In production this is seeded from the
 * `IFRAME_ALLOWED_HOSTS` env/config value (security-and-safety.md §3); here it
 * is the built-in default allowlist. A non-allowlisted `src` renders as a
 * placeholder card, never a live frame.
 *
 * Matching is exact-host or registrable-suffix (`foo.youtube.com` matches
 * `youtube.com`), never substring, so `evil-youtube.com` does not match.
 */
export const IFRAME_ALLOWED_HOSTS: readonly string[] = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
  'codesandbox.io',
  'codepen.io',
];

/**
 * The forced `sandbox` value. Authors cannot opt out of it or widen it — the
 * iframe policy overwrites whatever the author supplied with exactly this.
 * Deliberately excludes `allow-top-navigation` and `allow-forms`
 * (security-and-safety.md §3).
 */
export const FORCED_SANDBOX = 'allow-scripts allow-same-origin allow-popups';

/** The forced `loading` value on every rendered iframe. */
export const FORCED_LOADING = 'lazy';

/** URL protocols that are never permitted anywhere (defense-in-depth). */
const DENY_PROTOCOLS = /^\s*(javascript|vbscript|data):/i;

/**
 * Is this a `javascript:`/`vbscript:`/`data:` (or otherwise script-bearing)
 * URL? Used by the pipeline as a belt-and-braces check; `rehype-sanitize`'s
 * protocol allowlist is the primary control.
 */
export function isDangerousUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return DENY_PROTOCOLS.test(url);
}

/**
 * Does `src` resolve to an allowlisted host over http(s)? Returns `false` for
 * missing/relative/opaque/`javascript:` values and raw-IP hosts — anything not
 * an exact or sub-domain match of {@link IFRAME_ALLOWED_HOSTS}.
 */
export function isAllowedIframeSrc(src: string | null | undefined): boolean {
  if (!src || typeof src !== 'string') return false;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    // Relative/opaque URLs have no host to allowlist → not a live embed.
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return IFRAME_ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith('.' + allowed),
  );
}

/**
 * The `rehype-sanitize` allowlist. Built by cloning the library default (which
 * already strips `<script>`, `on*` handlers, and non-http(s) URLs) and then:
 *   - allowing `<iframe>` with only the safe embed attributes — notably NOT
 *     `srcdoc` and NOT any `on*` handler;
 *   - allowing `className` + our callout/iframe `data-*` seams so `R*`
 *     component renderers can key off them;
 *   - relaxing the over-strict `code` className rule so `language-*` survives
 *     for the syntax highlighter (R1).
 *
 * Note the ordering contract enforced in `pipeline.ts`: this schema keeps the
 * default `clobberPrefix` (`user-content-`) which rewrites author-supplied
 * `id`s, so `rehype-slug` runs *after* sanitize to produce clean heading ids.
 */
export const sanitizeSchema: Schema = buildSanitizeSchema();

function buildSanitizeSchema(): Schema {
  const schema: Schema = structuredClone(defaultSchema) as Schema;

  const tagNames = new Set(schema.tagNames ?? []);
  // `<iframe>` is permitted ONLY because the iframe-policy transform has
  // already forced sandbox/loading, dropped srcdoc, and replaced any
  // non-allowlisted host with a placeholder before this schema is applied.
  tagNames.add('iframe');
  schema.tagNames = [...tagNames];

  const attributes = { ...(schema.attributes ?? {}) };

  // Global: allow className and stable ids everywhere. `id` remains subject to
  // the inherited `clobberPrefix`, so only post-sanitize `rehype-slug` ids are
  // clean anchor targets.
  attributes['*'] = [...(attributes['*'] ?? []), 'className', 'id'];

  // Iframe: the exact safe surface. `srcdoc` and `on*` are intentionally
  // absent — sanitize is the backstop even if the policy transform is bypassed.
  attributes.iframe = [
    'src',
    'title',
    'width',
    'height',
    'allow',
    'allowFullScreen',
    'loading',
    'referrerPolicy',
    'sandbox',
    'className',
  ];

  // Callout wrapper (remark-callouts → <div>) and the iframe placeholder card
  // expose data-* seams for the R4/R5 component renderers.
  attributes.div = [
    ...(attributes.div ?? []),
    'className',
    'dataCallout',
    'dataCalloutTitle',
    'dataIframePlaceholder',
    'dataIframeSrc',
    'dataIframeReason',
  ];
  attributes.span = [...(attributes.span ?? []), 'className', 'dataCallout'];

  // Code blocks: allow any `language-*` class through for the highlighter.
  attributes.code = ['className'];
  attributes.pre = [...(attributes.pre ?? []), 'className'];

  // Links: keep the default `href` handling, but also allow the anchor/target
  // hints internal-link rewriting (R6) may add.
  attributes.a = [
    ...(attributes.a ?? []),
    'target',
    'rel',
    'dataInternal',
    'dataBrokenLink',
  ];

  // Images: allow the caption/alt/relative-src surface R6 resolves.
  attributes.img = [
    ...(attributes.img ?? []),
    'alt',
    'title',
    'width',
    'height',
  ];

  schema.attributes = attributes;

  // Explicitly ensure `srcdoc` can never be reintroduced via schema drift.
  // (It is simply absent from `attributes.iframe` above; this is documentation
  // of intent, asserted by sanitize.test.ts.)

  return schema;
}
