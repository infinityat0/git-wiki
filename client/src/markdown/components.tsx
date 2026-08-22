/**
 * F7 — The component-map seam.
 *
 * This is where the `R*` render tasks plug in WITHOUT touching parsing or
 * sanitize. Instead of exposing raw react-markdown tag overrides, we expose
 * semantic *slots* keyed exactly as the task cards describe — `code`, `a`,
 * `img`, `iframe`, `callout`, plus the `mermaid` and `math` hooks. The pipeline
 * has already done the dangerous work (sanitize, iframe policy, katex); a slot
 * author only supplies presentation.
 *
 * `buildComponents(slots)` turns the slots into the flat `components` map
 * react-markdown consumes, dispatching the ambiguous host tags:
 *   - `<div data-callout>`          → the `callout` slot
 *   - `<div data-iframe-placeholder>` → the `iframePlaceholder` slot
 *   - `<code class="language-mermaid">` → the `mermaid` slot
 *   - every other `<code>`          → the `code` slot
 *
 * `defaultSlots` are safe passthrough renderers so the pipeline is fully
 * functional now, before any `R*` lands.
 */

/* eslint-disable react-refresh/only-export-components --
   This is a pipeline library module, not a fast-refresh UI boundary: it
   deliberately colocates the `buildComponents` seam factory with its default
   renderers so `R*` has one import site. */
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import type { CalloutType } from './callouts.js';
import type { IframeBlockReason } from './pipeline.js';

/** Props react-markdown hands a `code` renderer (inline or fenced block). */
export type CodeSlotProps = ComponentPropsWithoutRef<'code'> & ExtraProps;
/** Props react-markdown hands an `a` renderer. */
export type AnchorSlotProps = ComponentPropsWithoutRef<'a'> & ExtraProps;
/** Props react-markdown hands an `img` renderer. */
export type ImageSlotProps = ComponentPropsWithoutRef<'img'> & ExtraProps;
/** Props react-markdown hands the live-`iframe` renderer (already sandboxed). */
export type IframeSlotProps = ComponentPropsWithoutRef<'iframe'> & ExtraProps;

/** Props the pipeline synthesizes for a callout block. */
export interface CalloutSlotProps {
  /** Alert kind (`note` | `tip` | `important` | `warning` | `caution`). */
  type: CalloutType;
  /** Resolved title text. */
  title: string;
  /** Callout body. */
  children?: ReactNode;
}

/** Props for the placeholder shown in place of a blocked iframe. */
export interface IframePlaceholderSlotProps {
  /** The original (blocked) iframe `src`, if any. */
  src: string;
  /** Why it was blocked. */
  reason: IframeBlockReason | string;
}

/** Props for the mermaid hook — the raw fenced source, undecorated. */
export interface MermaidSlotProps {
  /** The diagram source from the ```mermaid fence. */
  code: string;
}

/**
 * The extension surface. Every field is optional; unset slots fall back to the
 * safe passthrough in {@link defaultSlots}. `R*` supplies a subset.
 */
export interface MarkdownSlots {
  code?: ComponentType<CodeSlotProps>;
  a?: ComponentType<AnchorSlotProps>;
  img?: ComponentType<ImageSlotProps>;
  iframe?: ComponentType<IframeSlotProps>;
  callout?: ComponentType<CalloutSlotProps>;
  iframePlaceholder?: ComponentType<IframePlaceholderSlotProps>;
  /** `code.language-mermaid` hook (R2). Renders raw source until supplied. */
  mermaid?: ComponentType<MermaidSlotProps>;
}

/** Extract a string prop that react-markdown forwards from a hast property. */
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Pull the plain-text content out of react-markdown children (for mermaid). */
function childText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childText).join('');
  return '';
}

/* -------------------------------------------------------------------------- */
/* Safe default passthrough renderers                                         */
/* -------------------------------------------------------------------------- */

function DefaultCode({ node: _node, ...props }: CodeSlotProps) {
  return <code {...props} />;
}

function DefaultAnchor({ node: _node, ...props }: AnchorSlotProps) {
  return <a {...props} />;
}

function DefaultImage({ node: _node, ...props }: ImageSlotProps) {
  return <img {...props} />;
}

function DefaultIframe({ node: _node, ...props }: IframeSlotProps) {
  return <iframe {...props} />;
}

function DefaultCallout({ type, title, children }: CalloutSlotProps) {
  return (
    <div
      className={`callout callout-${type}`}
      data-callout={type}
      data-callout-title={title}
    >
      {children}
    </div>
  );
}

function DefaultIframePlaceholder({ src, reason }: IframePlaceholderSlotProps) {
  return (
    <div
      className="iframe-placeholder"
      data-iframe-placeholder="true"
      data-iframe-reason={reason}
    >
      {src}
    </div>
  );
}

function DefaultMermaid({ code }: MermaidSlotProps) {
  return (
    <pre className="mermaid-source">
      <code className="language-mermaid">{code}</code>
    </pre>
  );
}

/** The built-in slots — a fully functional, safe passthrough set. */
export const defaultSlots: Required<MarkdownSlots> = {
  code: DefaultCode,
  a: DefaultAnchor,
  img: DefaultImage,
  iframe: DefaultIframe,
  callout: DefaultCallout,
  iframePlaceholder: DefaultIframePlaceholder,
  mermaid: DefaultMermaid,
};

/**
 * Compose caller slots over the defaults and produce the flat react-markdown
 * `components` map, wiring the div/code dispatch. `R*` calls this (or passes
 * `slots` to `<Markdown>`); sanitize and the plugin chain are untouched.
 */
export function buildComponents(slots?: MarkdownSlots): Components {
  const s: Required<MarkdownSlots> = { ...defaultSlots, ...slots };
  const Code = s.code;
  const Anchor = s.a;
  const Image = s.img;
  const Iframe = s.iframe;
  const Callout = s.callout;
  const Placeholder = s.iframePlaceholder;
  const Mermaid = s.mermaid;

  return {
    a: Anchor,
    img: Image,
    iframe: Iframe,
    code(props) {
      const className = str((props as { className?: unknown }).className);
      if (/\blanguage-mermaid\b/.test(className)) {
        return <Mermaid code={childText(props.children)} />;
      }
      return <Code {...props} />;
    },
    div(props) {
      const p = props as Record<string, unknown> & { children?: ReactNode };
      if (str(p['data-callout'])) {
        return (
          <Callout
            type={str(p['data-callout']) as CalloutType}
            title={str(p['data-callout-title'])}
          >
            {p.children}
          </Callout>
        );
      }
      if (str(p['data-iframe-placeholder'])) {
        return (
          <Placeholder
            src={str(p['data-iframe-src'])}
            reason={str(p['data-iframe-reason'])}
          />
        );
      }
      const { node: _node, ...rest } = props as { node?: unknown } & Record<
        string,
        unknown
      >;
      return <div {...(rest as Record<string, unknown>)} />;
    },
  };
}
