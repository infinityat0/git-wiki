/**
 * U3 — assemble the F7 `slots` map from the R* render components.
 *
 * `<Markdown>` exposes a semantic slot seam (F7); the R* tasks each own one
 * renderer. This is where U3 (the content view) plugs them together into the
 * concrete `MarkdownSlots` object `<Markdown slots>` consumes. The pipeline has
 * already done the dangerous work (sanitize, iframe policy, slug/TOC); slots
 * only supply presentation.
 *
 * Two slots need per-document context that the pipeline can't know:
 *   - `a` (R6 `MdLink`) needs `docExists` (broken-link detection) + `basePath`
 *     (resolve relative `.md` targets against the current doc's directory).
 *   - `img` (R6 `MdImage`) needs `basePath` (resolve relative image `src`s).
 * We close over those here so the raw R6 components stay context-free.
 */

import { useMemo } from 'react';
import type { MarkdownSlots } from '../../markdown/index.js';
import { CodeBlock } from '../../markdown/components/CodeBlock.js';
import { Mermaid } from '../../markdown/components/Mermaid.js';
import { Callout } from '../../markdown/components/Callout.js';
import { Embed } from '../../markdown/components/Embed.js';
import { EmbedPlaceholder } from '../../markdown/components/EmbedPlaceholder.js';
import { MdImage } from '../../markdown/components/MdImage.js';
import { MdLink } from '../../markdown/components/MdLink.js';
import type { DocExists } from '../../routes/docExists.js';

/**
 * Build the slot map for a document at `basePath` (its directory relative to
 * `repo-cache/`), with `docExists` wired into `MdLink` for broken-link
 * detection.
 */
export function buildDocSlots(
  basePath: string,
  docExists: DocExists,
): MarkdownSlots {
  return {
    code: CodeBlock,
    mermaid: Mermaid,
    callout: Callout,
    iframe: Embed,
    iframePlaceholder: EmbedPlaceholder,
    img: (props) => <MdImage {...props} basePath={basePath} />,
    a: (props) => (
      <MdLink {...props} basePath={basePath} docExists={docExists} />
    ),
  };
}

/** Memoized {@link buildDocSlots} — stable per `(basePath, docExists)` pair. */
export function useDocSlots(
  basePath: string,
  docExists: DocExists,
): MarkdownSlots {
  return useMemo(
    () => buildDocSlots(basePath, docExists),
    [basePath, docExists],
  );
}
