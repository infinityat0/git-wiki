/**
 * F7 — Markdown pipeline core: public surface.
 *
 * `R*` render tasks import the seam (`MarkdownSlots`, `buildComponents`, slot
 * prop types) and the `<Markdown>` component from here. U2 imports `extractToc`
 * / `TocEntry`. The sanitize allowlist and iframe policy are exported for
 * audit/tests but are not meant to be reconfigured by consumers.
 */

export {
  Markdown,
  default as MarkdownComponent,
  type MarkdownProps,
} from './Markdown.js';

export {
  buildComponents,
  defaultSlots,
  type MarkdownSlots,
  type CodeSlotProps,
  type AnchorSlotProps,
  type ImageSlotProps,
  type IframeSlotProps,
  type CalloutSlotProps,
  type IframePlaceholderSlotProps,
  type MermaidSlotProps,
} from './components.js';

export { MathStyles } from './components/Math.js';
import './components/Math.css';

export {
  extractToc,
  createTocCollector,
  buildRemarkPlugins,
  buildRehypePlugins,
  rehypeIframePolicy,
  type IframeBlockReason,
} from './pipeline.js';

export { rehypeToc, type TocEntry, type TocCollector } from './toc.js';

export { remarkCallouts, CALLOUT_TYPES, type CalloutType } from './callouts.js';

export {
  sanitizeSchema,
  IFRAME_ALLOWED_HOSTS,
  FORCED_SANDBOX,
  FORCED_LOADING,
  isAllowedIframeSrc,
  isDangerousUrl,
} from './sanitize.js';
