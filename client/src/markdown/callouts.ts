/**
 * F7 — `remark-callouts`
 *
 * A custom remark (mdast) transform that turns GitHub-style alert blockquotes
 *
 *   > [!NOTE]
 *   > body...
 *
 * into a callout node: a `<div class="callout callout-note" data-callout="note"
 * data-callout-title="Note">` wrapper carrying the alert kind as data-* seams.
 * The visual treatment (icon, colors, border) is R4's job — this plugin only
 * produces the semantic node + seam. The marker line itself is stripped from
 * the rendered body.
 *
 * Blockquotes without a recognized `[!TYPE]` marker are left untouched as
 * ordinary blockquotes.
 */

import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';

/** The alert kinds recognized by the transform. */
export const CALLOUT_TYPES = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

// Marker at the start of the first text node: `[!TYPE]`, an optional same-line
// title (never crossing the newline into the body), then the rest of the node.
const MARKER = /^\[!(\w+)\]([^\n]*)\n?([\s\S]*)$/;

function isCalloutType(value: string): value is CalloutType {
  return (CALLOUT_TYPES as readonly string[]).includes(value);
}

function titleCase(type: CalloutType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Attach hast hints to a blockquote so it renders as a callout `<div>`.
 * Mutates `node.data` (hName/hProperties), consumed downstream by the
 * mdast→hast conversion inside react-markdown.
 */
function markAsCallout(
  node: Blockquote,
  type: CalloutType,
  title: string,
): void {
  const data = (node.data ??= {});
  data.hName = 'div';
  // Use hast-idiomatic camelCase data* keys so they match the sanitize schema
  // and the mdast→hast→jsx conversion; they render as `data-callout` etc.
  data.hProperties = {
    className: ['callout', `callout-${type}`],
    dataCallout: type,
    dataCalloutTitle: title,
  };
}

/**
 * The remark plugin. Detects the `[!TYPE]` marker in the first text node of a
 * blockquote's first paragraph, records the callout kind, and removes the
 * marker (and its trailing line break) from the body.
 */
export const remarkCallouts: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') return;
      const paragraph = firstChild as Paragraph;
      const firstInline = paragraph.children[0];
      if (!firstInline || firstInline.type !== 'text') return;

      const textNode = firstInline as Text;
      const match = MARKER.exec(textNode.value);
      if (!match) return;

      const kind = match[1].toLowerCase();
      if (!isCalloutType(kind)) return;

      // Optional inline title on the marker line (e.g. `[!NOTE] Heads up`); the
      // body is everything after the first newline.
      const inlineTitle = match[2].trim();
      const rest = match[3];
      const title = inlineTitle.length > 0 ? inlineTitle : titleCase(kind);

      // Strip the marker line from the body, preserving the rest of the block.
      textNode.value = rest;
      if (rest.length === 0) {
        paragraph.children.shift();
        if (paragraph.children[0]?.type === 'break') {
          paragraph.children.shift();
        }
      }

      markAsCallout(node, kind, title);
    });
  };
};

export default remarkCallouts;
